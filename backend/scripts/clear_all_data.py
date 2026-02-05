"""
Clear all data from database for fresh testing.

This script deletes:
- Orders and Order Items
- Products
- Stores
- Product-Store Mappings
- Purchase Lists and Items
- Routes and Route Stops

Usage:
    cd backend
    python scripts/clear_all_data.py
"""

import asyncio
import sys
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import text
from db.db import async_session_maker


async def clear_all_data():
    """Delete all data from database"""

    print("=" * 60)
    print("CLEARING ALL DATA")
    print("=" * 60)

    # Tables to clear (order matters for foreign keys)
    tables_to_clear = [
        ("route_stops", "Route Stops"),
        ("routes", "Routes"),
        ("purchase_list_items", "Purchase List Items"),
        ("purchase_lists", "Purchase Lists"),
        ("purchase_failures", "Purchase Failures"),
        ("order_items", "Order Items"),
        ("orders", "Orders"),
        ("store_inventory", "Store Inventory"),
        ("product_store_mapping", "Product-Store Mappings"),
        ("products", "Products"),
        ("stores", "Stores"),
    ]

    for table_name, display_name in tables_to_clear:
        # Use a fresh session for each table to avoid transaction issues
        async with async_session_maker() as db:
            try:
                # Get count before truncate
                result = await db.execute(text(f"SELECT COUNT(*) FROM {table_name}"))
                count = result.scalar()

                # Use TRUNCATE CASCADE for PostgreSQL
                await db.execute(text(f"TRUNCATE TABLE {table_name} CASCADE"))
                await db.commit()
                print(f"   Deleted {count} rows from {display_name}")
            except Exception as e:
                await db.rollback()
                print(f"   Skipped {display_name} (table may not exist)")

    print("\n" + "=" * 60)
    print("ALL DATA CLEARED SUCCESSFULLY")
    print("=" * 60)
    print("\nYou can now:")
    print("1. Import purchase list CSV (Settings → 購入リストCSVインポート)")
    print("2. Import test orders (Orders → インポート)")
    print("3. Generate routes (Routes → ルート生成)")


if __name__ == "__main__":
    asyncio.run(clear_all_data())
