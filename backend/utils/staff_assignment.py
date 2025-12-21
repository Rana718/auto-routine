from typing import List, Dict
from datetime import date
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db.schema import Staff, Order, OrderItem, PurchaseList, PurchaseListItem, ListStatus, ItemStatus, StaffStatus

async def auto_assign_orders_to_staff(
    db: AsyncSession,
    target_date: date,
    staff_ids: List[int] = None
) -> Dict:
    """Automatically assign pending orders to available staff"""
    
    # Get available staff
    query = select(Staff).where(Staff.is_active == True)
    if staff_ids:
        query = query.where(Staff.staff_id.in_(staff_ids))
    
    result = await db.execute(query)
    staff_list = result.scalars().all()
    
    if not staff_list:
        return {"error": "No available staff"}
    
    # Get pending items for target date
    result = await db.execute(
        select(OrderItem)
        .join(Order, OrderItem.order_id == Order.order_id)
        .where(Order.target_purchase_date == target_date)
        .where(OrderItem.item_status == ItemStatus.PENDING)
    )
    pending_items = result.scalars().all()
    
    if not pending_items:
        return {"message": "No pending items", "assigned_count": 0}
    
    # Simple round-robin assignment
    assignments = {}
    for idx, item in enumerate(pending_items):
        staff = staff_list[idx % len(staff_list)]
        
        if staff.staff_id not in assignments:
            assignments[staff.staff_id] = []
        
        assignments[staff.staff_id].append(item)
    
    # Create purchase lists
    created_lists = []
    for staff_id, items in assignments.items():
        purchase_list = PurchaseList(
            staff_id=staff_id,
            purchase_date=target_date,
            list_status=ListStatus.DRAFT,
            total_items=len(items)
        )
        db.add(purchase_list)
        await db.flush()
        
        # Import store selection utility
        from utils.store_selection import select_store_for_item
        
        # Add items to list with store assignment
        for item in items:
            store_id = await select_store_for_item(db, item)
            if not store_id:
                store_id = 1  # Fallback to default store
            
            list_item = PurchaseListItem(
                list_id=purchase_list.list_id,
                item_id=item.item_id,
                store_id=store_id,
            )
            db.add(list_item)
            item.item_status = ItemStatus.ASSIGNED
        
        created_lists.append(purchase_list.list_id)
    
    await db.flush()
    
    return {
        "message": f"Assigned {len(pending_items)} items to {len(staff_list)} staff",
        "assigned_count": len(pending_items),
        "staff_count": len(staff_list),
        "purchase_lists": created_lists
    }
