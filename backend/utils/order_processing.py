from datetime import datetime, date, time
from typing import List
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db.schema import Order, OrderItem, OrderStatus, ItemStatus

async def apply_cutoff_logic(db: AsyncSession, order_date: datetime) -> date:
    """Determine target purchase date based on cutoff time (13:10)"""
    cutoff_time = time(13, 10)
    order_time = order_date.time()
    order_day = order_date.date()
    
    # Before cutoff -> today
    if order_time < cutoff_time:
        target_date = order_day
    else:
        # After cutoff -> next business day
        from datetime import timedelta
        target_date = order_day + timedelta(days=1)
        
        # Skip weekends
        while target_date.weekday() >= 5:  # 5=Saturday, 6=Sunday
            target_date += timedelta(days=1)
    
    return target_date

async def split_bundle_items(db: AsyncSession, order_id: int):
    """Split bundle/set products into individual items"""
    from sqlalchemy import select
    from db.schema import Product
    
    result = await db.execute(
        select(OrderItem).where(OrderItem.order_id == order_id).where(OrderItem.is_bundle == True)
    )
    bundle_items = result.scalars().all()
    
    for bundle in bundle_items:
        bundle.item_status = ItemStatus.ASSIGNED
        
        # Get product info for bundle splitting rules
        result = await db.execute(select(Product).where(Product.sku == bundle.sku))
        product = result.scalar_one_or_none()
        
        if product and product.set_split_rule:
            # Split based on rules (e.g., {"items": [{"sku": "A", "qty": 2}, {"sku": "B", "qty": 1}]})
            for item_rule in product.set_split_rule.get("items", []):
                child_item = OrderItem(
                    order_id=order_id,
                    sku=item_rule["sku"],
                    product_name=f"{bundle.product_name} - {item_rule['sku']}",
                    quantity=item_rule["qty"] * bundle.quantity,
                    unit_price=None,
                    is_bundle=False,
                    parent_item_id=bundle.item_id,
                    item_status=ItemStatus.PENDING
                )
                db.add(child_item)

async def process_order_with_cutoff(db: AsyncSession, order_id: int):
    """Process order: apply cutoff, split bundles"""
    result = await db.execute(select(Order).where(Order.order_id == order_id))
    order = result.scalar_one_or_none()
    
    if not order:
        return
    
    # Apply cutoff logic
    order.target_purchase_date = await apply_cutoff_logic(db, order.order_date)
    order.cutoff_time = datetime.combine(order.order_date.date(), time(13, 10))
    
    # Split bundle items
    await split_bundle_items(db, order_id)
    
    await db.flush()
