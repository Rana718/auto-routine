"""
Staff Assignment Service
Automatically assigns orders and items to staff members
"""

from datetime import date
from typing import List, Dict, Optional, Tuple
from decimal import Decimal
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from db.schema import (
    Staff, StaffStatus, StaffRole, Order, OrderItem, OrderStatus, ItemStatus,
    PurchaseList, PurchaseListItem, PurchaseStatus, ListStatus,
    Store
)
from services.store_selection import get_stores_for_items, calculate_distance


async def auto_assign_daily_orders(db: AsyncSession, target_date: date) -> Dict[str, int]:
    """
    Automatically assign all pending orders for a target date to available staff.
    
    Algorithm:
    1. Get all available staff (not off-duty)
    2. Get all pending orders for the target date
    3. Assign items to staff based on:
       - Staff capacity (max_daily_capacity)
       - Geographic proximity to items/stores
       - Current workload balance
    """
    # Get available buyer staff only
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
    
    # Get pending orders for target date
    result = await db.execute(
        select(Order)
        .where(Order.target_purchase_date == target_date)
        .where(Order.order_status == OrderStatus.PENDING)
    )
    pending_orders = result.scalars().all()
    
    if not pending_orders:
        return {"message": "割当対象の注文がありません", "assigned_count": 0}
    
    # Get all pending items from these orders
    order_ids = [o.order_id for o in pending_orders]
    result = await db.execute(
        select(OrderItem)
        .where(OrderItem.order_id.in_(order_ids))
        .where(OrderItem.item_status == ItemStatus.PENDING)
        .where(OrderItem.is_bundle == False)  # Don't assign bundle parents
    )
    pending_items = result.scalars().all()
    
    if not pending_items:
        return {"message": "割当対象のアイテムがありません", "assigned_count": 0}
    
    # Calculate current workload per staff
    staff_workload = {s.staff_id: 0 for s in available_staff}
    staff_capacity = {s.staff_id: s.max_daily_capacity for s in available_staff}
    staff_locations = {
        s.staff_id: (s.start_location_lat, s.start_location_lng) 
        for s in available_staff if s.start_location_lat and s.start_location_lng
    }
    
    # Get existing purchase lists for today
    for staff in available_staff:
        result = await db.execute(
            select(func.count(PurchaseListItem.list_item_id))
            .join(PurchaseList, PurchaseList.list_id == PurchaseListItem.list_id)
            .where(PurchaseList.staff_id == staff.staff_id)
            .where(PurchaseList.purchase_date == target_date)
        )
        staff_workload[staff.staff_id] = result.scalar() or 0
    
    # Get store assignments for items
    item_stores = await get_stores_for_items(db, pending_items)
    
    # Create or get purchase lists for each staff
    staff_lists = {}
    for staff in available_staff:
        result = await db.execute(
            select(PurchaseList)
            .where(PurchaseList.staff_id == staff.staff_id)
            .where(PurchaseList.purchase_date == target_date)
        )
        existing_list = result.scalar_one_or_none()
        
        if existing_list:
            staff_lists[staff.staff_id] = existing_list
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
        # Find a staff member with capacity
        attempts = 0
        while attempts < len(staff_list):
            staff = staff_list[staff_index]
            staff_index = (staff_index + 1) % len(staff_list)
            attempts += 1
            
            # Check capacity
            current_load = staff_workload.get(staff.staff_id, 0)
            max_load = staff_capacity.get(staff.staff_id, 20)
            
            if current_load < max_load:
                # Assign this item to this staff
                store_id = item_stores.get(item.item_id)
                if not store_id:
                    continue
                
                purchase_list = staff_lists[staff.staff_id]
                
                # Create purchase list item
                list_item = PurchaseListItem(
                    list_id=purchase_list.list_id,
                    item_id=item.item_id,
                    store_id=store_id,
                    sequence_order=current_load + 1,
                    purchase_status=PurchaseStatus.PENDING,
                )
                db.add(list_item)
                
                # Update item status
                item.item_status = ItemStatus.ASSIGNED
                
                # Update workload
                staff_workload[staff.staff_id] = current_load + 1
                
                # Update purchase list counts
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
    
    # Update purchase list store counts and staff status
    for staff_id, purchase_list in staff_lists.items():
        result = await db.execute(
            select(func.count(func.distinct(PurchaseListItem.store_id)))
            .where(PurchaseListItem.list_id == purchase_list.list_id)
        )
        purchase_list.total_stores = result.scalar() or 0
        
        # Update staff status to IDLE if they have work assigned
        if purchase_list.total_items > 0:
            result = await db.execute(
                select(Staff).where(Staff.staff_id == staff_id)
            )
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
    """
    Assign pending items to a specific staff member up to their capacity.
    """
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
    
    # Get store assignments
    item_stores = await get_stores_for_items(db, items, staff_id)
    
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
