from datetime import date, datetime
from typing import List, Optional
from fastapi import HTTPException
from sqlalchemy import select, func, case
from sqlalchemy.ext.asyncio import AsyncSession
from utils.timezone import jst_now
from sqlalchemy.orm import selectinload

from db.schema import Order, OrderItem, OrderStatus, ItemStatus, OrderCreate, OrderResponse, OrderItemCreate, OrderItemResponse
from db.schema import Product, ProductStoreMapping, Store, StockStatus, PurchaseListItem
from models.orders import OrderWithItemsResponse, OrderStats, BulkOrderImport


async def ensure_products_exist(db: AsyncSession, items: list):
    """
    Auto-create products for order items if they don't exist
    Maps them to the first active store by default
    """
    if not items:
        return
    
    # Get unique SKUs from items
    skus = list(set(item.get("sku") if isinstance(item, dict) else getattr(item, "sku", "") for item in items if (item.get("sku") if isinstance(item, dict) else getattr(item, "sku", ""))))
    if not skus:
        return
    
    # Check which SKUs already have products
    result = await db.execute(select(Product.sku).where(Product.sku.in_(skus)))
    existing_skus = set(sku for sku, in result.all())
    
    missing_skus = set(skus) - existing_skus
    if not missing_skus:
        return  # All products exist
    
    # Get first active store for default mapping
    result = await db.execute(
        select(Store).where(Store.is_active == True).limit(1)
    )
    default_store = result.scalar_one_or_none()
    
    if not default_store:
        return  # No store to map to, skip auto-creation
    
    # Create missing products
    for item in items:
        sku = item.get("sku") if isinstance(item, dict) else getattr(item, "sku", "")
        if sku not in missing_skus:
            continue
        
        product_name = item.get("product_name") if isinstance(item, dict) else getattr(item, "product_name", "")
        
        # Create product
        product = Product(
            sku=sku,
            product_name=product_name or sku,
            category="auto-created",
            is_store_fixed=False,
            exclude_from_routing=False
        )
        db.add(product)
        await db.flush()
        await db.refresh(product)
        
        # Create store mapping
        mapping = ProductStoreMapping(
            product_id=product.product_id,
            store_id=default_store.store_id,
            stock_status=StockStatus.UNKNOWN,
            priority=5
        )
        db.add(mapping)
        
        missing_skus.remove(sku)  # Mark as created
    
    await db.flush()

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
    orders = result.scalars().all()
    
    # Convert SQLAlchemy objects to response model
    return [
        OrderWithItemsResponse(
            order_id=order.order_id,
            robot_in_order_id=order.robot_in_order_id,
            mall_name=order.mall_name,
            customer_name=order.customer_name,
            order_date=order.order_date.date() if isinstance(order.order_date, datetime) else order.order_date,
            order_status=order.order_status,
            target_purchase_date=order.target_purchase_date,
            items=[
                {
                    "item_id": item.item_id,
                    "sku": item.sku,
                    "product_name": item.product_name,
                    "quantity": item.quantity,
                    "item_status": item.item_status.value if item.item_status else "pending"
                }
                for item in order.items
            ]
        )
        for order in orders
    ]

async def get_order_statistics(db: AsyncSession, target_date: Optional[date]) -> OrderStats:
    # OPTIMIZED: Single query with conditional aggregations using CASE
    query = select(
        func.count(Order.order_id).label('total'),
        func.sum(case((Order.order_status == OrderStatus.PENDING, 1), else_=0)).label('pending'),
        func.sum(case((Order.order_status == OrderStatus.ASSIGNED, 1), else_=0)).label('assigned'),
        func.sum(case((Order.order_status == OrderStatus.COMPLETED, 1), else_=0)).label('completed'),
        func.sum(case((Order.order_status == OrderStatus.FAILED, 1), else_=0)).label('failed')
    )
    
    if target_date:
        query = query.where(Order.target_purchase_date == target_date)
    
    result = await db.execute(query)
    row = result.one()
    
    return OrderStats(
        total_orders=row.total or 0,
        pending_orders=row.pending or 0,
        assigned_orders=row.assigned or 0,
        completed_orders=row.completed or 0,
        failed_orders=row.failed or 0,
    )

