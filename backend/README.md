# Backend API Documentation

## Authentication Routes (`/auth`)

### POST `/auth/login`
**Request:**
```json
{
  "email": "string",
  "password": "string"
}
```
**Response:**
```json
{
  "access_token": "string",
  "token_type": "bearer",
  "user": {
    "staff_id": 1,
    "staff_name": "string",
    "email": "string",
    "role": "buyer|supervisor|admin",
    "status": "active|en_route|idle|off_duty"
  }
}
```

### POST `/auth/create-admin`
**Request:**
```json
{
  "name": "string",
  "email": "string",
  "password": "string",
  "secret_key": "string"
}
```
**Response:**
```json
{
  "staff_id": 1,
  "staff_name": "string",
  "email": "string",
  "role": "admin",
  "status": "off_duty"
}
```

### GET `/auth/me`
**Response:**
```json
{
  "staff_id": 1,
  "staff_name": "string",
  "email": "string",
  "role": "buyer|supervisor|admin",
  "status": "active|en_route|idle|off_duty"
}
```

---

## Admin Routes (`/admin`)

### POST `/admin/users`
**Request:**
```json
{
  "name": "string",
  "email": "string",
  "password": "string",
  "role": "buyer|supervisor|admin"
}
```
**Response:**
```json
{
  "message": "ユーザーを作成しました",
  "staff_id": 1
}
```

### GET `/admin/users`
**Query Params:** `include_inactive` (bool)
**Response:**
```json
[
  {
    "staff_id": 1,
    "staff_name": "string",
    "email": "string",
    "role": "buyer|supervisor|admin",
    "status": "active|en_route|idle|off_duty",
    "is_active": true,
    "created_at": "2025-12-24T10:00:00"
  }
]
```

### PATCH `/admin/users/{user_id}/role`
**Request:**
```json
{
  "role": "buyer|supervisor|admin"
}
```
**Response:**
```json
{
  "message": "ロールを更新しました"
}
```

### PATCH `/admin/users/{user_id}/activate`
**Query Params:** `active` (bool)
**Response:**
```json
{
  "message": "ユーザーを有効化しました"
}
```

### DELETE `/admin/users/{user_id}`
**Response:**
```json
{
  "message": "ユーザーを削除しました"
}
```

---

## Order Routes (`/orders`)

### GET `/orders/`
**Query Params:** `status`, `target_date`, `search`, `skip`, `limit`
**Response:**
```json
[
  {
    "order_id": 1,
    "robot_in_order_id": "string",
    "mall_name": "string",
    "customer_name": "string",
    "order_status": "pending|processing|assigned|in_progress|completed|partially_completed|failed|cancelled",
    "target_purchase_date": "2025-12-24",
    "items": [
      {
        "item_id": 1,
        "sku": "string",
        "product_name": "string",
        "quantity": 1,
        "item_status": "pending|assigned|purchased|failed|discontinued|out_of_stock|restocking"
      }
    ]
  }
]
```

### GET `/orders/stats`
**Query Params:** `target_date` (optional)
**Response:**
```json
{
  "total_orders": 100,
  "pending_orders": 20,
  "assigned_orders": 30,
  "completed_orders": 40,
  "failed_orders": 10
}
```

### GET `/orders/{order_id}`
**Response:**
```json
{
  "order_id": 1,
  "robot_in_order_id": "string",
  "mall_name": "string",
  "customer_name": "string",
  "order_status": "pending",
  "target_purchase_date": "2025-12-24",
  "items": []
}
```

### POST `/orders/`
**Request:**
```json
{
  "robot_in_order_id": "string",
  "mall_name": "string",
  "customer_name": "string",
  "order_date": "2025-12-24T10:00:00",
  "target_purchase_date": "2025-12-24"
}
```
**Response:**
```json
{
  "order_id": 1,
  "robot_in_order_id": "string",
  "mall_name": "string",
  "customer_name": "string",
  "order_date": "2025-12-24T10:00:00",
  "order_status": "pending",
  "target_purchase_date": "2025-12-24",
  "created_at": "2025-12-24T10:00:00",
  "updated_at": "2025-12-24T10:00:00"
}
```

