"""
Clear database before running routing test
"""
import requests

BASE_URL = "http://localhost:8000"
TOKEN = None

def login():
    global TOKEN
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

def clear_data():
    """Delete all stores, orders, staff (except admin)"""
    print("🗑️  Clearing existing data...")
    
    # Get all stores
    response = requests.get(f"{BASE_URL}/api/stores", headers=get_headers())
    if response.status_code == 200:
        stores = response.json()
        for store in stores:
            requests.delete(f"{BASE_URL}/api/stores/{store['store_id']}", headers=get_headers())
        print(f"✓ Deleted {len(stores)} stores")
    
    print("✅ Database cleared! Now run: python test_routing.py")

if __name__ == "__main__":
    if login():
        clear_data()
    else:
        print("❌ Login failed")
