"""
Store Selection Service - OPTIMIZED with Quantity Splitting
Selects optimal stores for each item and splits quantities across multiple stores
"""

from typing import List, Dict, Optional, Tuple
from decimal import Decimal
from dataclasses import dataclass
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from db.schema import (
    Store, Product, ProductStoreMapping, StoreInventory, StoreDistanceMatrix,
    StockStatus, OrderItem
)


@dataclass
class StoreAllocation:
    """Represents allocation of quantity to a store"""
    store_id: int
    store_name: str
    quantity: int
    score: float


@dataclass
class ItemAllocation:
    """Represents all store allocations for an item"""
    item_id: int
    sku: str
    total_quantity: int
    allocations: List[StoreAllocation]
    remaining_quantity: int  # Quantity that couldn't be allocated


async def allocate_quantities_to_stores(
    db: AsyncSession,
    items: List[OrderItem],
    staff_id: Optional[int] = None
) -> Dict[int, ItemAllocation]:
    """
    CORE FUNCTION: Allocates item quantities across multiple stores

    For each item:
    1. Get all stores that sell this product
    2. Score each store by priority/distance/availability
    3. Allocate quantities starting from highest-scored store
    4. Continue until total quantity is fulfilled or no more stores available

    Returns: Dict[item_id, ItemAllocation]
    """
    from db.schema import Staff

    # Get staff location for distance scoring
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
    mappings_by_product: Dict[int, List[Tuple]] = {}
    for mapping, store in mappings_result:
        if mapping.product_id not in mappings_by_product:
            mappings_by_product[mapping.product_id] = []
        mappings_by_product[mapping.product_id].append((mapping, store))

    # Process each item
    allocations: Dict[int, ItemAllocation] = {}

    for item in items:
        product = products_by_sku.get(item.sku)
        if not product:
            allocations[item.item_id] = ItemAllocation(
                item_id=item.item_id,
                sku=item.sku,
                total_quantity=item.quantity,
                allocations=[],
                remaining_quantity=item.quantity
            )
            continue

        # Check if store-fixed (must buy from single store)
        if product.is_store_fixed and product.fixed_store_id:
            # Get store name
            store_result = await db.execute(
                select(Store).where(Store.store_id == product.fixed_store_id)
            )
            fixed_store = store_result.scalar_one_or_none()
            store_name = fixed_store.store_name if fixed_store else "Unknown"

            allocations[item.item_id] = ItemAllocation(
                item_id=item.item_id,
                sku=item.sku,
                total_quantity=item.quantity,
                allocations=[StoreAllocation(
                    store_id=product.fixed_store_id,
                    store_name=store_name,
                    quantity=item.quantity,
                    score=100.0
                )],
                remaining_quantity=0
            )
            continue

        # Get candidate stores
        candidates = mappings_by_product.get(product.product_id, [])
        if not candidates:
            allocations[item.item_id] = ItemAllocation(
                item_id=item.item_id,
                sku=item.sku,
                total_quantity=item.quantity,
                allocations=[],
                remaining_quantity=item.quantity
            )
            continue

        # Score each candidate store
        scored_stores = []
        for mapping, store in candidates:
            score = calculate_store_score(mapping, store, staff_location)
            available_qty = get_available_quantity(mapping)
            scored_stores.append({
                'store_id': store.store_id,
                'store_name': store.store_name,
                'score': score,
                'available_quantity': available_qty,
                'mapping': mapping
            })

        # Sort by score descending
        scored_stores.sort(key=lambda x: x['score'], reverse=True)

        # Allocate quantities across stores
        remaining = item.quantity
        item_allocations = []

        for store_data in scored_stores:
            if remaining <= 0:
                break

            # Determine how much we can buy from this store
            available = store_data['available_quantity']
            to_buy = min(remaining, available) if available is not None else remaining

            if to_buy > 0:
                item_allocations.append(StoreAllocation(
                    store_id=store_data['store_id'],
                    store_name=store_data['store_name'],
                    quantity=to_buy,
                    score=store_data['score']
                ))
                remaining -= to_buy

        allocations[item.item_id] = ItemAllocation(
            item_id=item.item_id,
            sku=item.sku,
            total_quantity=item.quantity,
            allocations=item_allocations,
            remaining_quantity=remaining
        )

    return allocations


def calculate_store_score(mapping: ProductStoreMapping, store: Store, staff_location: Optional[Tuple] = None) -> float:
    """Calculate score for a store based on multiple factors"""
    score = 0.0

    # Stock availability score
    if mapping.stock_status == StockStatus.IN_STOCK:
        score += 100
    elif mapping.stock_status == StockStatus.LOW_STOCK:
        score += 50
    elif mapping.stock_status == StockStatus.UNKNOWN:
        score += 25
    # OUT_OF_STOCK and DISCONTINUED get 0

    # Priority score (store priority)
    score += max(0, 10 - store.priority_level) * 5

    # Mapping priority (product-specific priority at this store)
    if mapping.priority:
        score += max(0, 10 - mapping.priority) * 3

    # Primary store bonus
    if mapping.is_primary_store:
        score += 20

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

    return score


def get_available_quantity(mapping: ProductStoreMapping) -> Optional[int]:
    """Get available quantity from a store for a product"""
    # If current_available is set, use it
    if mapping.current_available is not None:
        return mapping.current_available

    # If max_daily_quantity is set, use it as estimate
    if mapping.max_daily_quantity is not None:
        return mapping.max_daily_quantity

    # If stock status indicates unavailable
    if mapping.stock_status in [StockStatus.OUT_OF_STOCK, StockStatus.DISCONTINUED]:
        return 0

    # No limit known - return None (means unlimited)
    return None


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


# ============================================================================
# LEGACY FUNCTIONS (kept for backward compatibility)
# ============================================================================

async def get_stores_for_items_batch(
    db: AsyncSession,
    items: List[OrderItem],
    staff_id: Optional[int] = None
) -> Dict[int, int]:
    """
    LEGACY: Returns single store per item (backward compatible)
    For new code, use allocate_quantities_to_stores() instead

    Returns a dict mapping item_id -> store_id (first/best store only)
    """
    allocations = await allocate_quantities_to_stores(db, items, staff_id)

    result = {}
    for item_id, allocation in allocations.items():
        if allocation.allocations:
            result[item_id] = allocation.allocations[0].store_id

    return result


async def select_store_for_item(
    db: AsyncSession,
    item: OrderItem,
    staff_location: Optional[Tuple[Decimal, Decimal]] = None,
    excluded_stores: List[int] = None
) -> Optional[int]:
    """
    LEGACY: Select single store for an item
    For new code, use allocate_quantities_to_stores() instead
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