### POST `/orders/{order_id}/items`
**Request:**
```json
{
  "order_id": 1,
  "sku": "string",
  "product_name": "string",
  "quantity": 1,
  "unit_price": 1000.00,
  "is_bundle": false,
  "priority": "normal|high|low"
}
```
**Response:**
```json
{
  "item_id": 1,
  "order_id": 1,
  "sku": "string",
  "product_name": "string",
  "quantity": 1,
  "unit_price": 1000.00,
  "is_bundle": false,
  "priority": "normal",
  "item_status": "pending",
  "created_at": "2025-12-24T10:00:00"
}
```

### PATCH `/orders/{order_id}/status`
**Query Params:** `status` (OrderStatus)
**Response:**
```json
{
  "message": "ステータスを更新しました"
}
```

### POST `/orders/import`
**Request:**
```json
{
  "orders": [
    {
      "robot_in_order_id": "string",
      "mall_name": "string",
      "customer_name": "string",
      "order_date": "2025-12-24T10:00:00",
      "items": []
    }
  ]
}
```
**Response:**
```json
{
  "imported": 10,
  "failed": 0
}
```

### PATCH `/orders/{order_id}/items/{item_id}/status`
**Query Params:** `status` (string)
**Response:**
```json
{
  "message": "ステータスを更新しました"
}
```

---

## Product Routes (`/products`)

### GET `/products/`
**Query Params:** `skip`, `limit`
**Response:**
```json
[
  {
    "product_id": 1,
    "sku": "string",
    "product_name": "string",
    "category": "string",
    "is_store_fixed": false,
    "fixed_store_id": null,
    "exclude_from_routing": false,
    "is_set_product": false
  }
]
```

### PATCH `/products/{product_id}/store-fixed`
**Query Params:** `is_fixed` (bool), `store_id` (int, optional)
**Response:**
```json
{
  "message": "更新しました"
}
```

### PATCH `/products/{product_id}/routing`
**Query Params:** `exclude` (bool)
**Response:**
```json
{
  "message": "更新しました"
}
```

---

## Purchase Routes (`/purchase`)

### POST `/purchase/failures`
**Request:**
```json
{
  "list_item_id": 1,
  "item_id": 1,
  "store_id": 1,
  "failure_type": "discontinued|out_of_stock|store_closed|price_mismatch|product_not_found|other",
  "expected_restock_date": "2025-12-25",
  "alternative_store_id": 2,
  "notes": "string"
}
```
**Response:**
```json
{
  "message": "購入失敗を記録しました",
  "failure_id": 1
}
```

### GET `/purchase/failures`
**Query Params:** `failure_type`, `skip`, `limit`
**Response:**
```json
[
  {
    "failure_id": 1,
    "item_id": 1,
    "store_id": 1,
    "failure_type": "out_of_stock",
    "failure_date": "2025-12-24T10:00:00",
    "expected_restock_date": "2025-12-25",
    "notes": "string"
  }
]
```

---

## Route Routes (`/routes`)

### GET `/routes/`
**Query Params:** `route_date`, `staff_id`, `status`, `skip`, `limit`
**Response:**
```json
[
  {
    "route_id": 1,
    "staff_id": 1,
    "staff_name": "string",
    "staff_avatar": "string",
    "route_date": "2025-12-24",
    "route_status": "not_started|in_progress|completed|cancelled",
    "total_stops": 5,
    "completed_stops": 2,
    "estimated_duration": "2h 30m",
    "stops": []
  }
]
```

### GET `/routes/{route_id}`
**Response:**
```json
{
  "route_id": 1,
  "staff_id": 1,
  "route_date": "2025-12-24",
  "route_status": "not_started",
  "stops": []
}
```

### POST `/routes/generate`
**Request:**
```json
{
  "staff_id": 1,
  "list_id": 1,
  "optimization_priority": "speed|distance|cost|balanced"
}
```
**Response:**
```json
{
  "route_id": 1,
  "message": "ルートを生成しました"
}
```

