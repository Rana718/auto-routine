#!/usr/bin/env python3
"""
Quick fix verification
"""

# Check if OrderItemCreate model is fixed
try:
    from db.schema import OrderItemCreate
    
    # Test creating an instance without order_id
    item = OrderItemCreate(
        sku="test-sku",
        product_name="Test Product",
        quantity=1,
        priority="high"
    )
    print("✅ OrderItemCreate model fixed - no order_id required")
    
except Exception as e:
    print(f"❌ OrderItemCreate model issue: {e}")

# Check if StaffStats model is fixed
try:
    from models.staff import StaffStats
    
    # Test creating with correct fields
    stats = StaffStats(
        total_staff=4,
        active_today=3,
        en_route=1,
        completed_orders=0
    )
    print("✅ StaffStats model fixed - correct fields")
    
except Exception as e:
    print(f"❌ StaffStats model issue: {e}")

print("\n🔧 Fixes applied:")
print("1. OrderItemCreate: Removed order_id requirement (comes from URL)")
print("2. StaffStats: Fixed field names to match controller output")
print("3. OrderItem creation: Added priority field")
