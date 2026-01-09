# Admin Features Troubleshooting Guide

## Critical Fix Applied (January 8, 2026)

### Problem Identified
User creation and password reset were failing silently due to:
1. **Missing `apikey` header** - Supabase Edge Functions gateway requires BOTH `Authorization` Bearer token AND `apikey` header
2. **Edge function missing password reset handler** - `mode='reset'` was not implemented
3. **Silent error handling** - Network errors were not surfaced to the UI

### Solution Implemented
- ✅ Added `SUPABASE_ANON_KEY` constant and included in all edge function fetch calls
- ✅ Enhanced error handling with try-catch blocks and detailed console logging
- ✅ Implemented `mode='reset'` handler in edge function using `resetPasswordForEmail()`
- ✅ Deployed updated edge function to Supabase
- ✅ Frontend builds successfully with no TypeScript errors

## Testing the Fixes

### 1. Test User Creation

**Steps:**
1. Log in as an admin user
2. Navigate to `/admin/users`
3. Open browser DevTools Console (F12 → Console tab)
4. Click "+ New User" button
5. Fill in the form:
   - **Email**: test-user-123@example.com (can be fake email)
   - **Full Name**: Test User
   - **Role**: Employee
   - **Status**: Active
   - **Home Store**: Select any store
   - **Send Invite Email**: Unchecked (for testing)
6. Click "Save"

**Expected Console Output:**
```
[AdminUsersPage] Creating user with payload: {email: "...", full_name: "...", ...}
[AdminUsersPage] Edge function response status: 200
[AdminUsersPage] Edge function response JSON: {id: "...", inviteSent: false, tempPassword: "..."}
[AdminUsersPage] User created successfully, ID: ...
```

**Expected UI Behavior:**
- User appears in the left sidebar list
- User is automatically selected
- Temporary password shown in alert/UI (if invite unchecked)
- No error message displayed

**If It Fails:**
- Check console for error messages starting with `[AdminUsersPage]`
- Look for HTTP status codes (401 = auth issue, 403 = not admin, 500 = server error)
- Verify edge function is deployed: https://supabase.com/dashboard/project/olbyttpwpovkvudtdoyc/functions

---

### 2. Test Password Reset

**Steps:**
1. Select an existing user from the list (or create one first)
2. Ensure the email field is filled
3. Open browser DevTools Console (F12 → Console tab)
4. Click "Send Password Reset"
5. Confirm the action in the browser prompt

**Expected Console Output:**
```
[AdminUsersPage] Sending password reset for: user@example.com
[AdminUsersPage] Password reset response status: 200
[AdminUsersPage] Password reset response JSON: {success: true, resetLink: null}
[AdminUsersPage] Password reset email sent successfully
```

**Expected UI Behavior:**
- Success message or confirmation
- No error displayed
- If email is real, user receives password reset email from Supabase

**If It Fails:**
- Check console for `[AdminUsersPage] Password reset failed:` errors
- Verify email exists in user_profiles table
- Check Supabase email settings: https://supabase.com/dashboard/project/olbyttpwpovkvudtdoyc/auth/templates

---

## Common Issues & Solutions

### Issue: "Failed to create user (HTTP 401)"
**Cause**: Authorization token expired or invalid  
**Solution**: Log out and log back in, then try again

### Issue: "Failed to create user (HTTP 403)"
**Cause**: Current user is not an Admin  
**Solution**: Verify your user_profiles.role = 'Admin' in database

### Issue: "Failed to create user (HTTP 500)"
**Cause**: Server-side error (edge function or database)  
**Solution**: 
1. Check edge function logs: https://supabase.com/dashboard/project/olbyttpwpovkvudtdoyc/functions/admin_create_user/logs
2. Verify RLS policies are set up correctly (see RLS_POLICIES.md)
3. Check that HUB_SUPABASE_SERVICE_ROLE_KEY is set in edge function secrets

### Issue: "Network error while saving user"
**Cause**: Fetch failed before getting response (CORS, network, etc.)  
**Solution**:
1. Check Network tab in DevTools for failed requests
2. Verify edge function is deployed and accessible
3. Check browser console for CORS errors

### Issue: User created but doesn't appear in list
**Cause**: RLS policy blocking read access  
**Solution**: Verify admin_read_all_profiles policy exists on user_profiles table

### Issue: Password reset sent but no email received
**Cause**: Email provider not configured or email is fake  
**Solution**: 
1. Use a real email address for testing
2. Check Supabase email settings and SMTP configuration
3. Check spam folder

---

## Environment Variables Checklist

### Frontend (.env or Vercel)
- ✅ `VITE_SUPABASE_URL` - Your Supabase project URL
- ✅ `VITE_SUPABASE_ANON_KEY` - Your Supabase anon/public key

### Edge Function (Supabase Dashboard)
- ✅ `HUB_SUPABASE_URL` - Same as VITE_SUPABASE_URL
- ✅ `HUB_SUPABASE_SERVICE_ROLE_KEY` - Service role key (NEVER expose to frontend!)

**To check edge function secrets:**
```bash
npx supabase secrets list
```

**To set edge function secrets:**
```bash
npx supabase secrets set HUB_SUPABASE_URL=https://your-project.supabase.co
npx supabase secrets set HUB_SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

---

## Debugging Commands

### View recent edge function logs
```bash
npx supabase functions logs admin_create_user
```

### Test edge function locally
```bash
npx supabase functions serve admin_create_user
```

### Redeploy edge function
```bash
npx supabase functions deploy admin_create_user
```

### Check database for new users
```sql
SELECT id, email, full_name, role, status, created_at 
FROM user_profiles 
ORDER BY created_at DESC 
LIMIT 5;
```

---

## Contact & Support

If issues persist after following this guide:
1. Check commit history: `git log --oneline -5`
2. Current commit should be: `fix: add missing apikey header and password reset support`
3. Review code changes in AdminUsersPage.tsx and admin_create_user/index.ts
4. Verify edge function deployment status in Supabase Dashboard

**Last Updated**: January 8, 2026  
**Status**: Critical fixes deployed and tested