### POST `/routes/regenerate-all`
**Query Params:** `route_date` (optional)
**Response:**
```json
{
  "message": "全ルートを再生成しました",
  "route_ids": [1, 2, 3]
}
```

### PATCH `/routes/{route_id}/status`
**Query Params:** `status` (RouteStatus)
**Response:**
```json
{
  "message": "ステータスを更新しました"
}
```

### PATCH `/routes/{route_id}/stops/{stop_id}`
**Request:**
```json
{
  "stop_status": "pending|current|completed|skipped",
  "actual_arrival": "2025-12-24T10:00:00",
  "actual_departure": "2025-12-24T10:30:00"
}
```
**Response:**
```json
{
  "message": "ストップを更新しました"
}
```

### POST `/routes/start-all`
**Query Params:** `route_date` (optional)
**Response:**
```json
{
  "message": "全ルートを開始しました",
  "started_routes": 5
}
```

### PATCH `/routes/{route_id}/reorder`
**Request:**
```json
{
  "stop_ids": [3, 1, 2, 5, 4]
}
```
**Response:**
```json
{
  "message": "ルートを並び替えました"
}
```

---

## Settings Routes (`/settings`)

### GET `/settings/`
**Response:**
```json
{
  "cutoff": {
    "cutoff_time": "13:10",
    "weekend_processing": false,
    "holiday_override": true
  },
  "staff": {
    "default_start_location": "オフィス（六本木）",
    "max_orders_per_staff": 20,
    "auto_assign": true
  },
  "route": {
    "optimization_priority": "speed",
    "max_route_time_hours": 4,
    "include_return": true
  },
  "notification": {
    "cutoff_warning": true,
    "order_failure_alert": true,
    "route_completion_notification": false
  }
}
```

### PUT `/settings/cutoff`
**Request:**
```json
{
  "cutoff_time": "13:10",
  "weekend_processing": false,
  "holiday_override": true
}
```
**Response:** Same as request

### PUT `/settings/staff`
**Request:**
```json
{
  "default_start_location": "オフィス（六本木）",
  "max_orders_per_staff": 20,
  "auto_assign": true
}
```
**Response:** Same as request

### PUT `/settings/route`
**Request:**
```json
{
  "optimization_priority": "speed",
  "max_route_time_hours": 4,
  "include_return": true
}
```
**Response:** Same as request

### PUT `/settings/notification`
**Request:**
```json
{
  "cutoff_warning": true,
  "order_failure_alert": true,
  "route_completion_notification": false
}
```
**Response:** Same as request

### POST `/settings/data/import-stores`
**Response:**
```json
{
  "message": "ストアをインポートしました"
}
```

### POST `/settings/data/export-orders`
**Response:**
```json
{
  "message": "注文をエクスポートしました"
}
```

### POST `/settings/data/backup`
**Response:**
```json
{
  "message": "バックアップを作成しました"
}
```

---

## Staff Routes (`/staff`)

### GET `/staff/`
**Query Params:** `active_only`, `skip`, `limit`
**Response:**
```json
[
  {
    "staff_id": 1,
    "staff_name": "string",
    "staff_code": "string",
    "email": "string",
    "role": "buyer|supervisor|admin",
    "status": "active|en_route|idle|off_duty",
    "is_active": true,
    "assigned_orders": 5,
    "assigned_stores": 3,
    "completed_today": 2,
    "current_location_name": "string"
  }
]
```

### GET `/staff/stats`
**Response:**
```json
{
  "total_staff": 10,
  "active_staff": 8,
  "on_duty_staff": 5,
  "total_capacity": 200
}
```

### GET `/staff/{staff_id}`
**Response:**
```json
{
  "staff_id": 1,
  "staff_name": "string",
  "staff_code": "string",
  "email": "string",
  "role": "buyer",
  "status": "active",
  "is_active": true,
  "assigned_orders": 5,
  "assigned_stores": 3,
  "completed_today": 2,
  "current_location_name": "string"
}
```

