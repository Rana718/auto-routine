# 🧪 Auto-Routine System - Complete Testing Guide

## 📋 System Overview
This system automates procurement operations from order intake → store selection → staff assignment → route optimization.

---

## 🔗 API Endpoints Reference

### **Backend Base URL:** `http://localhost:8000`
### **Frontend Base URL:** `http://localhost:3000`

---

## 🚀 Testing Flow (Step-by-Step)

### **Phase 1: Authentication & Setup**

#### 1.1 Register Admin User
**Endpoint:** `POST /api/auth/register`
```json
{
  "email": "admin@example.com",
  "password": "admin123",
  "full_name": "Admin User",
  "role": "admin"
}
```
**Frontend:** `http://localhost:3000/signup`

#### 1.2 Login
**Endpoint:** `POST /api/auth/login`
```json
{
  "email": "admin@example.com",
  "password": "admin123"
}
```
**Frontend:** `http://localhost:3000/signin`
**Response:** Save the `access_token` for subsequent requests

#### 1.3 Get Current User
**Endpoint:** `GET /api/auth/me`
**Headers:** `Authorization: Bearer {token}`
**Frontend:** Auto-loaded after login

---

### **Phase 2: Master Data Setup**

#### 2.1 Create Stores (200-300 stores)
**Endpoint:** `POST /api/stores/`
```json
{
  "store_name": "Store A - Shibuya",
  "store_code": "STR001",
  "category": "Electronics",
  "district": "Shibuya",
  "address": "1-1-1 Shibuya, Tokyo",
  "latitude": 35.6595,
  "longitude": 139.7004,
  "phone": "03-1234-5678",
  "business_hours": "10:00-20:00",
  "is_active": true
}
```
**Frontend:** `http://localhost:3000/stores` → "Add Store" button

**Test Actions:**
- ✅ Create 5-10 test stores in different districts
- ✅ View stores list: `GET /api/stores/`
- ✅ Get store stats: `GET /api/stores/stats`
- ✅ Filter by category: `GET /api/stores/?category=Electronics`
- ✅ Filter by district: `GET /api/stores/?district=Shibuya`
- ✅ Search stores: `GET /api/stores/?search=Shibuya`
- ✅ Update store: `PATCH /api/stores/{store_id}`
- ✅ Deactivate store: `DELETE /api/stores/{store_id}`

#### 2.2 Create Staff Members (5-10 staff)
**Endpoint:** `POST /api/staff/`
```json
{
  "email": "staff1@example.com",
  "password": "staff123",
  "full_name": "Staff Member 1",
  "phone": "090-1234-5678",
  "role": "staff",
  "max_daily_capacity": 50,
  "start_location_lat": 35.6812,
  "start_location_lng": 139.7671,
  "is_active": true
}
```
**Frontend:** `http://localhost:3000/staff` → "Add Staff" button

**Test Actions:**
- ✅ Create 3-5 staff members
- ✅ View staff list: `GET /api/staff/`
- ✅ Get staff stats: `GET /api/staff/stats`
- ✅ View staff details: `GET /api/staff/{staff_id}`
- ✅ Update staff status: `PATCH /api/staff/{staff_id}/status`
```json
{
  "status": "active",
  "current_location_lat": 35.6812,
  "current_location_lng": 139.7671
}
```

---

### **Phase 3: Order Management**

#### 3.1 Create Single Order
**Endpoint:** `POST /api/orders/`
```json
{
  "order_number": "ORD-2025-001",
  "customer_name": "Customer A",
  "order_date": "2025-12-22",
  "target_date": "2025-12-22",
  "items": [
    {
      "sku": "SKU001",
      "product_name": "Product A",
      "quantity": 2,
      "unit_price": 1500.00,
      "preferred_store_id": null
    },
    {
      "sku": "SKU002",
      "product_name": "Product B",
      "quantity": 1,
      "unit_price": 3000.00,
      "preferred_store_id": null
    }
  ]
}
```
**Frontend:** `http://localhost:3000/orders` → "Add Order" button

#### 3.2 Bulk Import Orders (Robot-in simulation)
**Endpoint:** `POST /api/orders/import`
```json
{
  "orders": [
    {
      "order_number": "ORD-2025-002",
      "customer_name": "Customer B",
      "order_date": "2025-12-22",
      "target_date": "2025-12-22",
      "items": [...]
    },
    {
      "order_number": "ORD-2025-003",
      "customer_name": "Customer C",
      "order_date": "2025-12-22",
      "target_date": "2025-12-22",
      "items": [...]
    }
  ]
}
```

**Test Actions:**
- ✅ Create 10-20 test orders with multiple items
- ✅ View orders list: `GET /api/orders/`
- ✅ Get order stats: `GET /api/orders/stats?target_date=2025-12-22`
- ✅ Filter by status: `GET /api/orders/?status=pending`
- ✅ Filter by date: `GET /api/orders/?target_date=2025-12-22`
- ✅ Search orders: `GET /api/orders/?search=ORD-2025`
- ✅ View order details: `GET /api/orders/{order_id}`
- ✅ Add item to order: `POST /api/orders/{order_id}/items`
- ✅ Update order status: `PATCH /api/orders/{order_id}/status?status=processing`

