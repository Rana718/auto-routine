"""
Script to check and update user role in the database
Usage: python check_user_role.py
"""
import asyncio
from sqlalchemy import select
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

from db.schema import Staff, StaffRole
from config.env import settings

async def check_and_update_role(email: str):
    """Check user role and optionally update it to admin"""
    
    # Create async engine
    engine = create_async_engine(settings.db_url, echo=False)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with async_session() as session:
        # Find user by email
        result = await session.execute(
            select(Staff).where(Staff.email == email)
        )
        user = result.scalar_one_or_none()
        
        if not user:
            print(f"❌ User with email '{email}' not found!")
            return
        
        # Display current info
        print(f"\n📋 User Information:")
        print(f"   Email: {user.email}")
        print(f"   Name: {user.staff_name}")
        print(f"   Current Role: {user.role.value}")
        print(f"   Status: {user.status.value}")
        print(f"   Active: {user.is_active}")
        
        # Ask if user wants to update to admin
        if user.role != StaffRole.ADMIN:
            print(f"\n⚠️  User role is '{user.role.value}', not 'admin'")
            response = input("\n   Do you want to update this user to ADMIN role? (yes/no): ").strip().lower()
            
            if response in ['yes', 'y']:
                user.role = StaffRole.ADMIN
                await session.commit()
                print(f"\n✅ Successfully updated user role to ADMIN!")
                print(f"   Please log out and log back in for changes to take effect.")
            else:
                print(f"\n   No changes made.")
        else:
            print(f"\n✅ User already has ADMIN role!")

async def main():
    email = "admin@gmail.com"
    print(f"🔍 Checking role for user: {email}")
    await check_and_update_role(email)

if __name__ == "__main__":
    asyncio.run(main())
