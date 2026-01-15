from datetime import date
from typing import Annotated, List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from db.db import get_db
from db.schema import OrderStatus, OrderCreate, OrderResponse, OrderItemCreate, OrderItemResponse, Staff
from models.orders import OrderWithItemsResponse, OrderStats, BulkOrderImport
from controllers.orders import *
from middlewares.auth import get_current_user

router = APIRouter()

@router.get("", response_model=List[OrderWithItemsResponse])
async def get_orders(
    current_user: Annotated[Staff, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
    status: Optional[OrderStatus] = None,
    target_date: Optional[date] = None,
    search: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
):
    return await get_all_orders(db, status, target_date, search, skip, limit)

@router.get("/stats", response_model=OrderStats)
async def get_stats(
    current_user: Annotated[Staff, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
    target_date: Optional[date] = None
):
    return await get_order_statistics(db, target_date)

@router.get("/{order_id}", response_model=OrderWithItemsResponse)
async def get_order(
    order_id: int,
    current_user: Annotated[Staff, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db)
):
    return await get_order_by_id(db, order_id)

@router.post("", response_model=OrderResponse)
async def create_order(
    order_data: OrderCreate,
    current_user: Annotated[Staff, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db)
):
    return await create_new_order(db, order_data)

@router.post("/{order_id}/items", response_model=OrderItemResponse)
async def add_order_item(
    order_id: int,
    item_data: OrderItemCreate,
    current_user: Annotated[Staff, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db)
):
    return await add_item_to_order(db, order_id, item_data)

@router.patch("/{order_id}/status")
async def update_order_status(
    order_id: int,
    status: OrderStatus,
    current_user: Annotated[Staff, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db)
):
    return await update_order_status_controller(db, order_id, status)

@router.post("/import", response_model=dict)
async def import_orders(
    data: BulkOrderImport,
    current_user: Annotated[Staff, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db)
):
    return await import_bulk_orders(db, data)

@router.patch("/{order_id}/items/{item_id}/status")
async def update_item_status(
    order_id: int,
    item_id: int,
    status: str,
    current_user: Annotated[Staff, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db)
):
    """Update individual item status"""
    from db.schema import OrderItem, ItemStatus
    from sqlalchemy import select
    from fastapi import HTTPException
    
    result = await db.execute(
        select(OrderItem).where(
            OrderItem.item_id == item_id,
            OrderItem.order_id == order_id
        )
    )
    item = result.scalar_one_or_none()
    
    if not item:
        raise HTTPException(status_code=404, detail="アイテムが見つかりません")
    
    item.item_status = ItemStatus(status)
    await db.commit()
    
    return {"message": "ステータスを更新しました"}

@router.delete("/{order_id}")
async def delete_order_route(
    order_id: int,
    current_user: Annotated[Staff, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db)
):
    """Delete an order"""
    from controllers.orders import delete_order
    return await delete_order(db, order_id)
