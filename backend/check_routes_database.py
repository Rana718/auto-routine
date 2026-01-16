"""
Database Route Checker Script
Checks if routes are properly generated and identifies issues
"""

import asyncio
import sys
from datetime import date, timedelta
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

# Add backend to path
sys.path.insert(0, ".")

from db.db import async_session_maker
from db.schema import (
    Order, OrderItem, Staff, Store, PurchaseList, PurchaseListItem,
    Route, RouteStop, OrderStatus, ItemStatus
)


async def check_routes_database(target_date: date = None):
    """Comprehensive database check for route generation"""
    
    if not target_date:
        target_date = date.today()
    
    async with async_session_maker() as db:
        print("\n" + "=" * 80)
        print(f"🔍 ROUTE DATABASE CHECK - {target_date}")
        print("=" * 80 + "\n")
        
        # ========================================
        # 1. CHECK ORDERS
        # ========================================
        print("📦 STEP 1: Checking Orders...")
        print("-" * 80)
        
        result = await db.execute(
            select(Order)
            .where(Order.target_purchase_date == target_date)
        )
        orders = result.scalars().all()
        
        print(f"✓ Total orders for {target_date}: {len(orders)}")
        
        if len(orders) == 0:
            print("❌ NO ORDERS FOUND!")
            print("   → You need to create orders first")
            print("   → Orders should have target_purchase_date set to", target_date)
            return
        
        # Show order statuses
        result = await db.execute(
            select(
                Order.order_status,
                func.count(Order.order_id).label('count')
            )
            .where(Order.target_purchase_date == target_date)
            .group_by(Order.order_status)
        )
        status_counts = result.all()
        
        print("   Order Status Breakdown:")
        for status, count in status_counts:
            print(f"   - {status.value}: {count}")
        
        # Check order items
        result = await db.execute(
            select(func.count(OrderItem.item_id))
            .join(Order)
            .where(Order.target_purchase_date == target_date)
        )
        total_items = result.scalar() or 0
        print(f"✓ Total order items: {total_items}")
        
        if total_items == 0:
            print("❌ NO ORDER ITEMS FOUND!")
            print("   → Orders exist but have no items")
            return
        
        # Check if SKUs exist in Products table
        from db.schema import Product
        result = await db.execute(
            select(OrderItem.sku)
            .join(Order)
            .where(Order.target_purchase_date == target_date)
            .distinct()
        )
        order_skus = [sku for sku, in result.all()]
        
        result = await db.execute(
            select(func.count(Product.product_id))
        )
        products_count = result.scalar() or 0
        
        if products_count == 0:
            print("❌ NO PRODUCTS IN DATABASE!")
            print("   → Order items have SKUs, but Product table is empty")
            print("   → Items cannot be assigned without matching products")
            print("   → Create products with matching SKUs:")
            for sku in order_skus[:5]:
                print(f"      - {sku}")
            return
        
        print(f"✓ Total products in database: {products_count}")
        
        # Check if order item SKUs match products
        if order_skus:
            result = await db.execute(
                select(Product.sku).where(Product.sku.in_(order_skus))
            )
            matched_skus = set(sku for sku, in result.all())
            missing_skus = set(order_skus) - matched_skus
            
            if missing_skus:
                print(f"❌ {len(missing_skus)} ORDER ITEM SKUs NOT FOUND IN PRODUCTS!")
                print("   → These SKUs have no matching products:")
                for sku in list(missing_skus)[:5]:
                    print(f"      - {sku}")
                print("   → Create products with these SKUs first")
                print("   → Or import from CSV: /api/products/import")
                return
        
        # ========================================
        # 2. CHECK STAFF
        # ========================================
        print("\n👥 STEP 2: Checking Staff...")
        print("-" * 80)
        
        # Check all active staff
        result = await db.execute(
            select(Staff)
            .where(Staff.is_active == True)
        )
        all_staff = result.scalars().all()
        
        # Filter buyers only (who actually get routes)
        from db.schema import StaffRole
        buyers = [s for s in all_staff if s.role == StaffRole.BUYER]
        
        print(f"✓ Total active staff: {len(all_staff)}")
        print(f"✓ Buyers (route-assigned): {len(buyers)}")
        
        if len(buyers) == 0:
            print("❌ NO BUYER STAFF FOUND!")
            print("   → You need buyers with role='buyer' for route assignment")
            print("   → Admins don't get routes, only buyers do")
            return
        
        for staff in buyers:
            print(f"   - {staff.staff_name} (ID: {staff.staff_id}, Role: {staff.role.value})")
        
        # ========================================
        # 3. CHECK STORES
        # ========================================
        print("\n🏪 STEP 3: Checking Stores...")
        print("-" * 80)
        
        result = await db.execute(select(Store))
        stores = result.scalars().all()
        
        print(f"✓ Total stores: {len(stores)}")
        
        if len(stores) == 0:
            print("❌ NO STORES FOUND!")
            print("   → You need to create stores with valid coordinates")
            return
        
        # Check stores with coordinates
        stores_with_coords = [s for s in stores if s.latitude and s.longitude]
        print(f"✓ Stores with coordinates: {len(stores_with_coords)}/{len(stores)}")
        
        if len(stores_with_coords) == 0:
            print("⚠️  WARNING: No stores have latitude/longitude!")
            print("   → Routes need stores with coordinates for optimization")
        
        # ========================================
        # 4. CHECK PURCHASE LISTS
        # ========================================
        print("\n📋 STEP 4: Checking Purchase Lists...")
        print("-" * 80)
        
        result = await db.execute(
            select(PurchaseList)
            .where(PurchaseList.purchase_date == target_date)
        )
        purchase_lists = result.scalars().all()
        
        print(f"✓ Total purchase lists for {target_date}: {len(purchase_lists)}")
        
        if len(purchase_lists) == 0:
            print("⚠️  NO PURCHASE LISTS FOUND!")
            print("   → Purchase lists are created during auto-assignment")
            print("   → Run: POST /api/automation/auto-assign?target_date={target_date}")
            print("   → Or run: python -c 'from services.staff_assignment import auto_assign_daily_orders; import asyncio; asyncio.run(auto_assign_daily_orders(db, date.today()))'")
        else:
            for pl in purchase_lists:
                # Get staff name
                result = await db.execute(
                    select(Staff).where(Staff.staff_id == pl.staff_id)
                )
                staff = result.scalar_one_or_none()
                staff_name = staff.staff_name if staff else "Unknown"
                
                print(f"   - List #{pl.list_id}: {staff_name} - {pl.total_items} items (Status: {pl.list_status.value})")
        
        # Check purchase list items
        result = await db.execute(
            select(func.count(PurchaseListItem.list_item_id))
            .join(PurchaseList)
            .where(PurchaseList.purchase_date == target_date)
        )
        pl_items = result.scalar() or 0
        print(f"✓ Total items in purchase lists: {pl_items}")
        
        # ========================================
        # 5. CHECK ROUTES
        # ========================================
        print("\n🗺️  STEP 5: Checking Routes...")
        print("-" * 80)
        
        result = await db.execute(
            select(Route)
            .where(Route.route_date == target_date)
        )
        routes = result.scalars().all()
        
        print(f"✓ Total routes for {target_date}: {len(routes)}")
        
        if len(routes) == 0:
            print("❌ NO ROUTES FOUND!")
            
            if len(purchase_lists) == 0:
                print("   → First create purchase lists (auto-assign orders)")
                print("   → Then generate routes")
            else:
                print("   → Purchase lists exist but routes not generated")
                print("   → Run: POST /api/automation/generate-routes?target_date={target_date}")
                print("   → Or click 'ルート再生成' button in the UI")
            
            # Show detailed status
            print("\n📊 SUMMARY:")
            print(f"   ✓ Orders: {len(orders)}")
            print(f"   ✓ Order Items: {total_items}")
            print(f"   ✓ Staff: {len(buyers)}")
            print(f"   ✓ Stores: {len(stores)}")
            print(f"   {'✓' if len(purchase_lists) > 0 else '❌'} Purchase Lists: {len(purchase_lists)}")
            print(f"   ❌ Routes: {len(routes)}")
            print("\n💡 Next Step: Generate routes!")
            return
        
        # Show route details
        print("   Route Details:")
        for route in routes:
            # Get staff name
            result = await db.execute(
                select(Staff).where(Staff.staff_id == route.staff_id)
            )
            staff = result.scalar_one_or_none()
            staff_name = staff.staff_name if staff else "Unknown"
            
            # Get stops
            result = await db.execute(
                select(func.count(RouteStop.stop_id))
                .where(RouteStop.route_id == route.route_id)
            )
            stops_count = result.scalar() or 0
            
            print(f"   - Route #{route.route_id}: {staff_name}")
            print(f"     Status: {route.route_status.value}")
            print(f"     Stops: {stops_count}")
            print(f"     Distance: {route.total_distance_km or 0:.2f} km")
            print(f"     Est. Time: {route.estimated_time_minutes or 0} min")
        
        # ========================================
        # 6. CHECK ROUTE STOPS
        # ========================================
        print("\n📍 STEP 6: Checking Route Stops...")
        print("-" * 80)
        
        result = await db.execute(
            select(RouteStop)
            .join(Route)
            .where(Route.route_date == target_date)
            .order_by(Route.route_id, RouteStop.stop_sequence)
        )
        stops = result.scalars().all()
        
        print(f"✓ Total route stops: {len(stops)}")
        
        if len(stops) == 0 and len(routes) > 0:
            print("❌ ROUTES EXIST BUT NO STOPS!")
            print("   → Route generation may have failed")
            print("   → Check backend logs for errors")
        
        # Show first route's stops as sample
        if len(routes) > 0 and len(stops) > 0:
            first_route = routes[0]
            result = await db.execute(
                select(RouteStop)
                .where(RouteStop.route_id == first_route.route_id)
                .order_by(RouteStop.stop_sequence)
            )
            sample_stops = result.scalars().all()
            
            print(f"\n   Sample Route #{first_route.route_id} Stops:")
            for stop in sample_stops[:5]:
                result = await db.execute(
                    select(Store).where(Store.store_id == stop.store_id)
                )
                store = result.scalar_one_or_none()
                store_name = store.store_name if store else f"Store #{stop.store_id}"
                
                print(f"   {stop.stop_sequence}. {store_name} - {stop.items_count} items (Status: {stop.stop_status.value})")
            
            if len(sample_stops) > 5:
                print(f"   ... and {len(sample_stops) - 5} more stops")
        
        # ========================================
        # FINAL SUMMARY
        # ========================================
        print("\n" + "=" * 80)
        print("📊 FINAL SUMMARY")
        print("=" * 80)
        print(f"✓ Orders: {len(orders)}")
        print(f"✓ Order Items: {total_items}")
        print(f"✓ Staff: {len(staff_list)}")
        print(f"✓ Stores: {len(stores)} ({len(stores_with_coords)} with coordinates)")
        print(f"{'✓' if len(purchase_lists) > 0 else '❌'} Purchase Lists: {len(purchase_lists)}")
        print(f"{'✓' if len(routes) > 0 else '❌'} Routes: {len(routes)}")
        print(f"{'✓' if len(stops) > 0 else '❌'} Route Stops: {len(stops)}")
        
        if len(routes) > 0 and len(stops) > 0:
            print("\n✅ ROUTES ARE WORKING CORRECTLY!")
            print(f"   API should return {len(routes)} routes for {target_date}")
            print("\n   If API still returns [] (empty array), check:")
            print("   1. Are you using the correct date parameter?")
            print("   2. Is the authentication token valid?")
            print("   3. Check backend logs for errors")
        elif len(routes) == 0:
            print("\n❌ NO ROUTES - GENERATION NEEDED")
            print("   Run route generation to create routes")
        else:
            print("\n⚠️  ROUTES INCOMPLETE - CHECK LOGS")
            print("   Routes exist but may have issues")
        
        print("=" * 80 + "\n")


