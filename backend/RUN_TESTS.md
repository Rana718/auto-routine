# API Testing Guide

## Prerequisites

1. **Start the backend server:**
```bash
cd backend
uvicorn main:app --reload
```

2. **Ensure database is running** (PostgreSQL)

## Running Tests

### Option 1: Automated Test Script
```bash
cd backend
python test_api.py
```

This will:
- ✅ Create admin user via `/api/auth/create-admin`
- ✅ Login and get JWT token
- ✅ Create 3 staff members via `/api/admin/users`
- ✅ Create 5 stores via `/api/stores`
- ✅ **Bulk import 10 orders** via `/api/orders/import`
- ✅ Add order items with A1 delivery codes
- ✅ Test automation (auto-assign + route generation)
- ✅ Get dashboard statistics

### Option 2: Manual Testing with cURL

#### 1. Create Admin
```bash
curl -X POST http://localhost:8000/api/auth/create-admin \
  -H "Content-Type: application/json" \
  -d '{
    "name": "管理者",
    "email": "admin@example.com",
    "password": "admin123",
    "secret_key": "change-this-admin-secret-key"
  }'
```

#### 2. Login
```bash
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "admin123"
  }'
```

Save the `access_token` from response.

#### 3. Bulk Import Orders (Upload Feature Test)
```bash
curl -X POST http://localhost:8000/api/orders/import \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d @test_orders.json
```

#### 4. Create Store
```bash
curl -X POST http://localhost:8000/api/stores \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "store_name": "ヨドバシカメラ 秋葉原店",
    "store_code": "A1-001",
    "address": "東京都千代田区神田花岡町1-1",
    "district": "千代田区",
    "latitude": 35.6984,
    "longitude": 139.7731,
    "category": "家電",
    "priority_level": 1
  }'
```

### Option 3: Test with Postman/Thunder Client

Import the test collection:
1. Open Postman/Thunder Client
2. Import `test_orders.json` for bulk upload
3. Set base URL: `http://localhost:8000`
4. Add Authorization header: `Bearer YOUR_TOKEN`

## A1 Delivery Code System

The test data includes products with A1 delivery codes:

### SKU Format: `a-iv-XXX-Y-ZZ`
- **aa** = 即日 (Same day) → High priority
- **bb** = 5営業日以内 (5 business days) → Normal priority  
- **cc** = 7-14日営業日以内 (7-14 business days) → Normal priority

### Sample Products:
- `a-iv-066-1-aa` - ソニー ワイヤレスイヤホン (Same day)
- `a-iv-066-2-bb` - パナソニック ドライヤー (5 days)
- `a-iv-066-3-cc` - シャープ 空気清浄機 (7-14 days)
- `a-iv-067-1-aa` - ネスカフェ ゴールドブレンド (Same day)
- `a-iv-068-1-aa` - 花王 アタック 洗濯洗剤 (Same day)

## Test Credentials

After running tests, use these credentials to login:

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@example.com | admin123 |
| Supervisor | suzuki@example.com | password123 |
| Buyer 1 | tanaka@example.com | password123 |
| Buyer 2 | sato@example.com | password123 |

## Verify Results

### Check Dashboard
```bash
curl http://localhost:8000/api/orders/stats \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Check Orders
```bash
curl http://localhost:8000/api/orders \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Check Routes
```bash
curl http://localhost:8000/api/routes \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Frontend Testing

1. Start frontend:
```bash
cd frontend
npm run dev
```

2. Open browser: `http://localhost:3000`

3. Login with test credentials

4. Navigate to:
   - Dashboard - View stats and orders
   - Orders - See imported orders with A1 codes
   - Routes - View generated routes
   - Stores - See store locations on map

## Troubleshooting

**Error: Admin already exists**
- This is normal if you've run tests before
- The script will continue with login

**Error: Connection refused**
- Make sure backend is running on port 8000
- Check PostgreSQL is running

**Error: 401 Unauthorized**
- Token might be expired
- Re-run login step to get new token
