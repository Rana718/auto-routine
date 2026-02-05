"""
Staff Assignment Service - OPTIMIZED with Quantity Splitting
Automatically assigns orders and items to staff members
Supports splitting item quantities across multiple stores
"""

from datetime import date
from typing import List, Dict, Optional
from decimal import Decimal
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from db.schema import (
    Staff, StaffStatus, StaffRole, Order, OrderItem, OrderStatus, ItemStatus,
    PurchaseList, PurchaseListItem, PurchaseStatus, ListStatus, Store
)
from services.store_selection import allocate_quantities_to_stores, calculate_distance


async def auto_assign_daily_orders(db: AsyncSession, target_date: date) -> Dict[str, int]:
    """
    OPTIMIZED: Assigns orders to staff with quantity splitting across stores

    Key changes from previous version:
    - Creates multiple PurchaseListItems per OrderItem (one per store allocation)
    - Each PurchaseListItem has quantity_to_purchase field
    - Supports splitting a single order item across multiple stores
    """

    # Get available buyer staff
    result = await db.execute(
        select(Staff)
        .where(Staff.is_active == True)
        .where(Staff.role == StaffRole.BUYER)
        .where(Staff.status != StaffStatus.OFF_DUTY)
        .order_by(Staff.staff_id)
    )
    available_staff = result.scalars().all()

    if not available_staff:
        return {"message": "稼働中のスタッフがいません", "assigned_count": 0}

    # Get pending orders
    result = await db.execute(
        select(Order)
        .where(Order.target_purchase_date == target_date)
        .where(Order.order_status == OrderStatus.PENDING)
    )
    pending_orders = result.scalars().all()

    if not pending_orders:
        return {"message": "割当対象の注文がありません", "assigned_count": 0}

    # Get pending items (exclude bundles - they should be split first)
    order_ids = [o.order_id for o in pending_orders]
    result = await db.execute(
        select(OrderItem)
        .where(OrderItem.order_id.in_(order_ids))
        .where(OrderItem.item_status == ItemStatus.PENDING)
        .where(OrderItem.is_bundle == False)
    )
    pending_items = result.scalars().all()

    if not pending_items:
        return {"message": "割当対象のアイテムがありません", "assigned_count": 0}

    # OPTIMIZED: Batch query for all staff workloads (count PurchaseListItems)
    staff_ids = [s.staff_id for s in available_staff]
    workload_query = select(
        PurchaseList.staff_id,
        func.count(PurchaseListItem.list_item_id).label('count')
    ).join(
        PurchaseListItem, PurchaseListItem.list_id == PurchaseList.list_id
    ).where(
        PurchaseList.staff_id.in_(staff_ids),
        PurchaseList.purchase_date == target_date
    ).group_by(PurchaseList.staff_id)

    workload_result = await db.execute(workload_query)
    staff_workload = {row.staff_id: row.count for row in workload_result.all()}

    # Initialize missing staff with 0 workload
    for staff_id in staff_ids:
        if staff_id not in staff_workload:
            staff_workload[staff_id] = 0

    staff_capacity = {s.staff_id: s.max_daily_capacity for s in available_staff}

    # NEW: Get store allocations for all items (with quantity splitting)
    item_allocations = await allocate_quantities_to_stores(db, pending_items)

    # Get or create purchase lists for all staff
    result = await db.execute(
        select(PurchaseList)
        .where(PurchaseList.staff_id.in_(staff_ids))
        .where(PurchaseList.purchase_date == target_date)
    )
    existing_lists = {pl.staff_id: pl for pl in result.scalars().all()}

    staff_lists = {}
    for staff in available_staff:
        if staff.staff_id in existing_lists:
            staff_lists[staff.staff_id] = existing_lists[staff.staff_id]
        else:
            new_list = PurchaseList(
                staff_id=staff.staff_id,
                purchase_date=target_date,
                list_status=ListStatus.DRAFT,
                total_items=0,
                total_stores=0,
            )
            db.add(new_list)
            await db.flush()
            await db.refresh(new_list)
            staff_lists[staff.staff_id] = new_list

    # Assign items using round-robin with capacity checks
    assigned_items_count = 0
    assigned_list_items_count = 0
    staff_list = list(available_staff)
    staff_index = 0

    for item in pending_items:
        allocation = item_allocations.get(item.item_id)
        if not allocation or not allocation.allocations:
            continue

        # Try to assign this item's allocations to a staff member
        attempts = 0
        assigned = False

        while attempts < len(staff_list):
            staff = staff_list[staff_index]
            staff_index = (staff_index + 1) % len(staff_list)
            attempts += 1

            current_load = staff_workload.get(staff.staff_id, 0)
            max_load = staff_capacity.get(staff.staff_id, 20)

            # Check if staff has capacity (count each store allocation as 1 task)
            allocations_count = len(allocation.allocations)
            if current_load + allocations_count <= max_load:
                purchase_list = staff_lists[staff.staff_id]

                # Create PurchaseListItem for EACH store allocation
                for store_alloc in allocation.allocations:
                    list_item = PurchaseListItem(
                        list_id=purchase_list.list_id,
                        item_id=item.item_id,
                        store_id=store_alloc.store_id,
                        quantity_to_purchase=store_alloc.quantity,  # NEW FIELD
                        sequence_order=current_load + 1,
                        purchase_status=PurchaseStatus.PENDING,
                    )
                    db.add(list_item)
                    current_load += 1
                    assigned_list_items_count += 1

                # Update item status
                item.item_status = ItemStatus.ASSIGNED
                staff_workload[staff.staff_id] = current_load
                purchase_list.total_items += allocations_count
                assigned_items_count += 1
                assigned = True
                break

        if not assigned:
            # All staff are at capacity
            pass

    # Update order statuses
    for order in pending_orders:
        result = await db.execute(
            select(func.count(OrderItem.item_id))
            .where(OrderItem.order_id == order.order_id)
            .where(OrderItem.item_status == ItemStatus.PENDING)
        )
        pending = result.scalar() or 0

        if pending == 0:
            order.order_status = OrderStatus.ASSIGNED

    # Update purchase list store counts
    for staff_id, purchase_list in staff_lists.items():
        result = await db.execute(
            select(func.count(func.distinct(PurchaseListItem.store_id)))
            .where(PurchaseListItem.list_id == purchase_list.list_id)
        )
        purchase_list.total_stores = result.scalar() or 0

        if purchase_list.total_items > 0:
            result = await db.execute(select(Staff).where(Staff.staff_id == staff_id))
            staff = result.scalar_one_or_none()
            if staff and staff.status == StaffStatus.OFF_DUTY:
                staff.status = StaffStatus.IDLE

    await db.flush()

    return {
        "message": f"{assigned_items_count}件のアイテム（{assigned_list_items_count}件の購入タスク）を{len(available_staff)}名のスタッフに割り当てました",
        "assigned_count": assigned_items_count,
        "assigned_tasks": assigned_list_items_count,
        "staff_count": len(available_staff),
    }


