from datetime import date, datetime
from typing import List, Optional
from fastapi import HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from db.schema import Order, OrderItem, OrderStatus, ItemStatus, OrderCreate, OrderResponse, OrderItemCreate, OrderItemResponse
from models.orders import OrderWithItemsResponse, OrderStats, BulkOrderImport

async def get_all_orders(
    db: AsyncSession,
    status: Optional[OrderStatus],
    target_date: Optional[date],
    search: Optional[str],
    skip: int,
    limit: int
) -> List[OrderWithItemsResponse]:
    query = select(Order).options(selectinload(Order.items))
    
    if status:
        query = query.where(Order.order_status == status)
    if target_date:
        query = query.where(Order.target_purchase_date == target_date)
    if search:
        query = query.where(
            Order.robot_in_order_id.ilike(f"%{search}%") |
            Order.customer_name.ilike(f"%{search}%")
        )
    
    query = query.order_by(Order.order_date.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()

async def get_order_statistics(db: AsyncSession, target_date: Optional[date]) -> OrderStats:
    query = select(func.count(Order.order_id))
    if target_date:
        query = query.where(Order.target_purchase_date == target_date)
    
    total_result = await db.execute(query)
    total = total_result.scalar() or 0
    
    status_counts = {}
    for status in [OrderStatus.PENDING, OrderStatus.ASSIGNED, OrderStatus.COMPLETED, OrderStatus.FAILED]:
        query = select(func.count(Order.order_id)).where(Order.order_status == status)
        if target_date:
            query = query.where(Order.target_purchase_date == target_date)
        result = await db.execute(query)
        status_counts[status.value] = result.scalar() or 0
    
    return OrderStats(
        total_orders=total,
        pending_orders=status_counts.get("pending", 0),
        assigned_orders=status_counts.get("assigned", 0),
        completed_orders=status_counts.get("completed", 0),
        failed_orders=status_counts.get("failed", 0),
    )

async def get_order_by_id(db: AsyncSession, order_id: int):
    result = await db.execute(
        select(Order).options(selectinload(Order.items)).where(Order.order_id == order_id)
    )
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="注文が見つかりません")
    return order

async def create_new_order(db: AsyncSession, order_data: OrderCreate) -> OrderResponse:
    from utils.order_processing import apply_cutoff_logic
    
    # Strip timezone info if present
    order_date = order_data.order_date
    if hasattr(order_date, 'tzinfo') and order_date.tzinfo is not None:
        order_date = order_date.replace(tzinfo=None)
    
    # Apply cutoff logic
    target_date = await apply_cutoff_logic(db, order_date)
    
    order = Order(
        robot_in_order_id=order_data.robot_in_order_id,
        mall_name=order_data.mall_name,
        customer_name=order_data.customer_name,
        order_date=order_date,
        target_purchase_date=target_date,
        order_status=OrderStatus.PENDING,
    )
    db.add(order)
    await db.flush()
    await db.refresh(order)
    return order

async def add_item_to_order(db: AsyncSession, order_id: int, item_data: OrderItemCreate) -> OrderItemResponse:
    result = await db.execute(select(Order).where(Order.order_id == order_id))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="注文が見つかりません")
    
    item = OrderItem(
        order_id=order_id,
        sku=item_data.sku,
        product_name=item_data.product_name,
        quantity=item_data.quantity,
        unit_price=item_data.unit_price,
        is_bundle=item_data.is_bundle,
        item_status=ItemStatus.PENDING,
    )
    db.add(item)
    await db.flush()
    await db.refresh(item)
    return item

async def update_order_status_controller(db: AsyncSession, order_id: int, status: OrderStatus):
    result = await db.execute(select(Order).where(Order.order_id == order_id))
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="注文が見つかりません")
    
    order.order_status = status
    order.updated_at = datetime.utcnow()
    return {"message": "ステータスを更新しました", "new_status": status.value}

async def import_bulk_orders(db: AsyncSession, data: BulkOrderImport):
    from dateutil import parser
    
    created_count = 0
    for order_data in data.orders:
        # Parse date string to datetime
        order_date = order_data.get("order_date")
        if isinstance(order_date, str):
            order_date = parser.parse(order_date).replace(tzinfo=None)
        
        target_date = order_data.get("target_purchase_date")
        if isinstance(target_date, str):
            target_date = parser.parse(target_date).date()
        
        order = Order(
            robot_in_order_id=order_data.get("robot_in_order_id"),
            mall_name=order_data.get("mall_name"),
            customer_name=order_data.get("customer_name"),
            order_date=order_date,
            target_purchase_date=target_date,
            order_status=OrderStatus.PENDING,
        )
        db.add(order)
        created_count += 1
    
    await db.flush()
    return {"message": f"{created_count}件の注文をインポートしました", "count": created_count}
