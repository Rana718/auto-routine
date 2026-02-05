"""
Route Optimization Service - Updated for Quantity Splitting
Generates optimized routes for staff using store distance calculations
Correctly handles quantity_to_purchase field for split items
"""

from datetime import date, datetime, timedelta
from typing import List, Dict, Optional, Tuple
from decimal import Decimal
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from db.schema import (
    Staff, Store, Route, RouteStop, RouteStatus, StopStatus,
    PurchaseList, PurchaseListItem, ListStatus, StoreDistanceMatrix,
    Order, OrderItem, OrderStatus
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
    Now correctly sums quantity_to_purchase for each store.

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

    # Get unique stores to visit with total quantities
    # UPDATED: Sum quantity_to_purchase instead of just counting items
    result = await db.execute(
        select(
            Store.store_id,
            Store.store_name,
            Store.address,
            Store.latitude,
            Store.longitude,
            func.count(PurchaseListItem.list_item_id).label("items_count"),
            func.sum(PurchaseListItem.quantity_to_purchase).label("total_quantity")
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

    # Build store coordinates lookup
    store_coords = {
        s.store_id: (s.latitude, s.longitude)
        for s in stores if s.latitude and s.longitude
    }

    # Starting point (staff location or default Osaka coords)
    start_lat = staff.start_location_lat or Decimal("34.6937")  # Osaka
    start_lng = staff.start_location_lng or Decimal("135.5023")

    # Fetch pre-calculated distances from matrix for all store pairs
    store_ids = [s.store_id for s in stores]
    distance_cache = await _fetch_distance_cache(db, store_ids)

    # Generate optimized order using Nearest Neighbor algorithm
    # Pass both items_count and total_quantity
    optimized_order = nearest_neighbor_route(
        start_point=(start_lat, start_lng),
        stores=[(s.store_id, s.latitude, s.longitude, s.items_count, s.total_quantity or s.items_count) for s in stores],
        distance_cache=distance_cache
    )

    # Calculate total distance and time
    total_distance = 0.0
    estimated_time = 0

    # Average time per item (2 min per item + 5 min base per store + 5 min travel per km)
    SHOPPING_TIME_BASE_PER_STORE = 5  # minutes base time
    SHOPPING_TIME_PER_ITEM = 2  # minutes per item to purchase
    TRAVEL_TIME_PER_KM = 5  # minutes

    prev_lat, prev_lng = start_lat, start_lng
    prev_store_id: Optional[int] = None
    current_time = datetime.combine(target_date, datetime.strptime("10:00", "%H:%M").time())

    for seq, (store_id, lat, lng, items_count, total_qty) in enumerate(optimized_order):
        travel_time = 0
        if lat and lng:
            dist = _get_distance(prev_lat, prev_lng, lat, lng, prev_store_id, store_id, distance_cache)
            total_distance += dist
            travel_time = int(dist * TRAVEL_TIME_PER_KM)
            current_time += timedelta(minutes=travel_time)
            prev_lat, prev_lng = lat, lng
            prev_store_id = store_id

        # Get items to purchase at this store
        items_result = await db.execute(
            select(PurchaseListItem.item_id)
            .where(PurchaseListItem.list_id == purchase_list.list_id)
            .where(PurchaseListItem.store_id == store_id)
        )
        item_ids = [row[0] for row in items_result.all()]

        # Create route stop with quantity info
        stop = RouteStop(
            route_id=route.route_id,
            store_id=store_id,
            stop_sequence=seq + 1,
            estimated_arrival=current_time,
            items_to_purchase=item_ids,  # Store item IDs as JSON
            items_count=total_qty or items_count,  # Use total quantity
            stop_status=StopStatus.PENDING,
        )
        db.add(stop)

        # Add shopping time based on total quantity
        shopping_time = SHOPPING_TIME_BASE_PER_STORE + (total_qty or items_count) * SHOPPING_TIME_PER_ITEM
        current_time += timedelta(minutes=shopping_time)
        estimated_time += shopping_time + travel_time

    # Update route totals
    route.total_distance_km = Decimal(str(round(total_distance, 2)))
    route.estimated_time_minutes = estimated_time

    # Update purchase list status
    purchase_list.list_status = ListStatus.ASSIGNED

    # Update all related orders to IN_PROGRESS status
    result = await db.execute(
        select(Order)
        .join(OrderItem)
        .join(PurchaseListItem, PurchaseListItem.item_id == OrderItem.item_id)
        .where(PurchaseListItem.list_id == purchase_list.list_id)
        .distinct()
    )
    orders = result.scalars().all()
    for order in orders:
        if order.order_status == OrderStatus.ASSIGNED:
            order.order_status = OrderStatus.IN_PROGRESS

    await db.flush()
    return route.route_id


async def _fetch_distance_cache(
    db: AsyncSession,
    store_ids: List[int]
) -> Dict[Tuple[int, int], float]:
    """
    Fetch pre-calculated distances from StoreDistanceMatrix for given stores.
    Returns dict mapping (from_store_id, to_store_id) -> distance_km
    """
    if not store_ids:
        return {}

    result = await db.execute(
        select(StoreDistanceMatrix)
        .where(StoreDistanceMatrix.from_store_id.in_(store_ids))
        .where(StoreDistanceMatrix.to_store_id.in_(store_ids))
    )
    distances = result.scalars().all()

    return {
        (d.from_store_id, d.to_store_id): float(d.distance_km)
        for d in distances
    }


def _get_distance(
    lat1: Decimal, lng1: Decimal,
    lat2: Decimal, lng2: Decimal,
    store1_id: Optional[int],
    store2_id: Optional[int],
    distance_cache: Dict[Tuple[int, int], float]
) -> float:
    """
    Get distance between two points, using cache if available.
    Falls back to Haversine calculation if not in cache.
    """
    # Try cache first (for store-to-store distances)
    if store1_id and store2_id:
        cached = distance_cache.get((store1_id, store2_id))
        if cached is not None:
            return cached

    # Fall back to calculation
    return calculate_distance(lat1, lng1, lat2, lng2)


def nearest_neighbor_route(
    start_point: Tuple[Decimal, Decimal],
    stores: List[Tuple[int, Decimal, Decimal, int, int]],  # (store_id, lat, lng, items_count, total_qty)
    distance_cache: Optional[Dict[Tuple[int, int], float]] = None
) -> List[Tuple[int, Decimal, Decimal, int, int]]:
    """
    Nearest Neighbor algorithm for TSP-like route optimization.
    Greedy algorithm that always visits the nearest unvisited store.

    Uses pre-calculated distance cache when available for better performance.

    Returns stores in optimized order.
    """
    if not stores:
        return []

    if len(stores) == 1:
        return stores

    distance_cache = distance_cache or {}

    # Separate stores with and without coordinates
    stores_with_coords = [(s[0], s[1], s[2], s[3], s[4]) for s in stores if s[1] and s[2]]
    stores_without_coords = [(s[0], s[1], s[2], s[3], s[4]) for s in stores if not s[1] or not s[2]]

    if not stores_with_coords:
        return stores  # Can't optimize without coordinates

    result = []
    remaining = list(stores_with_coords)
    current_lat, current_lng = start_point
    current_store_id: Optional[int] = None  # Start point is not a store

    while remaining:
        # Find nearest unvisited store
        nearest_idx = 0
        nearest_dist = float('inf')

        for i, (store_id, lat, lng, items, qty) in enumerate(remaining):
            dist = _get_distance(
                current_lat, current_lng, lat, lng,
                current_store_id, store_id, distance_cache
            )
            if dist < nearest_dist:
                nearest_dist = dist
                nearest_idx = i

        # Visit this store
        store = remaining.pop(nearest_idx)
        result.append(store)
        current_lat, current_lng = store[1], store[2]
        current_store_id = store[0]

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


async def get_route_details_with_quantities(
    db: AsyncSession,
    route_id: int
) -> Optional[Dict]:
    """
    Get detailed route information including quantity breakdown per store.
    Useful for displaying purchase lists to staff.
    """
    result = await db.execute(select(Route).where(Route.route_id == route_id))
    route = result.scalar_one_or_none()
    if not route:
        return None

    # Get stops with store info
    result = await db.execute(
        select(RouteStop, Store)
        .join(Store, Store.store_id == RouteStop.store_id)
        .where(RouteStop.route_id == route_id)
        .order_by(RouteStop.stop_sequence)
    )

    stops_data = []
    for stop, store in result:
        # Get items for this stop
        items_result = await db.execute(
            select(PurchaseListItem, OrderItem)
            .join(OrderItem, OrderItem.item_id == PurchaseListItem.item_id)
            .where(PurchaseListItem.list_id == route.list_id)
            .where(PurchaseListItem.store_id == store.store_id)
        )

        items = []
        total_qty = 0
        for list_item, order_item in items_result:
            items.append({
                "list_item_id": list_item.list_item_id,
                "sku": order_item.sku,
                "product_name": order_item.product_name,
                "quantity_to_purchase": list_item.quantity_to_purchase,
                "purchase_status": list_item.purchase_status.value
            })
            total_qty += list_item.quantity_to_purchase

        stops_data.append({
            "stop_id": stop.stop_id,
            "stop_sequence": stop.stop_sequence,
            "store_id": store.store_id,
            "store_name": store.store_name,
            "address": store.address,
            "latitude": float(store.latitude) if store.latitude else None,
            "longitude": float(store.longitude) if store.longitude else None,
            "estimated_arrival": stop.estimated_arrival.isoformat() if stop.estimated_arrival else None,
            "stop_status": stop.stop_status.value,
            "items": items,
            "total_quantity": total_qty
        })

    return {
        "route_id": route.route_id,
        "staff_id": route.staff_id,
        "route_date": route.route_date.isoformat(),
        "route_status": route.route_status.value,
        "total_distance_km": float(route.total_distance_km) if route.total_distance_km else 0,
        "estimated_time_minutes": route.estimated_time_minutes or 0,
        "stops": stops_data
    }
