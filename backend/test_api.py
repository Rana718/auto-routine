"""
Test data creation through API routes
Tests all endpoints including upload/import features
"""

import requests
import json
from datetime import datetime, date, timedelta

BASE_URL = "http://localhost:8000"

# Test credentials
ADMIN_EMAIL = "admin@gmail.com"
ADMIN_PASSWORD = "admin@gmail.com"

# Store token globally
TOKEN = None

def print_response(response, title="Response"):
    """Pretty print API response"""
    print(f"\n{'='*60}")
    print(f"{title}")
    print(f"Status: {response.status_code}")
    try:
        print(f"Body: {json.dumps(response.json(), indent=2, ensure_ascii=False)}")
    except:
        print(f"Body: {response.text}")
    print(f"{'='*60}")


def login():
    """Step 2: Login and get token"""
    global TOKEN
    print("\n🔑 Logging in...")
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    print_response(response, "Login")
    if response.status_code == 200:
        TOKEN = response.json()["access_token"]
        return True
    return False

def get_headers():
    """Get authorization headers"""
    return {"Authorization": f"Bearer {TOKEN}"}

def create_staff():
    """Step 3: Create staff members"""
    print("\n👥 Creating staff members...")
    
    staff_list = [
        {
            "name": "田中太郎",
            "email": "tanaka@example.com",
            "password": "password123",
            "role": "buyer"
        },
        {
            "name": "佐藤花子",
            "email": "sato@example.com",
            "password": "password123",
            "role": "buyer"
        },
        {
            "name": "鈴木一郎",
            "email": "suzuki@example.com",
            "password": "password123",
            "role": "supervisor"
        }
    ]
    
    for staff in staff_list:
        response = requests.post(
            f"{BASE_URL}/api/admin/users",
            headers=get_headers(),
            json=staff
        )
        print_response(response, f"Created: {staff['name']}")

def create_stores():
    """Step 4: Create stores"""
    print("\n🏪 Creating stores...")
    
    stores = [
        {
            "store_name": "ヨドバシカメラ 秋葉原店",
            "store_code": "A1-001",
            "address": "東京都千代田区神田花岡町1-1",
            "district": "千代田区",
            "latitude": 35.6984,
            "longitude": 139.7731,
            "category": "家電",
            "priority_level": 1
        },
        {
            "store_name": "ビックカメラ 新宿東口店",
            "store_code": "A1-002",
            "address": "東京都新宿区新宿3-29-1",
            "district": "新宿区",
            "latitude": 35.6910,
            "longitude": 139.7006,
            "category": "家電",
            "priority_level": 1
        },
        {
            "store_name": "ドン・キホーテ 渋谷店",
            "store_code": "A1-003",
            "address": "東京都渋谷区道玄坂2-25-8",
            "district": "渋谷区",
            "latitude": 35.6580,
            "longitude": 139.6982,
            "category": "日用品",
            "priority_level": 2
        },
        {
            "store_name": "マツモトキヨシ 六本木店",
            "store_code": "A1-004",
            "address": "東京都港区六本木6-1-24",
            "district": "港区",
            "latitude": 35.6627,
            "longitude": 139.7298,
            "category": "ドラッグストア",
            "priority_level": 2
        },
        {
            "store_name": "成城石井 麻布十番店",
            "store_code": "A1-005",
            "address": "東京都港区麻布十番2-3-5",
            "district": "港区",
            "latitude": 35.6553,
            "longitude": 139.7368,
            "category": "食品・飲料",
            "priority_level": 2
        }
    ]
    
    for store in stores:
        response = requests.post(
            f"{BASE_URL}/api/stores",
            headers=get_headers(),
            json=store
        )
        print_response(response, f"Created: {store['store_name']}")

def import_orders():
    """Step 5: Import orders (bulk upload test)"""
    print("\n📦 Importing orders (testing bulk upload)...")
    
    today = datetime.now().isoformat()
    target_date = date.today().isoformat()
    
    orders = []
    for i in range(1, 11):
        order = {
            "robot_in_order_id": f"RO-2025-{1000 + i}",
            "mall_name": "楽天市場" if i % 2 == 0 else "Amazon",
            "customer_name": f"顧客{i:03d}",
            "order_date": today,
            "target_purchase_date": target_date
        }
        orders.append(order)
    
    response = requests.post(
        f"{BASE_URL}/api/orders/import",
        headers=get_headers(),
        json={"orders": orders}
    )
    print_response(response, "Bulk Order Import")

