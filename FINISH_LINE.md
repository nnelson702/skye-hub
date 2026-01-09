# Phase 1 Admin Features - Finish Line Checklist

## Deployment Status ✅

**Deployed Environment**: hub.helpful.place  
**Repository**: nnelson702/skye-hub  
**Last Updated**: January 8, 2026

---

## What Was Delivered

### ✅ Core Features Implemented

1. **Admin User Management** (Tool > Admin > Users)
   - Create new users with immediate UI visibility
   - Send password reset emails via Supabase
   - Deactivate/reactivate users
   - Soft delete users (status='deleted')
   - Toast notifications for all operations (success/failure)
   - Correlation IDs for request tracking

2. **Admin Store Management** (Tool > Admin > Stores)
   - Create stores with immediate UI reflection
   - Update existing stores
   - Soft delete stores (status='inactive')
   - Toast notifications for all operations

3. **Observability & Debugging**
   - Correlation ID tracking across client and server
   - Structured error responses with actionable messages
   - Console logging with consistent prefixes
   - Toast notifications with correlation IDs displayed

4. **Testing**
   - Frontend unit tests (Vitest + Testing Library)
   - API contract tests with mocked fetch
   - 4 passing tests covering core functionality

---

## Environment Variables

### Frontend (Vercel or local .env)
```bash
VITE_SUPABASE_URL=https://olbyttpwpovkvudtdoyc.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

### Edge Function (Supabase Secrets)
```bash
HUB_SUPABASE_URL=https://olbyttpwpovkvudtdoyc.supabase.co
HUB_SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```

**To set edge function secrets:**
```bash
npx supabase secrets set HUB_SUPABASE_URL=https://olbyttpwpovkvudtdoyc.supabase.co
npx supabase secrets set HUB_SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

**To verify secrets are set:**
```bash
npx supabase secrets list
```

---

## Supabase Auth Configuration

### Required Settings (in Supabase Dashboard > Authentication > URL Configuration)

1. **Site URL**: `https://hub.helpful.place`
2. **Redirect URLs** (add both):
   - `https://hub.helpful.place/reset-password`
   - `https://hub.helpful.place/*`

