from datetime import datetime, date, time, timedelta
from typing import List, Tuple
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db.schema import Order, OrderItem, OrderStatus, ItemStatus


async def get_cutoff_settings(db: AsyncSession) -> Tuple[time, bool, bool]:
    """
    Get cutoff settings from BusinessRule table.
    Returns: (cutoff_time, weekend_processing, holiday_override)
    """
    from db.schema import BusinessRule, RuleType

    # Default values
    cutoff_time = time(13, 10)
    weekend_processing = False
    holiday_override = False

    # Try to get settings from database
    result = await db.execute(
        select(BusinessRule).where(
            BusinessRule.rule_type == RuleType.CUTOFF,
            BusinessRule.is_active == True
        )
    )
    rule = result.scalar_one_or_none()

    if rule and rule.rule_config:
        # Parse cutoff_time from string "HH:MM" format
        if "cutoff_time" in rule.rule_config:
            try:
                time_str = rule.rule_config["cutoff_time"]
                if isinstance(time_str, str) and ":" in time_str:
                    hours, minutes = map(int, time_str.split(":")[:2])
                    cutoff_time = time(hours, minutes)
            except (ValueError, TypeError):
                pass  # Keep default if parsing fails

        # Get weekend_processing setting
        if "weekend_processing" in rule.rule_config:
            weekend_processing = bool(rule.rule_config["weekend_processing"])

        # Get holiday_override setting
        if "holiday_override" in rule.rule_config:
            holiday_override = bool(rule.rule_config["holiday_override"])

    return cutoff_time, weekend_processing, holiday_override


async def apply_cutoff_logic(db: AsyncSession, order_date: datetime) -> date:
    """Determine target purchase date based on cutoff time from settings"""
    from db.schema import Holiday

    # Get settings from database
    cutoff_time, weekend_processing, holiday_override = await get_cutoff_settings(db)

    order_time = order_date.time()
    order_day = order_date.date()

    # Before cutoff -> today
    if order_time < cutoff_time:
        target_date = order_day
    else:
        # After cutoff -> next business day
        target_date = order_day + timedelta(days=1)

    # Skip weekends and holidays (unless overridden by settings)
    max_iterations = 30  # Safety limit
    iterations = 0

    while iterations < max_iterations:
        iterations += 1

        # Skip weekends (unless weekend_processing is enabled)
        if not weekend_processing and target_date.weekday() >= 5:  # 5=Saturday, 6=Sunday
            target_date += timedelta(days=1)
            continue

        # Check if holiday
        result = await db.execute(
            select(Holiday).where(Holiday.holiday_date == target_date)
        )
        holiday = result.scalar_one_or_none()

        if holiday:
            # If holiday_override is enabled globally, treat all holidays as working days
            if holiday_override:
                break
            # Otherwise, check the individual holiday's is_working flag
            if not holiday.is_working:
                target_date += timedelta(days=1)
                continue

        # Found a valid business day
        break

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

    # Get cutoff settings from database
    cutoff_time, _, _ = await get_cutoff_settings(db)

    # Apply cutoff logic
    order.target_purchase_date = await apply_cutoff_logic(db, order.order_date)
    order.cutoff_time = datetime.combine(order.order_date.date(), cutoff_time)

    # Split bundle items
    await split_bundle_items(db, order_id)

    await db.flush()
