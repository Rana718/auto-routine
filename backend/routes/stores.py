"""
Stores API routes
"""
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from db.db import get_db
from db.schema import Store, StoreCreate, StoreResponse

router = APIRouter()


# ============================================================================
# SCHEMAS
# ============================================================================

class StoreStats(BaseModel):
    total_stores: int
    active_stores: int
    stores_with_orders: int
    total_orders_today: int


class StoreWithOrders(StoreResponse):
    orders_today: int = 0


class StoreUpdate(BaseModel):
    store_name: Optional[str] = None
    address: Optional[str] = None
    district: Optional[str] = None
    category: Optional[str] = None
    opening_hours: Optional[dict] = None
    priority_level: Optional[int] = None
    is_active: Optional[bool] = None


# ============================================================================
# ROUTES
# ============================================================================

@router.get("/", response_model=List[StoreWithOrders])
async def get_stores(
    db: AsyncSession = Depends(get_db),
    active_only: bool = True,
    category: Optional[str] = None,
    district: Optional[str] = None,
    search: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
):
    """Get all stores with optional filters"""
    query = select(Store)
    
    if active_only:
        query = query.where(Store.is_active == True)
    if category:
        query = query.where(Store.category == category)
    if district:
        query = query.where(Store.district == district)
    if search:
        query = query.where(
            Store.store_name.ilike(f"%{search}%") |
            Store.district.ilike(f"%{search}%")
        )
    
    query = query.order_by(Store.priority_level, Store.store_name).offset(skip).limit(limit)
    result = await db.execute(query)
    stores = result.scalars().all()
    
    # TODO: Add actual order counts
    return [
        StoreWithOrders(
            store_id=s.store_id,
            store_name=s.store_name,
            store_code=s.store_code,
            address=s.address,
            district=s.district,
            latitude=s.latitude,
            longitude=s.longitude,
            opening_hours=s.opening_hours,
            category=s.category,
            priority_level=s.priority_level,
            is_active=s.is_active,
            created_at=s.created_at,
            orders_today=0,
        )
        for s in stores
    ]


@router.get("/stats", response_model=StoreStats)
async def get_store_stats(
    db: AsyncSession = Depends(get_db),
):
    """Get store statistics for dashboard"""
    # Total stores
    result = await db.execute(select(func.count(Store.store_id)))
    total = result.scalar() or 0
    
    # Active stores
    result = await db.execute(
        select(func.count(Store.store_id)).where(Store.is_active == True)
    )
    active = result.scalar() or 0
    
    return StoreStats(
        total_stores=total,
        active_stores=active,
        stores_with_orders=0,  # TODO: Calculate from purchase lists
        total_orders_today=0,
    )


@router.get("/categories")
async def get_categories(
    db: AsyncSession = Depends(get_db),
):
    """Get list of unique store categories"""
    result = await db.execute(
        select(Store.category)
        .where(Store.category.isnot(None))
        .distinct()
    )
    categories = [row[0] for row in result.all()]
    return {"categories": categories}


@router.get("/districts")
async def get_districts(
    db: AsyncSession = Depends(get_db),
):
    """Get list of unique store districts"""
    result = await db.execute(
        select(Store.district)
        .where(Store.district.isnot(None))
        .distinct()
    )
    districts = [row[0] for row in result.all()]
    return {"districts": districts}


@router.get("/{store_id}", response_model=StoreWithOrders)
async def get_store(
    store_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Get single store by ID"""
    result = await db.execute(
        select(Store).where(Store.store_id == store_id)
    )
    store = result.scalar_one_or_none()
    
    if not store:
        raise HTTPException(status_code=404, detail="店舗が見つかりません")
    
    return StoreWithOrders(
        store_id=store.store_id,
        store_name=store.store_name,
        store_code=store.store_code,
        address=store.address,
        district=store.district,
        latitude=store.latitude,
        longitude=store.longitude,
        opening_hours=store.opening_hours,
        category=store.category,
        priority_level=store.priority_level,
        is_active=store.is_active,
        created_at=store.created_at,
        orders_today=0,
    )


@router.post("/", response_model=StoreResponse)
async def create_store(
    store_data: StoreCreate,
    db: AsyncSession = Depends(get_db),
):
    """Create a new store"""
    store = Store(
        store_name=store_data.store_name,
        store_code=store_data.store_code,
        address=store_data.address,
        district=store_data.district,
        latitude=store_data.latitude,
        longitude=store_data.longitude,
        opening_hours=store_data.opening_hours,
        category=store_data.category,
        priority_level=store_data.priority_level,
        is_active=True,
    )
    
    db.add(store)
    await db.flush()
    await db.refresh(store)
    
    return store


@router.patch("/{store_id}", response_model=StoreResponse)
async def update_store(
    store_id: int,
    update: StoreUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Update store details"""
    result = await db.execute(select(Store).where(Store.store_id == store_id))
    store = result.scalar_one_or_none()
    
    if not store:
        raise HTTPException(status_code=404, detail="店舗が見つかりません")
    
    for field, value in update.model_dump(exclude_unset=True).items():
        setattr(store, field, value)
    
    await db.flush()
    await db.refresh(store)
    
    return store


@router.delete("/{store_id}")
async def delete_store(
    store_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Deactivate a store (soft delete)"""
    result = await db.execute(select(Store).where(Store.store_id == store_id))
    store = result.scalar_one_or_none()
    
    if not store:
        raise HTTPException(status_code=404, detail="店舗が見つかりません")
    
    store.is_active = False
    
    return {"message": "店舗を無効化しました"}
