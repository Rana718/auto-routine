from typing import List, Tuple
from decimal import Decimal
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db.schema import Route, RouteStop, Store, PurchaseList, PurchaseListItem, RouteStatus, StopStatus

from math import radians, cos, sin, asin, sqrt

def calculate_distance(lat1: Decimal, lon1: Decimal, lat2: Decimal, lon2: Decimal) -> float:
    """Calculate distance between two points using Haversine formula (in km)"""
    lat1, lon1, lat2, lon2 = map(float, [lat1, lon1, lat2, lon2])
    lat1, lon1, lat2, lon2 = map(radians, [lat1, lon1, lat2, lon2])
    
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlon/2)**2
    c = 2 * asin(sqrt(a))
    km = 6371 * c
    return km

def optimize_route_greedy(
    start_lat: Decimal,
    start_lon: Decimal,
    stores: List[Tuple[int, Decimal, Decimal]]
) -> List[int]:
    """Greedy nearest-neighbor route optimization"""
    if not stores:
        return []
    
    route = []
    current_lat, current_lon = start_lat, start_lon
    remaining = stores.copy()
    
    while remaining:
        # Find nearest store
        nearest = min(
            remaining,
            key=lambda s: calculate_distance(current_lat, current_lon, s[1], s[2])
        )
        route.append(nearest[0])
        current_lat, current_lon = nearest[1], nearest[2]
        remaining.remove(nearest)
    
    return route

async def generate_optimized_route(
    db: AsyncSession,
    list_id: int,
    staff_id: int
) -> int:
    """Generate optimized route for a purchase list"""
    
    # Get purchase list
    result = await db.execute(
        select(PurchaseList).where(PurchaseList.list_id == list_id)
    )
    purchase_list = result.scalar_one_or_none()
    
    if not purchase_list:
        return None
    
    # Get staff start location
    result = await db.execute(
        select(Store.latitude, Store.longitude)
        .join(PurchaseListItem, Store.store_id == PurchaseListItem.store_id)
        .where(PurchaseListItem.list_id == list_id)
        .distinct()
    )
    stores_data = result.all()
    
    # Get unique stores with locations
    result = await db.execute(
        select(Store.store_id, Store.latitude, Store.longitude)
        .join(PurchaseListItem, Store.store_id == PurchaseListItem.store_id)
        .where(PurchaseListItem.list_id == list_id)
        .distinct()
    )
    stores = [(s[0], s[1], s[2]) for s in result.all()]
    
    # Default start location (office)
    start_lat = Decimal("35.6762")  # Tokyo default
    start_lon = Decimal("139.6503")
    
    # Optimize route
    optimized_order = optimize_route_greedy(start_lat, start_lon, stores)
    
    # Calculate total distance
    total_distance = Decimal("0")
    current_lat, current_lon = start_lat, start_lon
    for store_id, store_lat, store_lon in [(s[0], s[1], s[2]) for s in stores if s[0] in optimized_order]:
        distance = calculate_distance(current_lat, current_lon, store_lat, store_lon)
        total_distance += Decimal(str(distance))
        current_lat, current_lon = store_lat, store_lon
    
    # Create route
    route = Route(
        list_id=list_id,
        staff_id=staff_id,
        route_date=purchase_list.purchase_date,
        start_location_lat=start_lat,
        start_location_lng=start_lon,
        route_status=RouteStatus.NOT_STARTED,
        total_distance_km=total_distance,
        estimated_time_minutes=len(optimized_order) * 30
    )
    db.add(route)
    await db.flush()
    
    # Create route stops
    for sequence, store_id in enumerate(optimized_order, start=1):
        # Count items for this store
        result = await db.execute(
            select(PurchaseListItem)
            .where(PurchaseListItem.list_id == list_id)
            .where(PurchaseListItem.store_id == store_id)
        )
        items = result.scalars().all()
        
        stop = RouteStop(
            route_id=route.route_id,
            store_id=store_id,
            stop_sequence=sequence,
            items_count=len(items),
            stop_status=StopStatus.PENDING
        )
        db.add(stop)
    
    await db.flush()
    return route.route_id
