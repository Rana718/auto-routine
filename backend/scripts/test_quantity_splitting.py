"""
Test script for quantity splitting flow.

This script tests the complete flow:
1. Import client CSV data (products, stores, mappings)
2. Create test orders from the imported products
3. Run automation (staff assignment + route generation)
4. Verify quantity splitting in purchase lists

Usage:
    cd backend
    python scripts/test_quantity_splitting.py
"""

import asyncio
import sys
import os
from pathlib import Path
from datetime import date, datetime

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import select, func
from db.db import AsyncSessionLocal, engine
from db.schema import (
    Base, Product, Store, ProductStoreMapping, Order, OrderItem,
    PurchaseList, PurchaseListItem, Route, RouteStop, Staff,
    OrderStatus, PurchaseStatus, StockStatus
)


async def test_flow():
    """Test the complete quantity splitting flow"""

    print("=" * 60)
    print("QUANTITY SPLITTING TEST")
    print("=" * 60)

    async with AsyncSessionLocal() as db:
        # Step 1: Check if data exists
        print("\n[1] Checking existing data...")

        product_count = await db.scalar(select(func.count(Product.product_id)))
        store_count = await db.scalar(select(func.count(Store.store_id)))
        mapping_count = await db.scalar(select(func.count(ProductStoreMapping.mapping_id)))

        print(f"   Products: {product_count}")
        print(f"   Stores: {store_count}")
        print(f"   Mappings: {mapping_count}")

        if product_count == 0 or store_count == 0:
            print("\n   ⚠ No data found. Please import the client CSV first!")
            print("   Use the Settings page -> Data Import -> Import Purchase List")
            print("   Or call POST /api/settings/data/import-purchase-list")
            return

        # Step 2: Show products with multiple store mappings (quantity splitting candidates)
        print("\n[2] Products with quantity splitting (multiple stores)...")

        result = await db.execute(
            select(Product.sku, Product.product_name, func.count(ProductStoreMapping.store_id).label('store_count'))
            .join(ProductStoreMapping, ProductStoreMapping.product_id == Product.product_id)
            .group_by(Product.product_id)
            .having(func.count(ProductStoreMapping.store_id) > 1)
            .order_by(func.count(ProductStoreMapping.store_id).desc())
            .limit(10)
        )
        multi_store_products = result.all()

        if multi_store_products:
            print(f"   Found {len(multi_store_products)} products with multiple stores:")
            for sku, name, count in multi_store_products:
                print(f"   - {sku}: {name[:30]}... ({count} stores)")
        else:
            print("   No products with multiple stores found")

        # Step 3: Show sample product with store allocations
        print("\n[3] Sample product store allocations...")

        # Find a product with multiple stores
        if multi_store_products:
            sample_sku = multi_store_products[0][0]

            result = await db.execute(
                select(
                    Product.sku, Product.product_name,
                    Store.store_name, Store.address,
                    ProductStoreMapping.max_daily_quantity,
                    ProductStoreMapping.current_available
                )
                .join(ProductStoreMapping, ProductStoreMapping.product_id == Product.product_id)
                .join(Store, Store.store_id == ProductStoreMapping.store_id)
                .where(Product.sku == sample_sku)
            )
            allocations = result.all()

            print(f"   Product: {sample_sku}")
            total_qty = 0
            for sku, name, store, addr, max_qty, avail in allocations:
                qty = max_qty or 0
                total_qty += qty
                print(f"   - {store}: {qty}個")
            print(f"   Total: {total_qty}個 across {len(allocations)} stores")

        # Step 4: Check for existing orders
        print("\n[4] Checking existing orders...")

        order_count = await db.scalar(select(func.count(Order.order_id)))
        print(f"   Total orders: {order_count}")

        # Step 5: Check for purchase lists with quantity splitting
        print("\n[5] Checking purchase lists for quantity splitting...")

        result = await db.execute(
            select(
                PurchaseListItem.item_id,
                OrderItem.sku,
                OrderItem.quantity.label('ordered_qty'),
                Store.store_name,
                PurchaseListItem.quantity_to_purchase
            )
            .join(OrderItem, OrderItem.item_id == PurchaseListItem.item_id)
            .join(Store, Store.store_id == PurchaseListItem.store_id)
            .order_by(PurchaseListItem.item_id)
            .limit(20)
        )
        list_items = result.all()

        if list_items:
            print(f"   Found {len(list_items)} purchase list items:")
            current_item_id = None
            for item_id, sku, ordered, store, qty in list_items:
                if item_id != current_item_id:
                    print(f"\n   Item {item_id} ({sku}) - Ordered: {ordered}個")
                    current_item_id = item_id
                print(f"      → {store}: {qty}個")
        else:
            print("   No purchase list items found")
            print("   Run 'Generate Routes' from the Routes page to create them")

        # Step 6: Check routes with total_quantity
        print("\n[6] Checking routes with quantity display...")

        result = await db.execute(
            select(
                Route.route_id,
                Staff.full_name,
                RouteStop.stop_id,
                Store.store_name,
                func.count(PurchaseListItem.list_item_id).label('items_count'),
                func.sum(PurchaseListItem.quantity_to_purchase).label('total_quantity')
            )
            .select_from(Route)
            .join(Staff, Staff.staff_id == Route.staff_id)
            .join(RouteStop, RouteStop.route_id == Route.route_id)
            .join(Store, Store.store_id == RouteStop.store_id)
            .join(PurchaseList, PurchaseList.staff_id == Route.staff_id)
            .join(PurchaseListItem,
                  (PurchaseListItem.list_id == PurchaseList.list_id) &
                  (PurchaseListItem.store_id == RouteStop.store_id))
            .group_by(Route.route_id, Staff.full_name, RouteStop.stop_id, Store.store_name)
            .limit(10)
        )
        route_stops = result.all()

        if route_stops:
            print(f"   Found route stops with quantities:")
            for route_id, staff, stop_id, store, items, qty in route_stops:
                print(f"   Route {route_id} ({staff}) - {store}:")
                print(f"      Items: {items}, Total Quantity: {qty}個")
        else:
            print("   No routes found")
            print("   Run 'Generate Routes' from the Routes page")

        print("\n" + "=" * 60)
        print("TEST COMPLETE")
        print("=" * 60)

        print("\nTo test the full flow:")
        print("1. Import CSV: POST /api/settings/data/import-purchase-list")
        print("2. Create orders from imported products")
        print("3. Click 'Generate Routes' on Routes page")
        print("4. Check that quantities are split across stores")


