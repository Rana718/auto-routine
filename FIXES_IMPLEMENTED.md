# Critical Fixes Implemented

## Backend Fixes

### 1. ✅ RBAC (Role-Based Access Control)
- **File**: `backend/middlewares/rbac.py`
- **Purpose**: Decorator to restrict endpoints by role (admin, supervisor, buyer)
- **Usage**: `@require_role(StaffRole.ADMIN)` on protected endpoints

### 2. ✅ Admin User Management API
- **File**: `backend/routes/admin.py`
- **Endpoints**:
  - `GET /api/admin/users` - List all users (admin/supervisor)
  - `PATCH /api/admin/users/{id}/role` - Update user role (admin only)
  - `PATCH /api/admin/users/{id}/activate` - Enable/disable user (admin only)
  - `DELETE /api/admin/users/{id}` - Delete user (admin only)

### 3. ✅ Purchase Failure Recording
- **File**: `backend/routes/purchase.py`
- **Endpoints**:
  - `POST /api/purchase/failures` - Record purchase failure with restock date
  - `GET /api/purchase/failures` - Get failure history
- **Model**: `backend/models/purchase.py` - PurchaseFailureCreate

### 4. ✅ Order Item Status Update
- **File**: `backend/routes/orders.py` (appended)
- **Endpoint**: `PATCH /api/orders/{order_id}/items/{item_id}/status`
- **Purpose**: Update individual item status (purchased, failed, discontinued, etc.)

### 5. ✅ Routes Registered
- **File**: `backend/main.py` (appended)
- Added: `/api/admin` and `/api/purchase` routers

## Frontend Fixes

### 6. ✅ Admin User Management Page
- **File**: `frontend/src/app/admin/users/page.tsx`
- **Features**:
  - List all users with roles
  - Change user roles (dropdown)
  - Activate/deactivate users
  - Delete users
  - Real-time updates

### 7. ✅ Order Detail Page
- **File**: `frontend/src/app/orders/[id]/page.tsx`
- **Features**:
  - View all order items
  - Update item status (dropdown)
  - Display SKU, product name, quantity
  - Status badges with colors
  - Back navigation

## Remaining Issues to Fix

### 8. ⏳ Orders Page - Link to Detail
- **File**: `frontend/src/app/orders/page.tsx` (line 210)
- **Change**: Replace "操作" button with link to `/orders/${order.order_id}`
- **Manual Fix Required**: Change button onClick to navigate to detail page

### 9. ⏳ Purchase Failure UI Component
- **File**: Create `frontend/src/components/modals/RecordFailureModal.tsx`
- **Purpose**: Modal to record purchase failures with:
  - Failure type dropdown (discontinued, out_of_stock, store_closed)
  - Restock date picker
  - Alternative store selector
  - Notes textarea

### 10. ⏳ Store-Fixed Product Configuration
- **File**: Create `frontend/src/app/products/page.tsx`
- **Purpose**: Configure which products must be bought from specific stores
- **Features**:
  - Product list with store assignment
  - Toggle "store-fixed" flag
  - Select fixed store
  - Exclude from routing checkbox

### 11. ⏳ Manual Route Editing
- **File**: Update `frontend/src/app/routes/page.tsx`
- **Purpose**: Drag-and-drop route stop reordering
- **Library**: Use `@dnd-kit/core` or `react-beautiful-dnd`
- **API**: Add `PATCH /api/routes/{id}/reorder` endpoint

### 12. ⏳ Bundle Product UI
- **File**: Create `frontend/src/app/products/bundles/page.tsx`
- **Purpose**: Configure set/bundle products
- **Features**:
  - Mark products as bundles
  - Define child items
  - Auto-split rules

### 13. ⏳ Navigation Menu Update
- **File**: `frontend/src/components/layout/MainLayout.tsx` or Sidebar
- **Add Links**:
  - Admin → Users Management (role-restricted)
  - Products → Product Configuration
  - Products → Bundle Configuration

## Quick Implementation Guide

### To Apply Remaining Fixes:

1. **Orders Page Link** (5 min):
```tsx
// In orders/page.tsx line 210
<Button onClick={() => router.push(`/orders/${order.order_id}`)}>
  詳細
</Button>
```

2. **Purchase Failure Modal** (30 min):
- Copy CreateOrderModal structure
- Add failure type select, date picker, store select
- Call `/api/purchase/failures` POST endpoint

3. **Product Configuration Page** (1 hour):
- Similar to stores/page.tsx structure
- Add product list with filters
- Add store-fixed toggle and store selector
- Create `/api/products` CRUD endpoints

4. **Route Drag-Drop** (2 hours):
- Install: `npm install @dnd-kit/core @dnd-kit/sortable`
- Wrap stops in DndContext
- Add reorder API endpoint
- Update route on drop

5. **Navigation** (15 min):
- Add conditional rendering based on user role
- Show admin menu only for admin/supervisor roles

## Testing Checklist

- [ ] Admin can access /admin/users
- [ ] Buyer cannot access /admin/users (403 error)
- [ ] Order detail page shows all items
- [ ] Item status can be updated
- [ ] Purchase failures can be recorded
- [ ] User roles can be changed
- [ ] Users can be activated/deactivated

## Database Migration Note

No schema changes required - all tables already exist in schema.py.
Just ensure migrations are up to date:
```bash
cd backend
alembic upgrade head
```
