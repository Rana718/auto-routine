"""
Script to delete all data from database tables (keeps tables/schema intact)
"""
import asyncio
from sqlalchemy import text, inspect
from db.db import engine

async def clear_all_data():
    """Delete all data from all tables dynamically"""
    async with engine.begin() as conn:
        # Get all table names dynamically
        result = await conn.execute(text("""
            SELECT tablename 
            FROM pg_tables 
            WHERE schemaname = 'public'
            AND tablename != 'alembic_version'
            ORDER BY tablename
        """))
        
        tables = [row[0] for row in result]
        
        if not tables:
            print("No tables found!")
            return
        
        print(f"Found {len(tables)} tables to clear\n")
        
        # Clear all tables using TRUNCATE CASCADE
        for table in tables:
            try:
                await conn.execute(text(f"TRUNCATE TABLE {table} CASCADE"))
                print(f"✓ Cleared {table}")
            except Exception as e:
                print(f"✗ Error clearing {table}: {e}")
        
        print(f"\n✅ All {len(tables)} tables cleared!")

if __name__ == "__main__":
    asyncio.run(clear_all_data())
