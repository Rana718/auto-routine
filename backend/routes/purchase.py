from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db.db import get_db
from db.schema import Staff, PurchaseFailure, PurchaseListItem, FailureType, ItemStatus, PurchaseStatus
from models.purchase import PurchaseFailureCreate
from middlewares.auth import get_current_user

router = APIRouter()

@router.post("/failures")
async def record_purchase_failure(
    failure: PurchaseFailureCreate,
    current_user: Annotated[Staff, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db)
):
    """Record a purchase failure"""
    # Verify list item exists
    result = await db.execute(
        select(PurchaseListItem).where(PurchaseListItem.list_item_id == failure.list_item_id)
    )
    list_item = result.scalar_one_or_none()
    
    if not list_item:
        raise HTTPException(status_code=404, detail="購入リストアイテムが見つかりません")
    
    # Create failure record
    failure_record = PurchaseFailure(
        list_item_id=failure.list_item_id,
        item_id=failure.item_id,
        store_id=failure.store_id,
        failure_type=FailureType(failure.failure_type),
        expected_restock_date=failure.expected_restock_date,
        alternative_store_id=failure.alternative_store_id,
        notes=failure.notes
    )
    db.add(failure_record)
    
    # Update list item status
    list_item.purchase_status = PurchaseStatus.FAILED
    list_item.failure_reason = failure.failure_type
    
    # Update order item status
    from db.schema import OrderItem
    result = await db.execute(select(OrderItem).where(OrderItem.item_id == failure.item_id))
    order_item = result.scalar_one_or_none()
    if order_item:
        order_item.item_status = ItemStatus.FAILED
    
    await db.commit()
    
    return {"message": "購入失敗を記録しました", "failure_id": failure_record.failure_id}

@router.get("/failures")
async def get_purchase_failures(
    current_user: Annotated[Staff, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
    failure_type: str = None,
    skip: int = 0,
    limit: int = 50
):
    """Get purchase failures"""
    query = select(PurchaseFailure).order_by(PurchaseFailure.failure_date.desc())
    
    if failure_type:
        query = query.where(PurchaseFailure.failure_type == FailureType(failure_type))
    
    query = query.offset(skip).limit(limit)
    result = await db.execute(query)
    failures = result.scalars().all()
    
    return [
        {
            "failure_id": f.failure_id,
            "item_id": f.item_id,
            "store_id": f.store_id,
            "failure_type": f.failure_type.value,
            "failure_date": f.failure_date,
            "expected_restock_date": f.expected_restock_date,
            "notes": f.notes
        }
        for f in failures
    ]