async def assign_to_specific_staff(
    db: AsyncSession,
    staff_id: int,
    target_date: date
) -> Dict[str, int]:
    """Assign pending items to a specific staff member with quantity splitting"""

    result = await db.execute(select(Staff).where(Staff.staff_id == staff_id))
    staff = result.scalar_one_or_none()

    if not staff:
        return {"message": "スタッフが見つかりません", "assigned_count": 0}

    # Get current workload (count PurchaseListItems, not just OrderItems)
    result = await db.execute(
        select(func.count(PurchaseListItem.list_item_id))
        .join(PurchaseList, PurchaseList.list_id == PurchaseListItem.list_id)
        .where(PurchaseList.staff_id == staff_id)
        .where(PurchaseList.purchase_date == target_date)
    )
    current_load = result.scalar() or 0
    available_capacity = staff.max_daily_capacity - current_load

    if available_capacity <= 0:
        return {"message": "このスタッフは容量上限に達しています", "assigned_count": 0}

    # Get unassigned items
    result = await db.execute(
        select(OrderItem)
        .join(Order, Order.order_id == OrderItem.order_id)
        .where(Order.target_purchase_date == target_date)
        .where(OrderItem.item_status == ItemStatus.PENDING)
        .where(OrderItem.is_bundle == False)
    )
    items = result.scalars().all()

    if not items:
        return {"message": "割当対象のアイテムがありません", "assigned_count": 0}

    # Get or create purchase list
    result = await db.execute(
        select(PurchaseList)
        .where(PurchaseList.staff_id == staff_id)
        .where(PurchaseList.purchase_date == target_date)
    )
    purchase_list = result.scalar_one_or_none()

    if not purchase_list:
        purchase_list = PurchaseList(
            staff_id=staff_id,
            purchase_date=target_date,
            list_status=ListStatus.DRAFT,
            total_items=0,
            total_stores=0,
        )
        db.add(purchase_list)
        await db.flush()
        await db.refresh(purchase_list)

    # Get store allocations with quantity splitting
    item_allocations = await allocate_quantities_to_stores(db, items, staff_id)

    assigned_items = 0
    assigned_tasks = 0
    tasks_added = 0

    for item in items:
        allocation = item_allocations.get(item.item_id)
        if not allocation or not allocation.allocations:
            continue

        # Check if we have capacity for all store allocations
        allocations_count = len(allocation.allocations)
        if tasks_added + allocations_count > available_capacity:
            continue  # Skip this item if it would exceed capacity

        # Create PurchaseListItem for each store allocation
        for store_alloc in allocation.allocations:
            list_item = PurchaseListItem(
                list_id=purchase_list.list_id,
                item_id=item.item_id,
                store_id=store_alloc.store_id,
                quantity_to_purchase=store_alloc.quantity,
                sequence_order=current_load + tasks_added + 1,
                purchase_status=PurchaseStatus.PENDING,
            )
            db.add(list_item)
            tasks_added += 1
            assigned_tasks += 1

        item.item_status = ItemStatus.ASSIGNED
        purchase_list.total_items += allocations_count
        assigned_items += 1

    # Update store count
    result = await db.execute(
        select(func.count(func.distinct(PurchaseListItem.store_id)))
        .where(PurchaseListItem.list_id == purchase_list.list_id)
    )
    purchase_list.total_stores = result.scalar() or 0

    await db.flush()

    return {
        "message": f"{assigned_items}件のアイテム（{assigned_tasks}件の購入タスク）を割り当てました",
        "assigned_count": assigned_items,
        "assigned_tasks": assigned_tasks,
    }


