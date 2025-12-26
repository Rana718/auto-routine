"""
Route Optimization Service
Generates optimized routes for staff using store distance calculations
"""

from datetime import date, datetime, timedelta
from typing import List, Dict, Optional, Tuple
from decimal import Decimal
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from db.schema import (
    Staff, Store, Route, RouteStop, RouteStatus, StopStatus,
    PurchaseList, PurchaseListItem, ListStatus, StoreDistanceMatrix
)
from services.store_selection import calculate_distance


async def generate_route_for_staff(
    db: AsyncSession,
    staff_id: int,
    target_date: date,
    optimization_priority: str = "speed"
) -> Optional[int]:
    """
    Generate an optimized route for a staff member's purchase list.
    
    Uses Nearest Neighbor algorithm (greedy) for practical efficiency.
    Not mathematically perfect but fast and produces good results.
    
    Returns: route_id if created, None otherwise
    """
    # Get staff info
    result = await db.execute(select(Staff).where(Staff.staff_id == staff_id))
    staff = result.scalar_one_or_none()
    if not staff:
        return None
    
    # Get purchase list for this date
    result = await db.execute(
        select(PurchaseList)
        .where(PurchaseList.staff_id == staff_id)
        .where(PurchaseList.purchase_date == target_date)
    )
    purchase_list = result.scalar_one_or_none()
    if not purchase_list or purchase_list.total_items == 0:
        return None
    
    # Get unique stores to visit
    result = await db.execute(
        select(
            Store.store_id,
            Store.store_name,
            Store.address,
            Store.latitude,
            Store.longitude,
            func.count(PurchaseListItem.list_item_id).label("items_count")
        )
        .join(PurchaseListItem, PurchaseListItem.store_id == Store.store_id)
        .where(PurchaseListItem.list_id == purchase_list.list_id)
        .group_by(Store.store_id, Store.store_name, Store.address, Store.latitude, Store.longitude)
    )
    stores = result.all()
    
    if not stores:
        return None
    
    # Check if route already exists
    result = await db.execute(
        select(Route)
        .where(Route.list_id == purchase_list.list_id)
    )
    existing_route = result.scalar_one_or_none()
    if existing_route:
        # Delete existing stops and update route
        await db.execute(
            RouteStop.__table__.delete().where(RouteStop.route_id == existing_route.route_id)
        )
        route = existing_route
        route.route_status = RouteStatus.NOT_STARTED
    else:
        # Create new route
        route = Route(
            list_id=purchase_list.list_id,
            staff_id=staff_id,
            route_date=target_date,
            start_location_lat=staff.start_location_lat,
            start_location_lng=staff.start_location_lng,
            route_status=RouteStatus.NOT_STARTED,
            include_return=True,
        )
        db.add(route)
        await db.flush()
        await db.refresh(route)
    
    # Build distance matrix for stores
    store_coords = {
        s.store_id: (s.latitude, s.longitude) 
        for s in stores if s.latitude and s.longitude
    }
    
    # Starting point (staff location or default Tokyo coords)
    start_lat = staff.start_location_lat or Decimal("35.6762")
    start_lng = staff.start_location_lng or Decimal("139.6503")
    
    # Generate optimized order using Nearest Neighbor algorithm
    optimized_order = nearest_neighbor_route(
        start_point=(start_lat, start_lng),
        stores=[(s.store_id, s.latitude, s.longitude, s.items_count) for s in stores],
        use_distance=(optimization_priority in ["distance", "balanced"])
    )
    
    # Calculate total distance and time
    total_distance = 0.0
    estimated_time = 0
    
    # Average time per store (15 min shopping + 5 min travel per km)
    SHOPPING_TIME_PER_STORE = 15  # minutes
    TRAVEL_TIME_PER_KM = 5  # minutes
    
    prev_lat, prev_lng = start_lat, start_lng
    current_time = datetime.combine(target_date, datetime.strptime("10:00", "%H:%M").time())
    
    for seq, (store_id, lat, lng, items_count) in enumerate(optimized_order):
        if lat and lng:
            dist = calculate_distance(prev_lat, prev_lng, lat, lng)
            total_distance += dist
            travel_time = int(dist * TRAVEL_TIME_PER_KM)
            current_time += timedelta(minutes=travel_time)
            prev_lat, prev_lng = lat, lng
        
        # Create route stop
        stop = RouteStop(
            route_id=route.route_id,
            store_id=store_id,
            stop_sequence=seq + 1,
            estimated_arrival=current_time,
            items_count=items_count,
            stop_status=StopStatus.PENDING,
        )
        db.add(stop)
        
        # Add shopping time
        current_time += timedelta(minutes=SHOPPING_TIME_PER_STORE)
        estimated_time += SHOPPING_TIME_PER_STORE + travel_time if lat and lng else SHOPPING_TIME_PER_STORE
    
    # Update route totals
    route.total_distance_km = Decimal(str(round(total_distance, 2)))
    route.estimated_time_minutes = estimated_time
    
    # Update purchase list status
    purchase_list.list_status = ListStatus.ASSIGNED
    
    await db.flush()
    return route.route_id