async def create_test_orders():
    """Create test orders from imported products"""

    print("\n[CREATE TEST ORDERS]")

    async with AsyncSessionLocal() as db:
        # Get some products with multiple store mappings
        result = await db.execute(
            select(Product)
            .join(ProductStoreMapping, ProductStoreMapping.product_id == Product.product_id)
            .group_by(Product.product_id)
            .having(func.count(ProductStoreMapping.store_id) > 1)
            .limit(5)
        )
        products = result.scalars().all()

        if not products:
            print("   No products found with multiple stores")
            return

        # Create a test order
        order = Order(
            robot_in_order_id=f"TEST-{datetime.now().strftime('%Y%m%d%H%M%S')}",
            mall_name="Test Mall",
            customer_name="Test Customer",
            order_date=datetime.now(),
            target_purchase_date=date.today(),
            order_status=OrderStatus.PENDING
        )
        db.add(order)
        await db.flush()

        # Add items with various quantities
        quantities = [47, 14, 8, 5, 3]  # Test different quantities

        for i, product in enumerate(products):
            qty = quantities[i] if i < len(quantities) else 1
            item = OrderItem(
                order_id=order.order_id,
                sku=product.sku,
                product_name=product.product_name,
                quantity=qty,
                unit_price=1000
            )
            db.add(item)
            print(f"   Added: {product.sku} x {qty}")

        await db.commit()
        print(f"\n   Created order: {order.robot_in_order_id}")
        print("   Now run 'Generate Routes' to see quantity splitting in action!")


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description='Test quantity splitting flow')
    parser.add_argument('--create-orders', action='store_true', help='Create test orders')
    args = parser.parse_args()

    if args.create_orders:
        asyncio.run(create_test_orders())
    else:
        asyncio.run(test_flow())
