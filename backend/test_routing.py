"""
Test Map Routing Feature
Creates realistic test data to demonstrate route optimization
"""

import requests
import json
from datetime import datetime, date

BASE_URL = "http://localhost:8000"
TOKEN = None

def print_response(response, title="Response"):
    print(f"\n{'='*60}")
    print(f"{title}")
    print(f"Status: {response.status_code}")
    try:
        print(f"Body: {json.dumps(response.json(), indent=2, ensure_ascii=False)}")
    except:
        print(f"Body: {response.text}")
    print(f"{'='*60}")

def login():
    global TOKEN
    print("\n🔑 Logging in...")
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": "admin@gmail.com",
        "password": "admin@gmail.com"
    })
    if response.status_code == 200:
        TOKEN = response.json()["access_token"]
        return True
    return False

def get_headers():
    return {"Authorization": f"Bearer {TOKEN}"}

def create_tokyo_stores():
    """Create stores across Tokyo with real GPS coordinates"""
    print("\n🏪 Creating Tokyo stores with GPS coordinates...")
    
    stores = [
        # Shibuya area
        {
            "store_name": "ヨドバシカメラ マルチメディア渋谷",
            "store_code": "YODO-SBY",
            "address": "東京都渋谷区神南1-19-18",
            "district": "渋谷区",
            "latitude": 35.6627,
            "longitude": 139.6989,
            "category": "家電",
            "priority_level": 1
        },
        # Shinjuku area
        {
            "store_name": "ビックカメラ 新宿西口店",
            "store_code": "BIC-SJK",
            "address": "東京都新宿区西新宿1-5-1",
            "district": "新宿区",
            "latitude": 35.6896,
            "longitude": 139.6917,
            "category": "家電",
            "priority_level": 1
        },
        # Akihabara area
        {
            "store_name": "ヨドバシカメラ マルチメディアAkiba",
            "store_code": "YODO-AKB",
            "address": "東京都千代田区神田花岡町1-1",
            "district": "千代田区",
            "latitude": 35.6984,
            "longitude": 139.7731,
            "category": "家電",
            "priority_level": 1
        },
        # Ikebukuro area
        {
            "store_name": "ビックカメラ 池袋本店",
            "store_code": "BIC-IKB",
            "address": "東京都豊島区東池袋1-41-5",
            "district": "豊島区",
            "latitude": 35.7295,
            "longitude": 139.7141,
            "category": "家電",
            "priority_level": 1
        },
        # Ginza area
        {
            "store_name": "マツモトキヨシ 銀座5丁目店",
            "store_code": "MAT-GNZ",
            "address": "東京都中央区銀座5-8-17",
            "district": "中央区",
            "latitude": 35.6717,
            "longitude": 139.7640,
            "category": "ドラッグストア",
            "priority_level": 2
        },
        # Roppongi area
        {
            "store_name": "ドン・キホーテ 六本木店",
            "store_code": "DON-ROP",
            "address": "東京都港区六本木3-14-10",
            "district": "港区",
            "latitude": 35.6627,
            "longitude": 139.7298,
            "category": "日用品",
            "priority_level": 2
        },
        # Ueno area
        {
            "store_name": "多慶屋 上野本店",
            "store_code": "TAK-UEN",
            "address": "東京都台東区台東4-33-2",
            "district": "台東区",
            "latitude": 35.7089,
            "longitude": 139.7831,
            "category": "日用品",
            "priority_level": 2
        },
        # Asakusa area
        {
            "store_name": "成城石井 浅草店",
            "store_code": "SEI-ASK",
            "address": "東京都台東区雷門2-17-12",
            "district": "台東区",
            "latitude": 35.7117,
            "longitude": 139.7967,
            "category": "食品・飲料",
            "priority_level": 3
        },
        # Odaiba area
        {
            "store_name": "ダイバーシティ東京 プラザ",
            "store_code": "DIV-ODB",
            "address": "東京都江東区青海1-1-10",
            "district": "江東区",
            "latitude": 35.6252,
            "longitude": 139.7756,
            "category": "ショッピングモール",
            "priority_level": 3
        },
        # Nakano area
        {
            "store_name": "まんだらけ 中野店",
            "store_code": "MAN-NAK",
            "address": "東京都中野区中野5-52-15",
            "district": "中野区",
            "latitude": 35.7065,
            "longitude": 139.6655,
            "category": "専門店",
            "priority_level": 3
        }
    ]
    
    created_stores = []
    for store in stores:
        response = requests.post(
            f"{BASE_URL}/api/stores",
            headers=get_headers(),
            json=store
        )
        if response.status_code == 200:
            store_data = response.json()
            created_stores.append(store_data)
            print(f"✓ Created: {store['store_name']} (ID: {store_data['store_id']})")
    
    return created_stores

