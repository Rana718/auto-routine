from typing import List, Optional
from fastapi import HTTPException
from sqlalchemy import select, func, case
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import date

from db.schema import Store, StoreCreate, StoreResponse, PurchaseListItem, PurchaseList
from models.stores import StoreStats, StoreWithOrders, StoreUpdate

async def get_all_stores(
    db: AsyncSession,
    active_only: bool,
    category: Optional[str],
    district: Optional[str],
    search: Optional[str],
    skip: int,
    limit: int
) -> List[StoreWithOrders]:
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
    
    # Batch query for order counts to avoid N+1
    store_ids = [s.store_id for s in stores]
    today = date.today()
    
    orders_query = select(
        PurchaseListItem.store_id,
        func.count(PurchaseListItem.list_item_id).label('count')
    ).join(
        PurchaseList, PurchaseListItem.list_id == PurchaseList.list_id
    ).where(
        PurchaseListItem.store_id.in_(store_ids),
        PurchaseList.purchase_date == today
    ).group_by(PurchaseListItem.store_id)
    
    orders_result = await db.execute(orders_query)
    order_counts = {row[0]: row[1] for row in orders_result.all()}
    
    return [
        StoreWithOrders(
            store_id=s.store_id,
            store_name=s.store_name,
            store_code=s.store_code,
            address=s.address,
            district=s.district,
            category=s.category,
            latitude=s.latitude,
            longitude=s.longitude,
            opening_hours=s.opening_hours,
            priority_level=s.priority_level,
            is_active=s.is_active,
            orders_today=order_counts.get(s.store_id, 0),
        )
        for s in stores
    ]

async def get_store_statistics(db: AsyncSession) -> StoreStats:
    # OPTIMIZED: Single query for store counts
    store_query = select(
        func.count(Store.store_id).label('total'),
        func.sum(case((Store.is_active == True, 1), else_=0)).label('active')
    )
    store_result = await db.execute(store_query)
    store_row = store_result.one()
    
    # Get stores with orders and total orders in single query
    today = date.today()
    orders_query = select(
        func.count(func.distinct(PurchaseListItem.store_id)).label('stores_with_orders'),
        func.count(PurchaseListItem.list_item_id).label('total_orders')
    ).join(
        PurchaseList, PurchaseListItem.list_id == PurchaseList.list_id
    ).where(
        PurchaseList.purchase_date == today
    )
    orders_result = await db.execute(orders_query)
    orders_row = orders_result.one()
    
    return StoreStats(
        total_stores=store_row.total or 0,
        active_stores=store_row.active or 0,
        stores_with_orders=orders_row.stores_with_orders or 0,
        total_orders_today=orders_row.total_orders or 0,
    )

async def get_store_categories(db: AsyncSession):
    result = await db.execute(
        select(Store.category).where(Store.category.isnot(None)).distinct()
    )
    categories = [row[0] for row in result.all()]
    return {"categories": categories}

async def get_store_districts(db: AsyncSession):
    result = await db.execute(
        select(Store.district).where(Store.district.isnot(None)).distinct()
    )
    districts = [row[0] for row in result.all()]
    return {"districts": districts}

async def get_store_by_id(db: AsyncSession, store_id: int) -> StoreWithOrders:
    result = await db.execute(select(Store).where(Store.store_id == store_id))
    store = result.scalar_one_or_none()
    if not store:
        raise HTTPException(status_code=404, detail="店舗が見つかりません")
    
    return StoreWithOrders(
        store_id=store.store_id,
        store_name=store.store_name,
        store_code=store.store_code,
        address=store.address,
        district=store.district,
        category=store.category,
        orders_today=0,
    )

async def create_new_store(db: AsyncSession, store_data: StoreCreate) -> StoreResponse:
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

async def update_store_controller(db: AsyncSession, store_id: int, update: StoreUpdate) -> StoreResponse:
    result = await db.execute(select(Store).where(Store.store_id == store_id))
    store = result.scalar_one_or_none()
    if not store:
        raise HTTPException(status_code=404, detail="店舗が見つかりません")
    
    for field, value in update.model_dump(exclude_unset=True).items():
        setattr(store, field, value)
    
    await db.flush()
    await db.refresh(store)
    return store

async def delete_store_controller(db: AsyncSession, store_id: int):
    result = await db.execute(select(Store).where(Store.store_id == store_id))
    store = result.scalar_one_or_none()
    if not store:
        raise HTTPException(status_code=404, detail="店舗が見つかりません")
    
    store.is_active = False
    return {"message": "店舗を無効化しました"}