### SMTP/Email Settings
- Navigate to Supabase Dashboard > Authentication > Email Templates
- Verify email provider is configured (or emails won't send)
- Test password reset emails use the configured SMTP

---

## RLS Policies Required

**CRITICAL**: These policies MUST be in place for admin features to work.

See [RLS_POLICIES.md](frontend/src/lib/RLS_POLICIES.md) for complete SQL commands.

### Summary:
1. **user_profiles**: 4 policies (admin read/write all, self read, self partial update)
2. **user_store_access**: 3 policies (admin read/write, user read own)
3. **stores**: 2 policies (all read, admin write)

**To apply RLS policies:**
1. Open Supabase SQL Editor
2. Copy policies from RLS_POLICIES.md
3. Execute each policy individually
4. Verify with: `SELECT * FROM pg_policies WHERE schemaname = 'public';`

---

## Deployment Steps

### 1. Deploy Edge Function
```bash
cd skye-hub
npx supabase functions deploy admin_create_user
```

**Verify deployment:**
- Check Supabase Dashboard > Edge Functions > admin_create_user
- Status should show "Deployed"
- Script size: ~854kB

### 2. Deploy Frontend to Vercel
```bash
cd frontend
npm run build  # Verify builds successfully
git push origin main  # Triggers Vercel deployment
```

**Vercel Settings:**
- Root Directory: `frontend`
- Build Command: `npm run build`
- Output Directory: `dist`
- Install Command: `npm install`

### 3. Verify Deployment
```bash
# Check edge function logs
npx supabase functions logs admin_create_user

# Test frontend build locally
npm run preview
```

---

## Testing Procedures

### Automated Tests
```bash
cd frontend

# Run all tests
npm test

# Watch mode for development
npm run test:watch

# UI mode for interactive testing
npm run test:ui

# Run lint
npm run lint

# Build for production
npm run build
```

**Expected Results:**
- ✅ 2 test files passing
- ✅ 4 tests passing
- ✅ No lint errors
- ✅ Build successful

### Manual Smoke Tests

#### Test 1: Create User
1. Log in as admin user
2. Navigate to `/admin/users`
3. Click "+ New User"
4. Fill form (use fake email for testing)
5. **Expected**: Toast notification "User created successfully"
6. **Expected**: New user appears in left sidebar immediately
7. **Expected**: Console shows `[AdminUsersPage] User created successfully (correlation: xxx)`

#### Test 2: Password Reset
1. Select existing user
2. Click "Send Password Reset"
3. **Expected**: Toast notification "Password reset email sent to..."
4. **Expected**: If email is real, user receives email from Supabase
5. **Expected**: Console shows `[AdminUsersPage] Password reset email sent successfully`

#### Test 3: Store CRUD
1. Navigate to `/admin/stores`
2. Click "New Store"
3. Fill form and save
4. **Expected**: Toast notification "Store created successfully"
5. **Expected**: Store appears in list immediately
6. **Expected**: Console shows `AdminStoresPage: save complete ok=true`

#### Test 4: Lifecycle Operations
1. Select active user
2. Click "Deactivate"
3. **Expected**: Toast notification "User deactivated"
4. **Expected**: User status changes to "inactive"
5. Try same for Reactivate and Soft Delete

---

## Troubleshooting

### Issue: User creation fails with "Failed to create user (HTTP 401)"
**Cause**: Authorization token expired  
**Solution**: Log out and log back in

### Issue: User creation fails with "Failed to create user (HTTP 403)"
**Cause**: Current user is not an Admin  
**Solution**: Verify `user_profiles.role = 'Admin'` in database

### Issue: User creation fails with "Failed to create user (HTTP 500)"
**Cause**: Server-side error (edge function or database)  
**Solution**:
1. Check edge function logs: `npx supabase functions logs admin_create_user`
2. Verify RLS policies are set up (see RLS_POLICIES.md)
3. Verify secrets are set: `npx supabase secrets list`

### Issue: User created but doesn't appear in list
**Cause**: RLS policy blocking read access  
**Solution**: Verify `admin_read_all_profiles` policy exists on user_profiles

### Issue: No toast notifications showing
**Cause**: Toaster component not mounted  
**Solution**: Verify `<Toaster />` is in App.tsx (should be)

### Issue: Correlation IDs not in logs
**Cause**: Old edge function version deployed  
**Solution**: Redeploy with: `npx supabase functions deploy admin_create_user`

---

## Observability & Debugging

### Client-Side Logging
All admin operations log to browser console with consistent prefixes:
- `[AdminUsersPage]` - User management operations
- `[AdminStoresPage]` - Store management operations
- Includes correlation IDs for tracing requests

### Server-Side Logging
Edge function logs available at:
```bash
npx supabase functions logs admin_create_user
```

Or in Supabase Dashboard > Edge Functions > admin_create_user > Logs

### Correlation ID Tracking
Every API request generates a UUID correlation ID:
- Passed in `x-correlation-id` header
- Returned in response JSON
- Displayed in toast notifications (truncated to 8 chars)
- Logged on both client and server

**Example flow:**
1. Client generates: `correlation: 12345678-1234-1234-1234-123456789012`
2. Toast shows: `User created successfully (ID: 12345678)`
3. Client logs: `[AdminUsersPage] User created successfully (correlation: 12345678-...)`
4. Server logs: `[admin_create_user] Request received (correlation: 12345678-...)`

---

## API Contract

### Edge Function: admin_create_user

**Endpoint**: `https://olbyttpwpovkvudtdoyc.supabase.co/functions/v1/admin_create_user`

**Required Headers:**
```javascript
{
  "Authorization": "Bearer <user_access_token>",
  "apikey": "<SUPABASE_ANON_KEY>",
  "Content-Type": "application/json",
  "x-correlation-id": "<uuid>"
}
```

**Mode: create (default)**
```json
{
  "email": "user@example.com",
  "full_name": "John Doe",
  "role": "Employee",
  "status": "active",
  "home_store_id": "store-uuid",
  "must_reset_password": true,
  "invite": false,
  "tempPassword": "optional-temp-password",
  "redirectTo": "https://hub.helpful.place/reset-password"
}
```

**Success Response:**
```json
{
  "ok": true,
  "data": {
    "id": "user-uuid",
    "inviteSent": false,
    "tempPassword": "generated-password",
    "resetLink": null
  },
  "correlationId": "uuid"
}
```

**Error Response:**
```json
{
  "ok": false,
  "error": {
    "message": "Forbidden: Admin role required",
    "code": "FORBIDDEN",
    "details": {...}
  },
  "correlationId": "uuid"
}
```

**Mode: reset**
```json
{
  "mode": "reset",
  "email": "user@example.com",
  "redirectTo": "https://hub.helpful.place/reset-password"
}
```

**Success Response:**
```json
{
  "ok": true,
  "data": {
    "resetLink": null
  },
  "correlationId": "uuid"
}
```

---

## Rollback Instructions

If issues occur after deployment, roll back to previous version:

```bash
# View recent commits
git log --oneline -10

# Identify last stable commit (before Phase 1 admin work)
# Create rollback branch
git checkout -b rollback-admin-features <stable-commit-sha>

# Push to trigger Vercel deployment
git push origin rollback-admin-features

# Redeploy old edge function version
git checkout <stable-commit-sha> -- supabase/functions/admin_create_user/
npx supabase functions deploy admin_create_user
```

---

## Success Criteria Verification

### ✅ No Silent Failures
- Every operation shows toast notification (success or failure)
- Error messages are actionable (include HTTP status, error code)
- Correlation IDs allow tracing failed requests

### ✅ Immediate UI Reflection
- Created users appear in list without page refresh
- Updated users/stores reflect changes immediately
- Deleted items removed from list immediately

### ✅ Phase 1 Constitution Compliance
- No schema changes
- Existing authentication flows preserved
- RLS policies enforced
- Admin-only access (RBAC)
- Surgical changes only (no unrelated refactoring)

### ✅ Testability
- 4 automated tests passing
- Manual smoke test checklist provided
- Tests cover API contract and core flows

### ✅ Reversibility
- All changes committed with clear messages
- Rollback instructions provided
- Edge function can be redeployed to previous version

---

## Next Steps (Post-Phase 1)

1. **Add more comprehensive tests**
   - E2E tests with Playwright
   - Edge function Deno tests

2. **Enhanced observability**
   - Structured logging service (e.g., Sentry)
   - Performance monitoring

3. **Additional admin features**
   - Bulk user operations
   - Store assignment workflow improvements
   - User audit log

4. **Polish**
   - Better loading states
   - Optimistic UI updates
   - Enhanced error recovery

---

## Support & Documentation

- **Troubleshooting Guide**: [TROUBLESHOOTING.md](TROUBLESHOOTING.md)
- **RLS Policies**: [frontend/src/lib/RLS_POLICIES.md](frontend/src/lib/RLS_POLICIES.md)
- **Phase 1 Delivery Summary**: [PHASE_1_ADMIN_DELIVERY.md](PHASE_1_ADMIN_DELIVERY.md)

**For issues or questions:**
1. Check browser console for detailed logs
2. Check edge function logs: `npx supabase functions logs admin_create_user`
3. Verify environment variables are set correctly
4. Verify RLS policies are in place

---

## Deployment Checklist Summary

Before going live, verify:

- [ ] Edge function deployed: `npx supabase functions deploy admin_create_user`
- [ ] Secrets set: `npx supabase secrets list` (shows HUB_SUPABASE_URL, HUB_SUPABASE_SERVICE_ROLE_KEY)
- [ ] RLS policies applied (see RLS_POLICIES.md)
- [ ] Supabase Auth URLs configured (Site URL + Redirect URLs)
- [ ] Frontend built successfully: `npm run build`
- [ ] Tests passing: `npm test` (4/4 passing)
- [ ] Lint passing: `npm run lint` (0 errors)
- [ ] Vercel environment variables set (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)
- [ ] Manual smoke tests completed (create user, reset password, CRUD stores)

---

**Status**: ✅ Ready for production deployment to hub.helpful.place