---

### **Phase 4: Automation - Core Features**

#### 4.1 Auto-Assign Orders to Staff
**Endpoint:** `POST /api/automation/auto-assign`
```json
{
  "target_date": "2025-12-22"
}
```
**Frontend:** `http://localhost:3000/orders` → "Auto Assign" button

**What it does:**
- Analyzes all pending orders for the target date
- Assigns items to available staff based on:
  - Staff capacity (max_daily_capacity)
  - Staff location proximity
  - Current workload
- Creates purchase lists for each staff member

**Test Actions:**
- ✅ Verify orders status changes from `pending` → `assigned`
- ✅ Check staff workload distribution is balanced
- ✅ Verify purchase lists are created

#### 4.2 Generate Optimized Routes
**Endpoint:** `POST /api/automation/generate-routes`
```json
{
  "target_date": "2025-12-22"
}
```
**Frontend:** `http://localhost:3000/routes` → "Generate Routes" button

**What it does:**
- For each staff's purchase list:
  - Identifies unique stores to visit
  - Calculates optimal visiting order (Nearest Neighbor algorithm)
  - Generates route with stops
  - Estimates distance and time

**Test Actions:**
- ✅ Verify routes are created for all staff
- ✅ Check route optimization (stores visited in logical order)
- ✅ View route on map
- ✅ Verify stop sequence makes sense

---

### **Phase 5: Route Management**

#### 5.1 View All Routes
**Endpoint:** `GET /api/routes/`
**Query Params:**
- `route_date=2025-12-22`
- `staff_id=1`
- `status=not_started`

**Frontend:** `http://localhost:3000/routes`

#### 5.2 View Route Details
**Endpoint:** `GET /api/routes/{route_id}`
**Frontend:** Click on route in routes list

**Test Actions:**
- ✅ View route on map with all stops
- ✅ Check stop order
- ✅ View items to purchase at each stop
- ✅ Verify distance calculations

#### 5.3 Update Route Status
**Endpoint:** `PATCH /api/routes/{route_id}/status?status=in_progress`
**Statuses:** `not_started`, `in_progress`, `completed`, `cancelled`

#### 5.4 Update Stop Status
**Endpoint:** `PATCH /api/routes/{route_id}/stops/{stop_id}`
```json
{
  "status": "completed",
  "arrival_time": "2025-12-22T10:30:00",
  "departure_time": "2025-12-22T11:00:00",
  "notes": "All items purchased successfully"
}
```

**Test Actions:**
- ✅ Start route: status → `in_progress`
- ✅ Complete stops one by one
- ✅ Mark items as purchased/failed
- ✅ Complete entire route

#### 5.5 Regenerate All Routes
**Endpoint:** `POST /api/routes/regenerate-all?route_date=2025-12-22`
**Use case:** When orders change or optimization needs adjustment

---

### **Phase 6: Settings & Configuration**

#### 6.1 View All Settings
**Endpoint:** `GET /api/settings/`
**Frontend:** `http://localhost:3000/settings`

#### 6.2 Update Cutoff Time Settings
**Endpoint:** `PUT /api/settings/cutoff`
```json
{
  "cutoff_time": "13:10:00",
  "exclude_weekends": true,
  "exclude_holidays": true,
  "holiday_override_enabled": true
}
```

**Test Actions:**
- ✅ Set cutoff time to 13:10
- ✅ Test orders before cutoff → today's list
- ✅ Test orders after cutoff → next day's list
- ✅ Toggle weekend/holiday exclusions

#### 6.3 Update Staff Settings
**Endpoint:** `PUT /api/settings/staff`
```json
{
  "default_capacity": 50,
  "max_capacity": 100,
  "auto_assign_enabled": true,
  "balance_workload": true
}
```

#### 6.4 Update Route Settings
**Endpoint:** `PUT /api/settings/route`
```json
{
  "optimization_priority": "speed",
  "max_stops_per_route": 15,
  "max_distance_km": 50,
  "allow_manual_reorder": true
}
```

---

### **Phase 7: Purchase Result Management**

#### 7.1 Mark Item as Failed
**Endpoint:** `PATCH /api/orders/{order_id}/items/{item_id}`
```json
{
  "status": "failed",
  "failure_type": "out_of_stock",
  "restock_date": "2025-12-25",
  "notes": "Item will be restocked on 25th"
}
```

**Failure Types:**
- `discontinued` - Product no longer available
- `out_of_stock` - Temporarily out of stock
- `store_closed` - Store was closed
- `price_mismatch` - Price different from expected
- `product_not_found` - Product not found in store
- `other` - Other reason