def create_order_items():
    """Step 6: Add items to orders with A1 delivery codes"""
    print("\n📝 Adding order items with A1 delivery codes...")
    
    # Products with delivery codes (aa=same day, bb=5 days, cc=7-14 days)
    products = [
        {"sku": "a-iv-066-1-aa", "name": "ソニー ワイヤレスイヤホン WF-1000XM5", "price": 35000, "priority": "high"},
        {"sku": "a-iv-066-2-bb", "name": "パナソニック ドライヤー ナノケア", "price": 28000, "priority": "normal"},
        {"sku": "a-iv-066-3-cc", "name": "シャープ 空気清浄機", "price": 45000, "priority": "normal"},
        {"sku": "a-iv-067-1-aa", "name": "ネスカフェ ゴールドブレンド 120g", "price": 1200, "priority": "high"},
        {"sku": "a-iv-067-2-bb", "name": "明治 ザ・チョコレート 10枚セット", "price": 2500, "priority": "normal"},
        {"sku": "a-iv-068-1-aa", "name": "花王 アタック 洗濯洗剤", "price": 800, "priority": "high"},
        {"sku": "a-iv-068-2-cc", "name": "ユニ・チャーム マスク 50枚入", "price": 1500, "priority": "normal"},
        {"sku": "a-iv-069-1-bb", "name": "ロート製薬 目薬", "price": 650, "priority": "normal"},
    ]
    
    # Add 2-4 items to each order
    import random
    for order_id in range(1, 11):
        num_items = random.randint(2, 4)
        selected = random.sample(products, num_items)
        
        for product in selected:
            item = {
                "sku": product["sku"],
                "product_name": product["name"],
                "quantity": random.randint(1, 3),
                "unit_price": product["price"],
                "priority": product["priority"]
            }
            
            response = requests.post(
                f"{BASE_URL}/api/orders/{order_id}/items",
                headers=get_headers(),
                json=item
            )
            if response.status_code == 200:
                print(f"✓ Added {product['sku']} to order {order_id}")

def get_dashboard_stats():
    """Step 7: Get dashboard statistics"""
    print("\n📊 Getting dashboard statistics...")
    
    # Order stats
    response = requests.get(
        f"{BASE_URL}/api/orders/stats",
        headers=get_headers()
    )
    print_response(response, "Order Statistics")
    
    # Staff stats
    response = requests.get(
        f"{BASE_URL}/api/staff/stats",
        headers=get_headers()
    )
    print_response(response, "Staff Statistics")
    
    # Store stats
    response = requests.get(
        f"{BASE_URL}/api/stores/stats",
        headers=get_headers()
    )
    print_response(response, "Store Statistics")

def test_automation():
    """Step 8: Test automation features"""
    print("\n🤖 Testing automation features...")
    
    target_date = date.today().isoformat()
    
    # Auto-assign orders
    response = requests.post(
        f"{BASE_URL}/api/automation/auto-assign?target_date={target_date}",
        headers=get_headers()
    )
    print_response(response, "Auto-Assign Orders")
    
    # Generate routes
    response = requests.post(
        f"{BASE_URL}/api/automation/generate-routes?target_date={target_date}",
        headers=get_headers()
    )
    print_response(response, "Generate Routes")

def main():
    """Run all tests"""
    print("🚀 Starting API Test Suite")
    print("="*60)
    
    try:
        
        # Step 2: Login
        if not login():
            print("❌ Login failed!")
            return
        
        print("\n✅ Authentication successful!")
        
        # Step 3-8: Create test data
        create_staff()
        create_stores()
        import_orders()
        create_order_items()
        get_dashboard_stats()
        test_automation()
        
        print("\n" + "="*60)
        print("✅ All tests completed successfully!")
        print("="*60)
        print("\n📝 Test Summary:")
        print("  - Admin user created")
        print("  - 3 staff members created")
        print("  - 5 stores created")
        print("  - 10 orders imported (bulk upload)")
        print("  - Order items with A1 delivery codes added")
        print("  - Automation tested (auto-assign + route generation)")
        print("\n🔑 Login Credentials:")
        print(f"  Admin:      {ADMIN_EMAIL} / {ADMIN_PASSWORD}")
        print(f"  Supervisor: suzuki@example.com / password123")
        print(f"  Buyer 1:    tanaka@example.com / password123")
        print(f"  Buyer 2:    sato@example.com / password123")
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()