def create_staff_with_locations():
    """Create staff with different start locations"""
    print("\n👥 Creating staff with start locations...")
    
    staff_list = [
        {
            "name": "田中太郎",
            "email": "tanaka@example.com",
            "password": "password123",
            "role": "buyer",
            "start_location_lat": 35.6627,  # Shibuya
            "start_location_lng": 139.6989,
            "max_daily_capacity": 15
        },
        {
            "name": "佐藤花子",
            "email": "sato@example.com",
            "password": "password123",
            "role": "buyer",
            "start_location_lat": 35.6896,  # Shinjuku
            "start_location_lng": 139.6917,
            "max_daily_capacity": 20
        },
        {
            "name": "鈴木一郎",
            "email": "suzuki@example.com",
            "password": "password123",
            "role": "buyer",
            "start_location_lat": 35.7295,  # Ikebukuro
            "start_location_lng": 139.7141,
            "max_daily_capacity": 18
        }
    ]
    
    created_staff = []
    for staff in staff_list:
        response = requests.post(
            f"{BASE_URL}/api/admin/users",
            headers=get_headers(),
            json=staff
        )
        if response.status_code == 200:
            staff_data = response.json()
            created_staff.append(staff_data)
            print(f"✓ Created: {staff['name']} (ID: {staff_data['staff_id']})")
    
    return created_staff

def create_orders_for_routing():
    """Create orders with items from different stores"""
    print("\n📦 Creating orders for routing test...")
    
    today = datetime.now().isoformat()
    target_date = date.today().isoformat()
    
    # Create 5 orders
    orders = []
    for i in range(1, 6):
        order = {
            "robot_in_order_id": f"ROUTE-TEST-{i:03d}",
            "mall_name": "楽天市場",
            "customer_name": f"ルートテスト顧客{i}",
            "order_date": today,
            "target_purchase_date": target_date
        }
        
        response = requests.post(
            f"{BASE_URL}/api/orders",
            headers=get_headers(),
            json=order
        )
        
        if response.status_code == 200:
            order_data = response.json()
            orders.append(order_data)
            print(f"✓ Created order: {order['robot_in_order_id']} (ID: {order_data['order_id']})")
    
    return orders

