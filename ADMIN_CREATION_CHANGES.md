# Admin Creation & User Management Changes

## ✅ Changes Implemented

### Backend Changes:

1. **Added Admin Secret Key to Config**
   - File: `backend/config/env.py`
   - Added: `admin_secret_key` setting
   - Reads from: `ADMIN_SERCRET_KEY` in `.env`

2. **Removed Public Registration**
   - File: `backend/controllers/auth.py`
   - Removed: `register_user()` function
   - Added: `create_admin_user()` with secret key verification

3. **Updated Auth Routes**
   - File: `backend/routes/auth.py`
   - Removed: `POST /api/auth/register`
   - Added: `POST /api/auth/create-admin` (no auth required, key-protected)

4. **Updated Auth Models**
   - File: `backend/models/auth.py`
   - Removed: `RegisterRequest`
   - Added: `CreateAdminRequest` (includes secret_key field)

5. **Added User Creation for Admins**
   - File: `backend/routes/admin.py`
   - Added: `POST /api/admin/users` (admin/supervisor only)
   - Admins can create users with email/password/role

### Frontend Changes:

6. **Removed Signup Page**
   - Deleted: `frontend/src/app/signup/` directory
   - No public registration available

7. **Updated Admin Users Page**
   - File: `frontend/src/app/admin/users/page.tsx`
   - Added: User creation modal
   - Admins can add users with name, email, password, role

## How It Works Now:

### Initial Admin Creation:
```bash
# Use curl or Postman to create first admin
curl -X POST http://localhost:8000/api/auth/create-admin \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Admin User",
    "email": "admin@example.com",
    "password": "secure-password",
    "secret_key": "aa5bdf8fff15ae01d306cab366af87dd20d4a1e9640e982ab3a60031dc160549"
  }'
```

### After First Admin:
1. Admin logs in via `/signin`
2. Admin goes to `/admin/users`
3. Admin clicks "ユーザー追加" button
4. Admin fills form: name, email, password, role
5. New user is created
6. Admin gives credentials to user
7. User logs in with provided credentials

## Security Flow:

1. ✅ No public registration
2. ✅ First admin created via secret key (one-time)
3. ✅ Only admins/supervisors can create users
4. ✅ Admins set passwords for new users
5. ✅ Users cannot self-register

## API Endpoints:

### Public (No Auth):
- `POST /api/auth/login` - Login
- `POST /api/auth/create-admin` - Create admin (requires secret key)

### Admin Only:
- `POST /api/admin/users` - Create user
- `GET /api/admin/users` - List users
- `PATCH /api/admin/users/{id}/role` - Change role
- `PATCH /api/admin/users/{id}/activate` - Enable/disable
- `DELETE /api/admin/users/{id}` - Delete user

## Testing:

### 1. Create First Admin:
```bash
curl -X POST http://localhost:8000/api/auth/create-admin \
  -H "Content-Type: application/json" \
  -d '{
    "name": "System Admin",
    "email": "admin@company.com",
    "password": "AdminPass123!",
    "secret_key": "aa5bdf8fff15ae01d306cab366af87dd20d4a1e9640e982ab3a60031dc160549"
  }'
```

### 2. Login as Admin:
- Go to http://localhost:3000/signin
- Email: admin@company.com
- Password: AdminPass123!

### 3. Create Users:
- Navigate to /admin/users
- Click "ユーザー追加"
- Fill form and submit

## Notes:

- ✅ Signup page removed
- ✅ Registration endpoint removed
- ✅ Only admin can create users
- ✅ Secret key protects initial admin creation
- ✅ Secret key only needed once (for first admin)
- ✅ After first admin, all users created via admin panel
