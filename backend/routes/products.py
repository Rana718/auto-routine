from typing import Annotated, List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel

from db.db import get_db
from db.schema import Staff, Product, Store, StaffRole
from middlewares.auth import get_current_user
from middlewares.rbac import require_role

router = APIRouter()

class ProductCreate(BaseModel):
    sku: str
    product_name: str
    category: Optional[str] = None

class ProductUpdate(BaseModel):
    is_set_product: Optional[bool] = None
    set_split_rule: Optional[dict] = None
    is_store_fixed: Optional[bool] = None
    fixed_store_id: Optional[int] = None
    exclude_from_routing: Optional[bool] = None

@router.get("")
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
            "is_set_product": p.is_set_product,
            "set_split_rule": p.set_split_rule
        }
        for p in products
    ]

@router.post("")
@require_role(StaffRole.ADMIN, StaffRole.SUPERVISOR)
async def create_product(
    data: ProductCreate,
    current_user: Annotated[Staff, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db)
):
    """Create a new product"""
    # Check if SKU already exists
    result = await db.execute(select(Product).where(Product.sku == data.sku))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="このSKUは既に存在します")
    
    product = Product(
        sku=data.sku,
        product_name=data.product_name,
        category=data.category,
        is_set_product=False,
        is_store_fixed=False,
        exclude_from_routing=False
    )
    
    db.add(product)
    await db.commit()
    await db.refresh(product)
    
    return {
        "product_id": product.product_id,
        "sku": product.sku,
        "product_name": product.product_name,
        "category": product.category
    }

@router.patch("/{product_id}")
async def update_product(
    product_id: int,
    data: ProductUpdate,
    current_user: Annotated[Staff, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db)
):
    """Update product configuration"""
    result = await db.execute(select(Product).where(Product.product_id == product_id))
    product = result.scalar_one_or_none()
    
    if not product:
        raise HTTPException(status_code=404, detail="商品が見つかりません")
    
    if data.is_set_product is not None:
        product.is_set_product = data.is_set_product
    if data.set_split_rule is not None:
        product.set_split_rule = data.set_split_rule
    if data.is_store_fixed is not None:
        product.is_store_fixed = data.is_store_fixed
    if data.fixed_store_id is not None:
        product.fixed_store_id = data.fixed_store_id
    if data.exclude_from_routing is not None:
        product.exclude_from_routing = data.exclude_from_routing
    
    await db.commit()
    return {"message": "更新しました", "product_id": product.product_id}

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
    
    await db.flush()
    await db.refresh(product)
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
