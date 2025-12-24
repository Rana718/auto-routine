from typing import Annotated, List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db.db import get_db
from db.schema import Staff, Product, Store, StaffRole
from middlewares.auth import get_current_user
from middlewares.rbac import require_role

router = APIRouter()

@router.get("/")
async def get_products(
    current_user: Annotated[Staff, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
    skip: int = 0,
    limit: int = 100
):
    """Get all products"""
    result = await db.execute(
        select(Product).offset(skip).limit(limit).order_by(Product.product_id.desc())
    )
    products = result.scalars().all()
    
    return [
        {
            "product_id": p.product_id,
            "sku": p.sku,
            "product_name": p.product_name,
            "category": p.category,
            "is_store_fixed": p.is_store_fixed,
            "fixed_store_id": p.fixed_store_id,
            "exclude_from_routing": p.exclude_from_routing,
            "is_set_product": p.is_set_product
        }
        for p in products
    ]

@router.patch("/{product_id}/store-fixed")
@require_role(StaffRole.ADMIN, StaffRole.SUPERVISOR)
async def update_store_fixed(
    product_id: int,
    current_user: Annotated[Staff, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
    is_fixed: bool = True,
    store_id: Optional[int] = None
):
    """Set product as store-fixed"""
    result = await db.execute(select(Product).where(Product.product_id == product_id))
    product = result.scalar_one_or_none()
    
    if not product:
        raise HTTPException(status_code=404, detail="商品が見つかりません")
    
    product.is_store_fixed = is_fixed
    product.fixed_store_id = store_id if is_fixed else None
    
    await db.commit()
    return {"message": "更新しました"}

@router.patch("/{product_id}/routing")
@require_role(StaffRole.ADMIN, StaffRole.SUPERVISOR)
async def update_routing_exclusion(
    product_id: int,
    current_user: Annotated[Staff, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
    exclude: bool = True
):
    """Exclude product from routing"""
    result = await db.execute(select(Product).where(Product.product_id == product_id))
    product = result.scalar_one_or_none()
    
    if not product:
        raise HTTPException(status_code=404, detail="商品が見つかりません")
    
    product.exclude_from_routing = exclude
    await db.commit()
    return {"message": "更新しました"}
