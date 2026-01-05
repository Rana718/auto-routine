"""
Store Distance Matrix Service
Pre-calculates distances between all active stores for route optimization
"""

from datetime import datetime
from typing import List, Tuple
from decimal import Decimal
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from db.schema import Store, StoreDistanceMatrix
from services.store_selection import calculate_distance


async def calculate_store_distance_matrix(db: AsyncSession) -> int:
    """
    Pre-calculate distances between all active stores.
    Returns the number of distance pairs calculated.
    """
    # Get all active stores with coordinates
    result = await db.execute(
        select(Store).where(
            Store.is_active == True,
            Store.latitude.isnot(None),
            Store.longitude.isnot(None)
        )
    )
    stores = result.scalars().all()
    
    if len(stores) < 2:
        return 0
    
    calculated_count = 0
    
    # Calculate distances for all pairs
    for store1 in stores:
        for store2 in stores:
            if store1.store_id == store2.store_id:
                continue
            
            # Check if distance already exists
            result = await db.execute(
                select(StoreDistanceMatrix).where(
                    StoreDistanceMatrix.from_store_id == store1.store_id,
                    StoreDistanceMatrix.to_store_id == store2.store_id
                )
            )
            existing = result.scalar_one_or_none()
            
            # Calculate distance
            distance = calculate_distance(
                store1.latitude, store1.longitude,
                store2.latitude, store2.longitude
            )
            
            # Estimate travel time (assume 25 km/h average in urban area)
            travel_time = int(distance / 25 * 60)
            
            if existing:
                # Update existing record
                existing.distance_km = Decimal(str(round(distance, 2)))
                existing.travel_time_minutes = travel_time
                existing.last_calculated = datetime.utcnow()
            else:
                # Create new record
                matrix_entry = StoreDistanceMatrix(
                    from_store_id=store1.store_id,
                    to_store_id=store2.store_id,
                    distance_km=Decimal(str(round(distance, 2))),
                    travel_time_minutes=travel_time,
                    last_calculated=datetime.utcnow()
                )
                db.add(matrix_entry)
            
            calculated_count += 1
    
    await db.commit()
    return calculated_count


async def get_distance_between_stores(
    db: AsyncSession,
    from_store_id: int,
    to_store_id: int
) -> Tuple[float, int]:
    """
    Get pre-calculated distance and travel time between two stores.
    Returns (distance_km, travel_time_minutes) or calculates on-the-fly if not cached.
    """
    # Try to get from cache
    result = await db.execute(
        select(StoreDistanceMatrix).where(
            StoreDistanceMatrix.from_store_id == from_store_id,
            StoreDistanceMatrix.to_store_id == to_store_id
        )
    )
    cached = result.scalar_one_or_none()
    
    if cached:
        return (float(cached.distance_km), cached.travel_time_minutes or 0)
    
    # Calculate on-the-fly
    result = await db.execute(
        select(Store).where(Store.store_id.in_([from_store_id, to_store_id]))
    )
    stores = {s.store_id: s for s in result.scalars().all()}
    
    if from_store_id not in stores or to_store_id not in stores:
        return (0.0, 0)
    
    store1 = stores[from_store_id]
    store2 = stores[to_store_id]
    
    if not all([store1.latitude, store1.longitude, store2.latitude, store2.longitude]):
        return (0.0, 0)
    
    distance = calculate_distance(
        store1.latitude, store1.longitude,
        store2.latitude, store2.longitude
    )
    travel_time = int(distance / 25 * 60)
    
    return (distance, travel_time)


async def get_nearest_stores(
    db: AsyncSession,
    from_store_id: int,
    limit: int = 10
) -> List[Tuple[int, float, int]]:
    """
    Get nearest stores from a given store.
    Returns list of (store_id, distance_km, travel_time_minutes) sorted by distance.
    """
    result = await db.execute(
        select(StoreDistanceMatrix).where(
            StoreDistanceMatrix.from_store_id == from_store_id
        ).order_by(StoreDistanceMatrix.distance_km).limit(limit)
    )
    distances = result.scalars().all()
    
    return [
        (d.to_store_id, float(d.distance_km), d.travel_time_minutes or 0)
        for d in distances
    ]
