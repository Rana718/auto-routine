"""
Staff Assignment Service - OPTIMIZED
Automatically assigns orders and items to staff members
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
from services.store_selection import get_stores_for_items_batch, calculate_distance


async def auto_assign_daily_orders(db: AsyncSession, target_date: date) -> Dict[str, int]:
    """OPTIMIZED: Batch queries to eliminate N+1"""
    
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
    
    # Get pending items
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
    
    # OPTIMIZED: Batch query for all staff workloads
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
    
    # Initialize missing staff
    for staff_id in staff_ids:
        if staff_id not in staff_workload:
            staff_workload[staff_id] = 0
    
    staff_capacity = {s.staff_id: s.max_daily_capacity for s in available_staff}
    
    # OPTIMIZED: Batch get store assignments
    item_stores = await get_stores_for_items_batch(db, pending_items)
    
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
    assigned_count = 0
    staff_list = list(available_staff)
    staff_index = 0
    
    for item in pending_items:
        attempts = 0
        while attempts < len(staff_list):
            staff = staff_list[staff_index]
            staff_index = (staff_index + 1) % len(staff_list)
            attempts += 1
            
            current_load = staff_workload.get(staff.staff_id, 0)
            max_load = staff_capacity.get(staff.staff_id, 20)
            
            if current_load < max_load:
                store_id = item_stores.get(item.item_id)
                if not store_id:
                    continue
                
                purchase_list = staff_lists[staff.staff_id]
                
                list_item = PurchaseListItem(
                    list_id=purchase_list.list_id,
                    item_id=item.item_id,
                    store_id=store_id,
                    sequence_order=current_load + 1,
                    purchase_status=PurchaseStatus.PENDING,
                )
                db.add(list_item)
                
                item.item_status = ItemStatus.ASSIGNED
                staff_workload[staff.staff_id] = current_load + 1
                purchase_list.total_items += 1
                assigned_count += 1
                break
    
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
        "message": f"{assigned_count}件のアイテムを{len(available_staff)}名のスタッフに割り当てました",
        "assigned_count": assigned_count,
        "staff_count": len(available_staff),
    }


async def assign_to_specific_staff(
    db: AsyncSession, 
    staff_id: int, 
    target_date: date
) -> Dict[str, int]:
    """Assign pending items to a specific staff member"""
    
    result = await db.execute(select(Staff).where(Staff.staff_id == staff_id))
    staff = result.scalar_one_or_none()
    
    if not staff:
        return {"message": "スタッフが見つかりません", "assigned_count": 0}
    
    # Get current workload
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
        .limit(available_capacity)
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
    
    # OPTIMIZED: Batch get store assignments
    item_stores = await get_stores_for_items_batch(db, items, staff_id)
    
    assigned_count = 0
    for item in items:
        store_id = item_stores.get(item.item_id)
        if not store_id:
            continue
        
        list_item = PurchaseListItem(
            list_id=purchase_list.list_id,
            item_id=item.item_id,
            store_id=store_id,
            sequence_order=current_load + assigned_count + 1,
            purchase_status=PurchaseStatus.PENDING,
        )
        db.add(list_item)
        
        item.item_status = ItemStatus.ASSIGNED
        purchase_list.total_items += 1
        assigned_count += 1
    
    # Update store count
    result = await db.execute(
        select(func.count(func.distinct(PurchaseListItem.store_id)))
        .where(PurchaseListItem.list_id == purchase_list.list_id)
    )
    purchase_list.total_stores = result.scalar() or 0
    
    await db.flush()
    
    return {
        "message": f"{assigned_count}件のアイテムを割り当てました",
        "assigned_count": assigned_count,
    }
