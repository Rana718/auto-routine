"""
Test data generator for Auto Routine system
Based on Shop1 (A1) delivery code system:
- aa: 即日 (same day)
- bb: 5営業日以内 (within 5 business days)
- cc: 7-14日営業日以内 (within 7-14 business days)
"""

import asyncio
from datetime import datetime, date, timedelta
from sqlalchemy import select
from db.db import async_session_maker
from db.schema import (
    Store, Staff, Order, OrderItem, Product, ProductStoreMapping,
    StaffRole, StaffStatus, OrderStatus, ItemStatus, StockStatus
)
from middlewares.auth import hash_password

# Sample stores data (A1 format)
STORES_DATA = [
    {
        "store_name": "ヨドバシカメラ 秋葉原店",
        "store_code": "A1-001",
        "address": "東京都千代田区神田花岡町1-1",
        "district": "千代田区",
        "latitude": 35.6984,
        "longitude": 139.7731,
        "category": "家電",
        "priority_level": 1,
    },
    {
        "store_name": "ビックカメラ 新宿東口店",
        "store_code": "A1-002",
        "address": "東京都新宿区新宿3-29-1",
        "district": "新宿区",
        "latitude": 35.6910,
        "longitude": 139.7006,
        "category": "家電",
        "priority_level": 1,
    },
    {
        "store_name": "ドン・キホーテ 渋谷店",
        "store_code": "A1-003",
        "address": "東京都渋谷区道玄坂2-25-8",
        "district": "渋谷区",
        "latitude": 35.6580,
        "longitude": 139.6982,
        "category": "日用品",
        "priority_level": 2,
    },
    {
        "store_name": "マツモトキヨシ 六本木店",
        "store_code": "A1-004",
        "address": "東京都港区六本木6-1-24",
        "district": "港区",
        "latitude": 35.6627,
        "longitude": 139.7298,
        "category": "ドラッグストア",
        "priority_level": 2,
    },
    {
        "store_name": "成城石井 麻布十番店",
        "store_code": "A1-005",
        "address": "東京都港区麻布十番2-3-5",
        "district": "港区",
        "latitude": 35.6553,
        "longitude": 139.7368,
        "category": "食品・飲料",
        "priority_level": 2,
    },
]

# Sample products with delivery codes (A1 format)
PRODUCTS_DATA = [
    {"sku": "a-iv-066-1-aa", "product_name": "ソニー ワイヤレスイヤホン WF-1000XM5", "category": "家電", "delivery_code": "aa"},
    {"sku": "a-iv-066-2-bb", "product_name": "パナソニック ドライヤー ナノケア", "category": "家電", "delivery_code": "bb"},
    {"sku": "a-iv-066-3-cc", "product_name": "シャープ 空気清浄機", "category": "家電", "delivery_code": "cc"},
    {"sku": "a-iv-067-1-aa", "product_name": "ネスカフェ ゴールドブレンド 120g", "category": "食品・飲料", "delivery_code": "aa"},
    {"sku": "a-iv-067-2-bb", "product_name": "明治 ザ・チョコレート 10枚セット", "category": "食品・飲料", "delivery_code": "bb"},
    {"sku": "a-iv-068-1-aa", "product_name": "花王 アタック 洗濯洗剤", "category": "日用品", "delivery_code": "aa"},
    {"sku": "a-iv-068-2-cc", "product_name": "ユニ・チャーム マスク 50枚入", "category": "日用品", "delivery_code": "cc"},
    {"sku": "a-iv-069-1-bb", "product_name": "ロート製薬 目薬", "category": "医薬品", "delivery_code": "bb"},
]

# Sample staff
STAFF_DATA = [
    {
        "staff_name": "田中太郎",
        "staff_code": "BUYER001",
        "email": "tanaka@example.com",
        "password": "password123",
        "role": StaffRole.BUYER,
        "status": StaffStatus.ACTIVE,
        "start_location_name": "オフィス（六本木）",
        "max_daily_capacity": 20,
    },
    {
        "staff_name": "佐藤花子",
        "staff_code": "BUYER002",
        "email": "sato@example.com",
        "password": "password123",
        "role": StaffRole.BUYER,
        "status": StaffStatus.ACTIVE,
        "start_location_name": "オフィス（六本木）",
        "max_daily_capacity": 20,
    },
    {
        "staff_name": "鈴木一郎",
        "staff_code": "SUPER001",
        "email": "suzuki@example.com",
        "password": "password123",
        "role": StaffRole.SUPERVISOR,
        "status": StaffStatus.ACTIVE,
        "start_location_name": "オフィス（六本木）",
        "max_daily_capacity": 15,
    },
    {
        "staff_name": "管理者",
        "staff_code": "ADMIN001",
        "email": "admin@example.com",
        "password": "admin123",
        "role": StaffRole.ADMIN,
        "status": StaffStatus.ACTIVE,
        "start_location_name": "オフィス（六本木）",
        "max_daily_capacity": 10,
    },
]