def add_items_to_orders(orders, stores):
    """Add items to orders - distributed across stores"""
    print("\n📝 Adding items to orders (distributed across stores)...")
    
    # Products mapped to store categories
    products_by_category = {
        "家電": [
            {"sku": "SONY-WH1000XM5", "name": "ソニー ワイヤレスヘッドホン WH-1000XM5", "price": 45000},
            {"sku": "APPLE-AIRPODS-PRO", "name": "Apple AirPods Pro 第2世代", "price": 39800},
            {"sku": "CANON-EOS-R6", "name": "キヤノン EOS R6 Mark II", "price": 398000},
            {"sku": "NINTENDO-SWITCH", "name": "Nintendo Switch 有機ELモデル", "price": 37980},
        ],
        "ドラッグストア": [
            {"sku": "ROHTO-EYE-DROP", "name": "ロート製薬 Vロート プレミアム", "price": 1580},
            {"sku": "KAO-MERIT-SHAMPOO", "name": "花王 メリット シャンプー", "price": 680},
        ],
        "日用品": [
            {"sku": "LION-LAUNDRY", "name": "ライオン トップ スーパーナノックス", "price": 498},
            {"sku": "UNICHARM-MASK", "name": "ユニ・チャーム 超快適マスク 50枚", "price": 1280},
        ],
        "食品・飲料": [
            {"sku": "NESCAFE-GOLD", "name": "ネスカフェ ゴールドブレンド 120g", "price": 1180},
            {"sku": "MEIJI-CHOCOLATE", "name": "明治 ザ・チョコレート", "price": 250},
        ]
    }
    
    # Map stores to categories
    store_by_category = {}
    for store in stores:
        category = store.get("category")
        if category not in store_by_category:
            store_by_category[category] = []
        store_by_category[category].append(store["store_id"])
    
    # Add items to each order
    import random
    for order in orders:
        order_id = order["order_id"]
        
        # Add 3-5 items per order from different categories
        num_items = random.randint(3, 5)
        categories = random.sample(list(products_by_category.keys()), min(num_items, len(products_by_category)))
        
        for category in categories:
            products = products_by_category[category]
            product = random.choice(products)
            
            item = {
                "sku": product["sku"],
                "product_name": product["name"],
                "quantity": random.randint(1, 2),
                "unit_price": product["price"]
            }
            
            response = requests.post(
                f"{BASE_URL}/api/orders/{order_id}/items",
                headers=get_headers(),
                json=item
            )
            
            if response.status_code == 200:
                print(f"  ✓ Added {product['sku']} to order {order_id}")

def run_automation():
    """Run automation to assign orders and generate routes"""
    print("\n🤖 Running automation (assign + route generation)...")
    
    target_date = date.today().isoformat()
    
    # Auto-assign orders to staff
    response = requests.post(
        f"{BASE_URL}/api/automation/auto-assign?target_date={target_date}",
        headers=get_headers()
    )
    print_response(response, "Auto-Assign Orders")
    
    # Generate optimized routes
    response = requests.post(
        f"{BASE_URL}/api/automation/generate-routes?target_date={target_date}",
        headers=get_headers()
    )
    print_response(response, "Generate Routes")

def view_routes():
    """View generated routes with map data"""
    print("\n🗺️  Viewing generated routes...")
    
    target_date = date.today().isoformat()
    
    response = requests.get(
        f"{BASE_URL}/api/routes?route_date={target_date}",
        headers=get_headers()
    )
    
    if response.status_code == 200:
        routes = response.json()
        print(f"\n📍 Found {len(routes)} routes:")
        
        for route in routes:
            print(f"\n{'='*60}")
            print(f"Route ID: {route['route_id']}")
            print(f"Staff: {route['staff_name']}")
            print(f"Status: {route['route_status']}")
            print(f"Total Stops: {route['total_stops']}")
            print(f"Duration: {route['estimated_duration']}")
            print(f"\nStops:")
            
            for stop in route['stops']:
                print(f"  {stop['stop_sequence']}. {stop['store_name']}")
                print(f"     Address: {stop['store_address']}")
                print(f"     GPS: ({stop['store_latitude']}, {stop['store_longitude']})")
                print(f"     Items: {stop['items_count']}")
                print(f"     Status: {stop['stop_status']}")
                if stop['estimated_arrival']:
                    print(f"     ETA: {stop['estimated_arrival']}")
                print()

def main():
    print("🗺️  Map Routing Feature Test")
    print("="*60)
    
    try:
        # Login
        if not login():
            print("❌ Login failed!")
            return
        
        print("\n✅ Authentication successful!")
        
        # Create test data
        stores = create_tokyo_stores()
        staff = create_staff_with_locations()
        orders = create_orders_for_routing()
        add_items_to_orders(orders, stores)
        
        # Run automation
        run_automation()
        
        # View results
        view_routes()
        
        print("\n" + "="*60)
        print("✅ Routing test completed!")
        print("="*60)
        print("\n📝 Test Summary:")
        print(f"  - {len(stores)} stores created across Tokyo")
        print(f"  - {len(staff)} staff members with different start locations")
        print(f"  - {len(orders)} orders created")
        print("  - Items distributed across multiple stores")
        print("  - Routes optimized using Nearest Neighbor algorithm")
        print("\n🌐 View routes in frontend:")
        print("  http://localhost:3000/routes")
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()
