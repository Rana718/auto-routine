from typing import List, Tuple
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from decimal import Decimal

from db.schema import Store, Product, ProductStoreMapping, StockStatus, OrderItem

async def select_store_for_item(
    db: AsyncSession,
    item: OrderItem,
    staff_location: Tuple[Decimal, Decimal] = None
) -> int:
    """Select best store for an item based on distance, priority, and availability"""
    
    # Get product info
    result = await db.execute(
        select(Product).where(Product.sku == item.sku)
    )
    product = result.scalar_one_or_none()
    
    if not product:
        return None
    
    # If store-fixed, return that store
    if product.is_store_fixed and product.fixed_store_id:
        return product.fixed_store_id
    
    # Get candidate stores
    result = await db.execute(
        select(ProductStoreMapping, Store)
        .join(Store, ProductStoreMapping.store_id == Store.store_id)
        .where(ProductStoreMapping.product_id == product.product_id)
        .where(Store.is_active == True)
        .where(ProductStoreMapping.stock_status.in_([StockStatus.IN_STOCK, StockStatus.LOW_STOCK]))
        .order_by(Store.priority_level, ProductStoreMapping.priority)
    )
    candidates = result.all()
    
    if not candidates:
        return None
    
    # If staff location provided, select nearest store
    if staff_location and staff_location[0] and staff_location[1]:
        from math import radians, cos, sin, asin, sqrt
        
        def haversine(lat1, lon1, lat2, lon2):
            lat1, lon1, lat2, lon2 = map(float, [lat1, lon1, lat2, lon2])
            lat1, lon1, lat2, lon2 = map(radians, [lat1, lon1, lat2, lon2])
            dlat = lat2 - lat1
            dlon = lon2 - lon1
            a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlon/2)**2
            c = 2 * asin(sqrt(a))
            return 6371 * c
        
        best_mapping, best_store = min(
            candidates,
            key=lambda c: haversine(staff_location[0], staff_location[1], c[1].latitude, c[1].longitude)
        )
        return best_store.store_id
    
    # Otherwise, return highest priority store
    best_mapping, best_store = candidates[0]
    return best_store.store_id

async def assign_stores_to_items(db: AsyncSession, item_ids: List[int]):
    """Assign stores to multiple items"""
    result = await db.execute(
        select(OrderItem).where(OrderItem.item_id.in_(item_ids))
    )
    items = result.scalars().all()
    
    assignments = []
    for item in items:
        store_id = await select_store_for_item(db, item)
        if store_id:
            assignments.append({
                "item_id": item.item_id,
                "store_id": store_id,
                "sku": item.sku,
                "product_name": item.product_name
            })
    
    return assignments