**Test Actions:**
- ✅ Mark items as discontinued
- ✅ Mark items as out of stock with restock date
- ✅ Verify failed items are tracked
- ✅ Check restock date reminders

---

## 📊 Dashboard Testing

**Frontend:** `http://localhost:3000/`

**Verify Dashboard Shows:**
- ✅ Total orders for today
- ✅ Stores to visit count
- ✅ Active staff count
- ✅ Completion rate percentage
- ✅ Pending/Assigned/In Progress/Failed order counts
- ✅ Recent orders table
- ✅ Staff overview with workload
- ✅ Cutoff timer countdown
- ✅ Quick action buttons

---

## 🔄 Complete Workflow Test

### **End-to-End Test Scenario:**

1. **Setup (One-time)**
   - ✅ Register admin user
   - ✅ Create 10 stores
   - ✅ Create 5 staff members

2. **Daily Operations (Repeat)**
   - ✅ Import 20 orders (before 13:10 cutoff)
   - ✅ Run auto-assign: `POST /api/automation/auto-assign`
   - ✅ Generate routes: `POST /api/automation/generate-routes`
   - ✅ View routes on map
   - ✅ Staff starts routes (update status to `in_progress`)
   - ✅ Complete stops one by one
   - ✅ Mark items as purchased/failed
   - ✅ Complete routes
   - ✅ View completion statistics

3. **Edge Cases**
   - ✅ Import orders after cutoff → should go to next day
   - ✅ Staff at capacity → orders should distribute to others
   - ✅ Store closed → mark items as failed
   - ✅ Item out of stock → set restock date
   - ✅ Regenerate routes after changes

---

## 🐛 Common Issues to Test

1. **Authentication**
   - ✅ Invalid credentials
   - ✅ Expired token
   - ✅ Unauthorized access

2. **Data Validation**
   - ✅ Invalid email format
   - ✅ Duplicate order numbers
   - ✅ Invalid dates
   - ✅ Negative quantities

3. **Business Logic**
   - ✅ Orders after cutoff time
   - ✅ Staff over capacity
   - ✅ No available stores
   - ✅ Empty purchase lists

4. **Performance**
   - ✅ 100+ orders auto-assignment
   - ✅ Route generation with 20+ stops
   - ✅ Large store database (200-300 stores)

---

## 📝 API Documentation

**Swagger UI:** `http://localhost:8000/docs`
**ReDoc:** `http://localhost:8000/redoc`

---

## ✅ Testing Checklist

### **Authentication & Users**
- [ ] Register user
- [ ] Login
- [ ] Get current user
- [ ] Invalid credentials handling

### **Stores**
- [ ] Create store
- [ ] List stores
- [ ] Filter stores (category, district, search)
- [ ] Update store
- [ ] Deactivate store
- [ ] View store stats

### **Staff**
- [ ] Create staff
- [ ] List staff
- [ ] Update staff status
- [ ] View staff stats
- [ ] Staff capacity management

### **Orders**
- [ ] Create single order
- [ ] Bulk import orders
- [ ] List orders with filters
- [ ] View order details
- [ ] Add items to order
- [ ] Update order status
- [ ] View order stats

### **Automation**
- [ ] Auto-assign orders to staff
- [ ] Generate optimized routes
- [ ] Verify assignment logic
- [ ] Verify route optimization

### **Routes**
- [ ] View all routes
- [ ] View route details on map
- [ ] Update route status
- [ ] Update stop status
- [ ] Regenerate routes
- [ ] Start all routes

### **Settings**
- [ ] View all settings
- [ ] Update cutoff settings
- [ ] Update staff settings
- [ ] Update route settings
- [ ] Update notification settings

### **Purchase Results**
- [ ] Mark item as purchased
- [ ] Mark item as failed (out of stock)
- [ ] Mark item as discontinued
- [ ] Set restock dates
- [ ] Track failure reasons

### **Dashboard**
- [ ] View statistics
- [ ] View recent orders
- [ ] View staff overview
- [ ] Cutoff timer
- [ ] Quick actions

---

## 🎯 Success Criteria

The system is working correctly if:
1. ✅ Orders can be imported and assigned automatically
2. ✅ Staff workload is balanced based on capacity
3. ✅ Routes are optimized (logical store visiting order)
4. ✅ Map visualization shows routes clearly
5. ✅ Purchase results can be tracked (success/failure)
6. ✅ Cutoff time logic works correctly
7. ✅ Dashboard shows accurate real-time statistics
8. ✅ All CRUD operations work for stores/staff/orders
9. ✅ Settings can be configured and applied
10. ✅ System handles edge cases gracefully

---

## 📞 Support

If you encounter issues:
1. Check backend logs: `uvicorn` console output
2. Check frontend console: Browser DevTools
3. Verify database connection
4. Check API documentation: `/docs`
5. Verify environment variables are set correctly

---

**Happy Testing! 🚀**