### POST `/staff/`
**Request:**
```json
{
  "staff_name": "string",
  "staff_code": "string",
  "email": "string",
  "phone": "string",
  "role": "buyer",
  "start_location_name": "オフィス（六本木）",
  "max_daily_capacity": 20,
  "password": "string"
}
```
**Response:**
```json
{
  "staff_id": 1,
  "staff_name": "string",
  "staff_code": "string",
  "email": "string",
  "phone": "string",
  "role": "buyer",
  "start_location_name": "オフィス（六本木）",
  "max_daily_capacity": 20,
  "status": "off_duty",
  "is_active": true,
  "current_location_name": null,
  "created_at": "2025-12-24T10:00:00"
}
```

### PATCH `/staff/{staff_id}/status`
**Request:**
```json
{
  "status": "active|en_route|idle|off_duty",
  "current_location_lat": 35.6762,
  "current_location_lng": 139.6503,
  "current_location_name": "string"
}
```
**Response:**
```json
{
  "message": "ステータスを更新しました"
}
```

### POST `/staff/{staff_id}/auto-assign`
**Response:**
```json
{
  "message": "注文を自動割り当てしました",
  "assigned_orders": 5
}
```

---

## Store Routes (`/stores`)

### GET `/stores/`
**Query Params:** `active_only`, `category`, `district`, `search`, `skip`, `limit`
**Response:**
```json
[
  {
    "store_id": 1,
    "store_name": "string",
    "store_code": "string",
    "address": "string",
    "district": "string",
    "category": "string",
    "orders_today": 5
  }
]
```

### GET `/stores/stats`
**Response:**
```json
{
  "total_stores": 200,
  "active_stores": 180,
  "stores_with_orders": 50,
  "total_orders_today": 100
}
```

### GET `/stores/categories`
**Response:**
```json
["家電", "食品・飲料", "日用品"]
```

### GET `/stores/districts`
**Response:**
```json
["渋谷区", "港区", "新宿区"]
```

### GET `/stores/{store_id}`
**Response:**
```json
{
  "store_id": 1,
  "store_name": "string",
  "store_code": "string",
  "address": "string",
  "district": "string",
  "category": "string",
  "orders_today": 5
}
```

### POST `/stores/`
**Request:**
```json
{
  "store_name": "string",
  "store_code": "string",
  "address": "string",
  "district": "string",
  "latitude": 35.6762,
  "longitude": 139.6503,
  "opening_hours": {"mon": "10:00-21:00"},
  "category": "string",
  "priority_level": 2
}
```
**Response:**
```json
{
  "store_id": 1,
  "store_name": "string",
  "store_code": "string",
  "address": "string",
  "district": "string",
  "latitude": 35.6762,
  "longitude": 139.6503,
  "opening_hours": {"mon": "10:00-21:00"},
  "category": "string",
  "priority_level": 2,
  "is_active": true,
  "created_at": "2025-12-24T10:00:00"
}
```

### PATCH `/stores/{store_id}`
**Request:**
```json
{
  "store_name": "string",
  "address": "string",
  "district": "string",
  "category": "string",
  "opening_hours": {"mon": "10:00-21:00"},
  "priority_level": 2,
  "is_active": true
}
```
**Response:**
```json
{
  "store_id": 1,
  "store_name": "string",
  "store_code": "string",
  "address": "string",
  "district": "string",
  "latitude": 35.6762,
  "longitude": 139.6503,
  "opening_hours": {"mon": "10:00-21:00"},
  "category": "string",
  "priority_level": 2,
  "is_active": true,
  "created_at": "2025-12-24T10:00:00"
}
```

### DELETE `/stores/{store_id}`
**Response:**
```json
{
  "message": "ストアを削除しました"
}
```

---

## Automation Routes (`/automation`)

### POST `/automation/auto-assign`
**Query Params:** `target_date` (date)
**Response:**
```json
{
  "message": "注文を自動割り当てしました",
  "assigned_orders": 50,
  "staff_assignments": [
    {"staff_id": 1, "orders": 10},
    {"staff_id": 2, "orders": 15}
  ]
}
```

### POST `/automation/generate-routes`
**Query Params:** `target_date` (date)
**Response:**
```json
{
  "message": "5件のルートを生成しました",
  "route_ids": [1, 2, 3, 4, 5]
}
```
