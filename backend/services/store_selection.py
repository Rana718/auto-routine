"""
Store Selection Service - OPTIMIZED
Selects the optimal store for each item based on distance, priority, and availability
"""

from typing import List, Dict, Optional, Tuple
from decimal import Decimal
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from db.schema import (
    Store, Product, ProductStoreMapping, StoreInventory, StoreDistanceMatrix,
    StockStatus, OrderItem
)


async def get_stores_for_items_batch(
    db: AsyncSession,
    items: List[OrderItem],
    staff_id: Optional[int] = None
) -> Dict[int, int]:
    """
    OPTIMIZED: Batch fetch all products and mappings to eliminate N+1 queries
    Returns a dict mapping item_id -> store_id
    """
    from db.schema import Staff
    
    staff_location = None
    if staff_id:
        result = await db.execute(select(Staff).where(Staff.staff_id == staff_id))
        staff = result.scalar_one_or_none()
        if staff and staff.start_location_lat and staff.start_location_lng:
            staff_location = (staff.start_location_lat, staff.start_location_lng)
    
    # Batch fetch all products by SKU
    skus = [item.sku for item in items]
    products_result = await db.execute(
        select(Product).where(Product.sku.in_(skus))
    )
    products_by_sku = {p.sku: p for p in products_result.scalars().all()}
    
    # Batch fetch all store mappings for these products
    product_ids = [p.product_id for p in products_by_sku.values()]
    if not product_ids:
        return {}
    
    mappings_result = await db.execute(
        select(ProductStoreMapping, Store)
        .join(Store, Store.store_id == ProductStoreMapping.store_id)
        .where(ProductStoreMapping.product_id.in_(product_ids))
        .where(Store.is_active == True)
    )
    
    # Build lookup structure: product_id -> [(mapping, store), ...]
    mappings_by_product = {}
    for mapping, store in mappings_result:
        if mapping.product_id not in mappings_by_product:
            mappings_by_product[mapping.product_id] = []
        mappings_by_product[mapping.product_id].append((mapping, store))
    
    # Score and assign stores for each item
    item_stores = {}
    for item in items:
        product = products_by_sku.get(item.sku)
        if not product:
            continue
        
        # Check if store-fixed
        if product.is_store_fixed and product.fixed_store_id:
            item_stores[item.item_id] = product.fixed_store_id
            continue
        
        # Get candidate stores
        candidates = mappings_by_product.get(product.product_id, [])
        if not candidates:
            continue
        
        # Score each candidate
        best_store_id = None
        best_score = -1
        
        for mapping, store in candidates:
            score = 0
            
            # Stock availability score
            if mapping.stock_status == StockStatus.IN_STOCK:
                score += 100
            elif mapping.stock_status == StockStatus.LOW_STOCK:
                score += 50
            elif mapping.stock_status == StockStatus.UNKNOWN:
                score += 25
            
            # Priority score
            score += max(0, 10 - store.priority_level) * 5
            if mapping.priority:
                score += max(0, 10 - mapping.priority) * 3
            
            # Distance score
            if staff_location and store.latitude and store.longitude:
                distance = calculate_distance(
                    staff_location[0], staff_location[1],
                    store.latitude, store.longitude
                )
                if distance < 1:
                    score += 50
                elif distance < 3:
                    score += 30
                elif distance < 5:
                    score += 15
                elif distance < 10:
                    score += 5
            
            if score > best_score:
                best_score = score
                best_store_id = store.store_id
        
        if best_store_id:
            item_stores[item.item_id] = best_store_id
    
    return item_stores


def calculate_distance(lat1: Decimal, lng1: Decimal, lat2: Decimal, lng2: Decimal) -> float:
    """Calculate approximate distance in km using Haversine formula"""
    import math
    
    lat1_f = float(lat1)
    lng1_f = float(lng1)
    lat2_f = float(lat2)
    lng2_f = float(lng2)
    
    R = 6371  # Earth's radius in km
    
    lat1_rad = math.radians(lat1_f)
    lat2_rad = math.radians(lat2_f)
    delta_lat = math.radians(lat2_f - lat1_f)
    delta_lng = math.radians(lng2_f - lng1_f)
    
    a = math.sin(delta_lat/2)**2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(delta_lng/2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
    
    return R * c


async def select_store_for_item(
    db: AsyncSession, 
    item: OrderItem,
    staff_location: Optional[Tuple[Decimal, Decimal]] = None,
    excluded_stores: List[int] = None
) -> Optional[int]:
    """
    Select the optimal store for purchasing an item.
    Note: For batch operations, use get_stores_for_items_batch() instead
    """
    excluded_stores = excluded_stores or []
    
    # Get product
    result = await db.execute(
        select(Product).where(Product.sku == item.sku)
    )
    product = result.scalar_one_or_none()
    
    if product and product.is_store_fixed and product.fixed_store_id:
        if product.fixed_store_id not in excluded_stores:
            return product.fixed_store_id
    
    # Get candidate stores
    query = (
        select(
            Store.store_id,
            Store.store_name,
            Store.priority_level,
            Store.latitude,
            Store.longitude,
            ProductStoreMapping.stock_status,
            ProductStoreMapping.priority.label("mapping_priority")
        )
        .join(ProductStoreMapping, ProductStoreMapping.store_id == Store.store_id)
        .join(Product, Product.product_id == ProductStoreMapping.product_id)
        .where(Product.sku == item.sku)
        .where(Store.is_active == True)
    )
    
    if excluded_stores:
        query = query.where(~Store.store_id.in_(excluded_stores))
    
    result = await db.execute(query)
    candidates = result.all()
    
    if not candidates:
        if product and product.category:
            result = await db.execute(
                select(Store.store_id)
                .where(Store.is_active == True)
                .where(Store.category == product.category)
                .where(~Store.store_id.in_(excluded_stores) if excluded_stores else True)
                .order_by(Store.priority_level)
                .limit(1)
            )
            fallback = result.scalar_one_or_none()
            return fallback
        return None
    
    # Score each candidate
    scored_stores = []
    for store in candidates:
        score = 0
        
        if store.stock_status == StockStatus.IN_STOCK:
            score += 100
        elif store.stock_status == StockStatus.LOW_STOCK:
            score += 50
        elif store.stock_status == StockStatus.UNKNOWN:
            score += 25
        
        score += max(0, 10 - store.priority_level) * 5
        
        if store.mapping_priority:
            score += max(0, 10 - store.mapping_priority) * 3
        
        if staff_location and store.latitude and store.longitude:
            distance = calculate_distance(
                staff_location[0], staff_location[1],
                store.latitude, store.longitude
            )
            if distance < 1:
                score += 50
            elif distance < 3:
                score += 30
            elif distance < 5:
                score += 15
            elif distance < 10:
                score += 5
        
        scored_stores.append((store.store_id, score))
    
    scored_stores.sort(key=lambda x: x[1], reverse=True)
    
    return scored_stores[0][0] if scored_stores else None