def nearest_neighbor_route(
    start_point: Tuple[Decimal, Decimal],
    stores: List[Tuple[int, Decimal, Decimal, int]],  # (store_id, lat, lng, items_count)
    use_distance: bool = True
) -> List[Tuple[int, Decimal, Decimal, int]]:
    """
    Nearest Neighbor algorithm for TSP-like route optimization.
    Greedy algorithm that always visits the nearest unvisited store.
    
    Returns stores in optimized order.
    """
    if not stores:
        return []
    
    if len(stores) == 1:
        return stores
    
    # Separate stores with and without coordinates
    stores_with_coords = [(s[0], s[1], s[2], s[3]) for s in stores if s[1] and s[2]]
    stores_without_coords = [(s[0], s[1], s[2], s[3]) for s in stores if not s[1] or not s[2]]
    
    if not stores_with_coords:
        return stores  # Can't optimize without coordinates
    
    result = []
    remaining = list(stores_with_coords)
    current_lat, current_lng = start_point
    
    while remaining:
        # Find nearest unvisited store
        nearest_idx = 0
        nearest_dist = float('inf')
        
        for i, (store_id, lat, lng, items) in enumerate(remaining):
            dist = calculate_distance(current_lat, current_lng, lat, lng)
            if dist < nearest_dist:
                nearest_dist = dist
                nearest_idx = i
        
        # Visit this store
        store = remaining.pop(nearest_idx)
        result.append(store)
        current_lat, current_lng = store[1], store[2]
    
    # Add stores without coordinates at the end
    result.extend(stores_without_coords)
    
    return result


async def generate_all_routes_for_date(
    db: AsyncSession,
    target_date: date,
    optimization_priority: str = "speed"
) -> List[int]:
    """
    Generate routes for all buyer staff members with purchase lists on the target date.
    Returns list of created route IDs.
    """
    from db.schema import StaffRole
    result = await db.execute(
        select(PurchaseList)
        .join(Staff, Staff.staff_id == PurchaseList.staff_id)
        .where(PurchaseList.purchase_date == target_date)
        .where(PurchaseList.total_items > 0)
        .where(Staff.role == StaffRole.BUYER)
        .where(Staff.is_active == True)
    )
    purchase_lists = result.scalars().all()
    
    route_ids = []
    for pl in purchase_lists:
        route_id = await generate_route_for_staff(
            db, pl.staff_id, target_date, optimization_priority
        )
        if route_id:
            route_ids.append(route_id)
    
    return route_ids


async def recalculate_route(
    db: AsyncSession,
    route_id: int,
    optimization_priority: str = "speed"
) -> bool:
    """
    Recalculate an existing route with new optimization.
    """
    result = await db.execute(select(Route).where(Route.route_id == route_id))
    route = result.scalar_one_or_none()
    
    if not route:
        return False
    
    new_route_id = await generate_route_for_staff(
        db, route.staff_id, route.route_date, optimization_priority
    )
    
    return new_route_id is not None
