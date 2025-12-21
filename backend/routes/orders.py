"""
Orders API routes
"""
from datetime import date, datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from db.db import get_db
from db.schema import (
    Order, OrderItem, OrderStatus, ItemStatus,
    OrderCreate, OrderResponse, OrderItemCreate, OrderItemResponse
)

router = APIRouter()


# ============================================================================
# SCHEMAS
# ============================================================================

class OrderWithItemsResponse(OrderResponse):
    items: List[OrderItemResponse] = []


class OrderStats(BaseModel):
    total_orders: int
    pending_orders: int
    assigned_orders: int
    completed_orders: int
    failed_orders: int


class BulkOrderImport(BaseModel):
    orders: List[OrderCreate]


# ============================================================================
# ROUTES
# ============================================================================

@router.get("/", response_model=List[OrderWithItemsResponse])
async def get_orders(
    db: AsyncSession = Depends(get_db),
    status: Optional[OrderStatus] = None,
    target_date: Optional[date] = None,
    search: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
):
    """Get all orders with optional filters"""
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
    orders = result.scalars().all()
    
    return orders


@router.get("/stats", response_model=OrderStats)
async def get_order_stats(
    db: AsyncSession = Depends(get_db),
    target_date: Optional[date] = None,
):
    """Get order statistics for dashboard"""
    base_query = select(Order)
    if target_date:
        base_query = base_query.where(Order.target_purchase_date == target_date)
    
    # Total
    total_result = await db.execute(
        select(func.count(Order.order_id)).select_from(base_query.subquery())
    )
    total = total_result.scalar() or 0
    
    # By status
    status_counts = {}
    for status in [OrderStatus.PENDING, OrderStatus.ASSIGNED, OrderStatus.COMPLETED, OrderStatus.FAILED]:
        result = await db.execute(
            select(func.count(Order.order_id))
            .where(Order.order_status == status)
            .where(Order.target_purchase_date == target_date if target_date else True)
        )
        status_counts[status.value] = result.scalar() or 0
    
    return OrderStats(
        total_orders=total,
        pending_orders=status_counts.get("pending", 0),
        assigned_orders=status_counts.get("assigned", 0),
        completed_orders=status_counts.get("completed", 0),
        failed_orders=status_counts.get("failed", 0),
    )


@router.get("/{order_id}", response_model=OrderWithItemsResponse)
async def get_order(
    order_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Get single order by ID"""
    result = await db.execute(
        select(Order)
        .options(selectinload(Order.items))
        .where(Order.order_id == order_id)
    )
    order = result.scalar_one_or_none()
    
    if not order:
        raise HTTPException(status_code=404, detail="注文が見つかりません")
    
    return order


@router.post("/", response_model=OrderResponse)
async def create_order(
    order_data: OrderCreate,
    db: AsyncSession = Depends(get_db),
):
    """Create a new order"""
    order = Order(
        robot_in_order_id=order_data.robot_in_order_id,
        mall_name=order_data.mall_name,
        customer_name=order_data.customer_name,
        order_date=order_data.order_date,
        target_purchase_date=order_data.target_purchase_date,
        order_status=OrderStatus.PENDING,
    )
    
    db.add(order)
    await db.flush()
    await db.refresh(order)
    
    return order


@router.post("/{order_id}/items", response_model=OrderItemResponse)
async def add_order_item(
    order_id: int,
    item_data: OrderItemCreate,
    db: AsyncSession = Depends(get_db),
):
    """Add item to an order"""
    # Verify order exists
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


@router.patch("/{order_id}/status")
async def update_order_status(
    order_id: int,
    status: OrderStatus,
    db: AsyncSession = Depends(get_db),
):
    """Update order status"""
    result = await db.execute(select(Order).where(Order.order_id == order_id))
    order = result.scalar_one_or_none()
    
    if not order:
        raise HTTPException(status_code=404, detail="注文が見つかりません")
    
    order.order_status = status
    order.updated_at = datetime.utcnow()
    
    return {"message": "ステータスを更新しました", "new_status": status.value}


@router.post("/import", response_model=dict)
async def import_orders(
    data: BulkOrderImport,
    db: AsyncSession = Depends(get_db),
):
    """Bulk import orders from Robot-in"""
    created_count = 0
    
    for order_data in data.orders:
        order = Order(
            robot_in_order_id=order_data.robot_in_order_id,
            mall_name=order_data.mall_name,
            customer_name=order_data.customer_name,
            order_date=order_data.order_date,
            target_purchase_date=order_data.target_purchase_date,
            order_status=OrderStatus.PENDING,
        )
        db.add(order)
        created_count += 1
    
    await db.flush()
    
    return {"message": f"{created_count}件の注文をインポートしました", "count": created_count}
