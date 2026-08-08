# WatchSphere Admin Panel

## Overview

The admin panel provides administrators with tools to manage users, monitor platform activity, and access analytics.

## Access

- **URL**: `/admin/*` routes
- **Authentication**: Requires admin role (`UserRole.ADMIN`)
- **Protection**: Admin-only routes will redirect non-admin users to the home page

## Admin Panel Structure

### 1. Admin Dashboard (`/admin`)
Main admin overview with key metrics:
- Total users count
- Users by role (Dealers, Collectors, Admins)
- Verified users count
- Active users count
- Recent activity feed
- Quick actions

### 2. User Management (`/admin/users`)

**List View** (`/admin/users`):
- Searchable/filterable table of all users
- Columns:
  - Email
  - Name
  - Role (badge with color)
  - Verified status (checkmark/x)
  - Active status (toggle)
  - Created date
  - Actions (View, Edit, Delete)
- Pagination
- Filters:
  - By role (All, Dealer, Collector, Admin)
  - By status (All, Verified, Unverified, Active, Inactive)
  - Date range

**User Detail** (`/admin/users/:id`):
- Full user profile
- Activity history
- Edit user form:
  - Change role
  - Toggle verified status
  - Toggle active status
  - Reset password (future)
- Delete user (with confirmation)

### 3. Analytics (`/admin/analytics`)
- User growth charts
- Registration trends
- Active users over time
- Role distribution pie chart

### 4. Settings (`/admin/settings`)
- Platform settings
- Email templates
- Feature flags
- System logs

## API Endpoints

All admin endpoints are prefixed with `/api/v1/admin` and require admin authentication.

### Dashboard
```
GET /api/v1/admin/dashboard
```
Returns: Dashboard statistics

### Users
```
GET    /api/v1/admin/users          # List all users
GET    /api/v1/admin/users/:id      # Get user by ID
PATCH  /api/v1/admin/users/:id      # Update user
DELETE /api/v1/admin/users/:id      # Delete user
```

## Implementation Checklist

### Backend ✅
- [x] User model with role support
- [x] Admin role enum
- [x] Admin authentication dependency
- [x] Admin endpoints
- [x] Seed script for admin user

### Frontend (To Do)
- [ ] Admin route protection
- [ ] Admin dashboard page
- [ ] User management table
- [ ] User detail/edit page
- [ ] Role badges component
- [ ] Status toggle component
- [ ] Confirmation dialogs
- [ ] Admin navigation sidebar
- [ ] Analytics charts

## Design Guidelines

### Colors by Role
- **Admin**: Red/Orange (`#FF3B30`)
- **Dealer**: Blue (`#007AFF`)
- **Collector**: Green (`#34C759`)

### Layout
```
┌─────────────────────────────────────────────┐
│  WatchSphere Admin                 [Logout] │
├───────────┬─────────────────────────────────┤
│           │                                 │
│ Dashboard │  Main Content Area              │
│ Users     │                                 │
│ Analytics │  Tables, Forms, Charts          │
│ Settings  │                                 │
│           │                                 │
│ [Back to  │                                 │
│  App]     │                                 │
└───────────┴─────────────────────────────────┘
```

### Components to Create

1. **AdminLayout** - Sidebar navigation wrapper
2. **RoleBadge** - Displays user role with appropriate color
3. **StatusToggle** - Toggle switch for active/verified status
4. **UserTable** - Sortable, filterable user table
5. **StatCard** - Dashboard statistic card
6. **ConfirmDialog** - Confirmation modal for destructive actions
7. **AdminRoute** - Protected route wrapper

## Security

- All admin routes check for `role === 'admin'`
- Backend validates admin access on every request
- JWT token includes user role
- Admin actions are logged (future)
- Rate limiting on admin endpoints (future)

## Getting Started

### 1. Create Admin User

Run the seed script to create the initial admin account:

```bash
cd apps/backend
source venv/bin/activate
python scripts/seed_admin.py
```

This will create:
- **Email**: admin@watchsphere.com (override: `SEED_ADMIN_EMAIL`)
- **Password**: local dev fixture default, printed by the script (override: `SEED_ADMIN_PASSWORD`)
- ⚠️ Local development only — never seed this account into production, and
  change the password after first login.

### 2. Test Admin Access

1. Start the backend server
2. Login with admin credentials at `/api/v1/auth/login`
3. Access admin endpoints with the returned token
4. Build admin UI in the web app

### 3. Implement Admin Routes (Web)

Create the following routes in `apps/web/src/`:

```typescript
// src/routes/admin.tsx
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth';

export function AdminRoute({ children }) {
  const { user } = useAuthStore();

  if (!user || user.role !== 'admin') {
    return <Navigate to="/" replace />;
  }

  return children;
}
```

## Notes

- The admin panel is separate from the main app UI
- Regular users cannot access admin routes
- Admin users can still access regular app features
- Consider adding activity logs for all admin actions
- Future: Add role-based permissions (RBAC) for granular control