async def get_staff_allocations_summary(
    db: AsyncSession,
    staff_id: int,
    target_date: date
) -> Dict:
    """Get summary of staff's allocations including quantity breakdown"""

    result = await db.execute(
        select(PurchaseList)
        .where(PurchaseList.staff_id == staff_id)
        .where(PurchaseList.purchase_date == target_date)
    )
    purchase_list = result.scalar_one_or_none()

    if not purchase_list:
        return {"message": "購入リストがありません", "items": [], "stores": []}

    # Get all purchase list items with details
    result = await db.execute(
        select(PurchaseListItem, OrderItem, Store)
        .join(OrderItem, OrderItem.item_id == PurchaseListItem.item_id)
        .join(Store, Store.store_id == PurchaseListItem.store_id)
        .where(PurchaseListItem.list_id == purchase_list.list_id)
        .order_by(PurchaseListItem.store_id, PurchaseListItem.sequence_order)
    )

    items_by_store = {}
    total_quantity = 0

    for list_item, order_item, store in result:
        store_id = store.store_id
        if store_id not in items_by_store:
            items_by_store[store_id] = {
                "store_id": store_id,
                "store_name": store.store_name,
                "address": store.address,
                "items": [],
                "total_quantity": 0
            }

        items_by_store[store_id]["items"].append({
            "list_item_id": list_item.list_item_id,
            "item_id": order_item.item_id,
            "sku": order_item.sku,
            "product_name": order_item.product_name,
            "quantity_to_purchase": list_item.quantity_to_purchase,
            "purchase_status": list_item.purchase_status.value
        })
        items_by_store[store_id]["total_quantity"] += list_item.quantity_to_purchase
        total_quantity += list_item.quantity_to_purchase

    return {
        "staff_id": staff_id,
        "purchase_date": target_date.isoformat(),
        "list_id": purchase_list.list_id,
        "list_status": purchase_list.list_status.value,
        "total_stores": len(items_by_store),
        "total_quantity": total_quantity,
        "stores": list(items_by_store.values())
    }