async def get_order_by_id(db: AsyncSession, order_id: int):
    result = await db.execute(
        select(Order).options(selectinload(Order.items)).where(Order.order_id == order_id)
    )
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="注文が見つかりません")
    return OrderWithItemsResponse(
        order_id=order.order_id,
        robot_in_order_id=order.robot_in_order_id,
        mall_name=order.mall_name,
        customer_name=order.customer_name,
        order_date=order.order_date.date() if isinstance(order.order_date, datetime) else order.order_date,
        order_status=order.order_status,
        target_purchase_date=order.target_purchase_date,
        items=[
            {
                "item_id": item.item_id,
                "sku": item.sku,
                "product_name": item.product_name,
                "quantity": item.quantity,
                "item_status": item.item_status.value if item.item_status else "pending"
            }
            for item in order.items
        ]
    )

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
    
    # Add items if provided
    items = order_data.items or []
    if items:
        # Auto-create products for items if they don't exist
        await ensure_products_exist(db, items)
        
        for item_data in items:
            item = OrderItem(
                order_id=order.order_id,
                sku=item_data.get("sku", ""),
                product_name=item_data.get("product_name", ""),
                quantity=item_data.get("quantity", 1),
                unit_price=item_data.get("unit_price"),
                is_bundle=item_data.get("is_bundle", False),
                priority=item_data.get("priority", "normal"),
                item_status=ItemStatus.PENDING,
            )
            db.add(item)
        
        await db.flush()
    
    await db.commit()
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
        priority=item_data.priority,
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
    order.updated_at = jst_now()
    return {"message": "ステータスを更新しました", "new_status": status.value}

async def import_bulk_orders(db: AsyncSession, data: BulkOrderImport):
    from dateutil import parser
    from utils.order_processing import apply_cutoff_logic, split_bundle_items
    
    created_count = 0
    order_ids = []
    
    for order_data in data.orders:
        # Parse date string to datetime
        order_date = order_data.get("order_date")
        if isinstance(order_date, str):
            order_date = parser.parse(order_date).replace(tzinfo=None)
        
        # Apply cutoff logic if target_date not provided
        target_date = order_data.get("target_purchase_date")
        if target_date:
            if isinstance(target_date, str):
                target_date = parser.parse(target_date).date()
        else:
            # Auto-calculate target date based on cutoff logic
            target_date = await apply_cutoff_logic(db, order_date)
        
        order = Order(
            robot_in_order_id=order_data.get("robot_in_order_id"),
            mall_name=order_data.get("mall_name"),
            customer_name=order_data.get("customer_name"),
            order_date=order_date,
            target_purchase_date=target_date,
            order_status=OrderStatus.PENDING,
        )
        db.add(order)
        await db.flush()
        await db.refresh(order)
        order_ids.append(order.order_id)
        created_count += 1
        
        # Add order items if provided
        items = order_data.get("items", [])
        
        # Auto-create products for items if they don't exist
        await ensure_products_exist(db, items)
        
        for item_data in items:
            item = OrderItem(
                order_id=order.order_id,
                sku=item_data.get("sku", ""),
                product_name=item_data.get("product_name", ""),
                quantity=item_data.get("quantity", 1),
                unit_price=item_data.get("unit_price"),
                is_bundle=item_data.get("is_bundle", False),
                priority=item_data.get("priority", "normal"),
                item_status=ItemStatus.PENDING,
            )
            db.add(item)
        
        await db.flush()
    
    # Process bundle items for all imported orders
    for order_id in order_ids:
        await split_bundle_items(db, order_id)
    
    await db.commit()
    return {"message": f"{created_count}件の注文をインポートしました", "count": created_count, "order_ids": order_ids}

async def delete_order(db: AsyncSession, order_id: int):
    result = await db.execute(
        select(Order).where(Order.order_id == order_id)
    )
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="注文が見つかりません")
    
    # Delete related purchase list items first to avoid foreign key constraint violation
    result = await db.execute(
        select(PurchaseListItem)
        .join(OrderItem, PurchaseListItem.item_id == OrderItem.item_id)
        .where(OrderItem.order_id == order_id)
    )
    purchase_list_items = result.scalars().all()
    for pli in purchase_list_items:
        await db.delete(pli)
    
    # Now delete the order (OrderItems will be cascade deleted)
    await db.delete(order)
    await db.commit()
    return {"message": "注文を削除しました"}
