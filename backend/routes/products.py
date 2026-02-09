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

class CSVImportRequest(BaseModel):
    csv_data: str

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

@router.delete("/{product_id}")
@require_role(StaffRole.ADMIN, StaffRole.SUPERVISOR)
async def delete_product(
    product_id: int,
    current_user: Annotated[Staff, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db)
):
    """Delete a product"""
    result = await db.execute(select(Product).where(Product.product_id == product_id))
    product = result.scalar_one_or_none()
    
    if not product:
        raise HTTPException(status_code=404, detail="商品が見つかりません")
    
    await db.delete(product)
    await db.commit()
    return {"message": "削除しました"}


@router.post("/import")
@require_role(StaffRole.ADMIN, StaffRole.SUPERVISOR)
async def import_products_csv(
    data: CSVImportRequest,
    current_user: Annotated[Staff, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
):
    """Import products from CSV data"""
    import csv
    from io import StringIO

    csv_data = data.csv_data
    if not csv_data:
        raise HTTPException(status_code=400, detail="CSVデータがありません")
    
    reader = csv.DictReader(StringIO(csv_data))
    created = 0
    updated = 0
    errors = []
    
    for row in reader:
        try:
            sku = row.get('sku', '').strip()
            product_name = row.get('product_name', '').strip()
            
            if not sku or not product_name:
                errors.append(f"SKUまたは商品名が空です: {row}")
                continue
            
            # Check if product exists
            result = await db.execute(select(Product).where(Product.sku == sku))
            product = result.scalar_one_or_none()
            
            if product:
                # Update existing
                product.product_name = product_name
                product.category = row.get('category', '')
                updated += 1
            else:
                # Create new
                product = Product(
                    sku=sku,
                    product_name=product_name,
                    category=row.get('category', ''),
                    is_set_product=row.get('is_set_product', '').lower() in ['true', '1', 'yes'],
                    is_store_fixed=row.get('is_store_fixed', '').lower() in ['true', '1', 'yes'],
                    exclude_from_routing=row.get('exclude_from_routing', '').lower() in ['true', '1', 'yes']
                )
                db.add(product)
                created += 1
        except Exception as e:
            errors.append(f"エラー (SKU: {row.get('sku', 'unknown')}): {str(e)}")
    
    await db.commit()
    
    return {
        "message": f"{created}件の商品を作成、{updated}件を更新しました",
        "created": created,
        "updated": updated,
        "errors": errors
    }


@router.get("/export")
async def export_products_csv(
    current_user: Annotated[Staff, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db)
):
    """Export all products as CSV"""
    from fastapi.responses import Response
    import csv
    from io import StringIO
    
    result = await db.execute(select(Product).order_by(Product.product_id))
    products = result.scalars().all()
    
    output = StringIO()
    writer = csv.writer(output)
    
    # Header
    writer.writerow([
        'product_id', 'sku', 'product_name', 'category',
        'is_set_product', 'is_store_fixed', 'fixed_store_id',
        'exclude_from_routing', 'created_at', 'updated_at'
    ])
    
    # Data rows
    for p in products:
        writer.writerow([
            p.product_id, p.sku, p.product_name, p.category or '',
            p.is_set_product, p.is_store_fixed, p.fixed_store_id or '',
            p.exclude_from_routing, p.created_at, p.updated_at
        ])
    
    csv_data = output.getvalue()

    return Response(
        content="\ufeff" + csv_data,
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": "attachment; filename=products_export.csv"}
    )