# Sample orders
def generate_orders():
    today = date.today()
    orders = []
    
    for i in range(1, 11):
        order = {
            "robot_in_order_id": f"RO-2025-{1000 + i}",
            "mall_name": "楽天市場" if i % 2 == 0 else "Amazon",
            "customer_name": f"顧客{i:03d}",
            "order_date": datetime.now() - timedelta(hours=i),
            "target_purchase_date": today,
            "order_status": OrderStatus.PENDING,
        }
        orders.append(order)
    
    return orders

def generate_order_items(order_id: int, products: list):
    """Generate 2-4 items per order"""
    import random
    items = []
    selected_products = random.sample(products, min(random.randint(2, 4), len(products)))
    
    for product in selected_products:
        item = {
            "order_id": order_id,
            "sku": product.sku,
            "product_name": product.product_name,
            "quantity": random.randint(1, 3),
            "unit_price": random.randint(1000, 50000),
            "item_status": ItemStatus.PENDING,
            "priority": "high" if "aa" in product.sku else "normal",
        }
        items.append(item)
    
    return items


async def clear_all_data():
    """Clear all test data"""
    async with async_session_maker() as session:
        # Delete in correct order due to foreign keys
        await session.execute("DELETE FROM purchase_failures")
        await session.execute("DELETE FROM route_stops")
        await session.execute("DELETE FROM routes")
        await session.execute("DELETE FROM purchase_list_items")
        await session.execute("DELETE FROM purchase_lists")
        await session.execute("DELETE FROM order_items")
        await session.execute("DELETE FROM orders")
        await session.execute("DELETE FROM product_store_mapping")
        await session.execute("DELETE FROM store_inventory")
        await session.execute("DELETE FROM products")
        await session.execute("DELETE FROM stores")
        await session.execute("DELETE FROM staff")
        await session.commit()
        print("✓ All data cleared")


async def seed_data():
    """Seed test data"""
    async with async_session_maker() as session:
        # 1. Create stores
        stores = []
        for store_data in STORES_DATA:
            store = Store(**store_data)
            session.add(store)
            stores.append(store)
        await session.flush()
        print(f"✓ Created {len(stores)} stores")
        
        # 2. Create products
        products = []
        for product_data in PRODUCTS_DATA:
            delivery_code = product_data.pop("delivery_code")
            product = Product(**product_data)
            session.add(product)
            products.append(product)
        await session.flush()
        print(f"✓ Created {len(products)} products")
        
        # 3. Create product-store mappings
        mappings = []
        for product in products:
            # Map each product to 2-3 stores
            import random
            selected_stores = random.sample(stores, min(random.randint(2, 3), len(stores)))
            for idx, store in enumerate(selected_stores):
                mapping = ProductStoreMapping(
                    product_id=product.product_id,
                    store_id=store.store_id,
                    is_primary_store=(idx == 0),
                    priority=idx + 1,
                    stock_status=StockStatus.IN_STOCK,
                )
                session.add(mapping)
                mappings.append(mapping)
        await session.flush()
        print(f"✓ Created {len(mappings)} product-store mappings")
        
        # 4. Create staff
        staff_list = []
        for staff_data in STAFF_DATA:
            password = staff_data.pop("password")
            staff = Staff(**staff_data, password_hash=hash_password(password))
            session.add(staff)
            staff_list.append(staff)
        await session.flush()
        print(f"✓ Created {len(staff_list)} staff members")
        
        # 5. Create orders
        orders_data = generate_orders()
        orders = []
        for order_data in orders_data:
            order = Order(**order_data)
            session.add(order)
            orders.append(order)
        await session.flush()
        print(f"✓ Created {len(orders)} orders")
        
        # 6. Create order items
        all_items = []
        for order in orders:
            items_data = generate_order_items(order.order_id, products)
            for item_data in items_data:
                item = OrderItem(**item_data)
                session.add(item)
                all_items.append(item)
        await session.flush()
        print(f"✓ Created {len(all_items)} order items")
        
        await session.commit()
        print("\n✅ Test data seeded successfully!")
        print(f"\nLogin credentials:")
        print(f"  Admin:      admin@example.com / admin123")
        print(f"  Supervisor: suzuki@example.com / password123")
        print(f"  Buyer 1:    tanaka@example.com / password123")
        print(f"  Buyer 2:    sato@example.com / password123")


async def main():
    print("🔄 Seeding test data...\n")
    await clear_all_data()
    await seed_data()


if __name__ == "__main__":
    asyncio.run(main())