async def quick_fix_routes(target_date: date = None):
    """Try to auto-fix common route issues"""
    
    if not target_date:
        target_date = date.today()
    
    async with async_session_maker() as db:
        print("\n🔧 ATTEMPTING AUTO-FIX...\n")
        
        # Check if orders exist
        result = await db.execute(
            select(func.count(Order.order_id))
            .where(Order.target_purchase_date == target_date)
        )
        order_count = result.scalar() or 0
        
        if order_count == 0:
            print("❌ Cannot fix: No orders found for", target_date)
            return
        
        # Check if staff exist
        result = await db.execute(
            select(func.count(Staff.staff_id))
            .where(Staff.is_active == True)
        )
        staff_count = result.scalar() or 0
        
        if staff_count == 0:
            print("❌ Cannot fix: No active staff found")
            return
        
        # Try to run auto-assignment
        print("Step 1: Running auto-assignment...")
        from services.staff_assignment import auto_assign_daily_orders
        result = await auto_assign_daily_orders(db, target_date)
        print(f"✓ Assigned {result.get('assigned_count', 0)} orders")
        
        await db.commit()
        
        # Try to generate routes
        print("\nStep 2: Generating routes...")
        from services.route_optimization import generate_all_routes_for_date
        route_ids = await generate_all_routes_for_date(db, target_date)
        print(f"✓ Generated {len(route_ids)} routes")
        
        await db.commit()
        
        print("\n✅ AUTO-FIX COMPLETED!")
        print(f"   Created {len(route_ids)} routes")
        print(f"   Route IDs: {route_ids}")


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Check route database status")
    parser.add_argument("--date", type=str, help="Target date (YYYY-MM-DD), default=today")
    parser.add_argument("--fix", action="store_true", help="Try to auto-fix route generation")
    parser.add_argument("--yesterday", action="store_true", help="Check yesterday's routes")
    parser.add_argument("--tomorrow", action="store_true", help="Check tomorrow's routes")
    
    args = parser.parse_args()
    
    # Determine target date
    if args.date:
        from datetime import datetime
        target_date = datetime.strptime(args.date, "%Y-%m-%d").date()
    elif args.yesterday:
        target_date = date.today() - timedelta(days=1)
    elif args.tomorrow:
        target_date = date.today() + timedelta(days=1)
    else:
        target_date = date.today()
    
    if args.fix:
        asyncio.run(quick_fix_routes(target_date))
        print("\n" + "=" * 80)
        print("Re-checking after fix...")
        print("=" * 80)
    
    asyncio.run(check_routes_database(target_date))
