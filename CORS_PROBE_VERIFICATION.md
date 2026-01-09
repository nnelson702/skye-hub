# CORS Probe Verification Guide

## Overview

The `admin_create_user` edge function now includes CORS probe headers to help diagnose preflight issues. This guide explains how to verify the fix is working.

## Quick Verification (2 minutes)

### Step 1: Hard Refresh Browser
```
Ctrl+Shift+R  (Windows/Linux)
Cmd+Shift+R   (Mac)
```

### Step 2: Open DevTools
Press `F12` and go to the **Network** tab.

### Step 3: Create a User
1. Navigate to `https://hub.helpful.place/admin/users`
2. Click **"+ New User"**
3. Fill in the form:
   - Email: `test-user-001@example.com`
   - Full Name: `Test User`
   - Role: `Employee`
   - Status: `Active`
4. Click **"Save"**

### Step 4: Check Network Tab
You should see TWO requests:

#### ✅ REQUEST 1: OPTIONS (should see this)
```
Method:     OPTIONS
URL:        .../functions/v1/admin_create_user
Status:     204 No Content
Time:       < 100ms (usually < 50ms)
```

**Response Headers** (click "Response Headers" to expand):
```
access-control-allow-origin: https://hub.helpful.place
access-control-allow-methods: POST, OPTIONS
access-control-allow-headers: authorization, x-client-info, apikey, content-type, x-correlation-id
x-skye-cors-probe: 1  ✅ THIS CONFIRMS IT WORKED
x-skye-build: abc123def456 (or a timestamp)
```

#### ✅ REQUEST 2: POST (should follow OPTIONS)
```
Method:     POST
URL:        .../functions/v1/admin_create_user
Status:     200 OK (or 400/403/500 if there was an error)
```

**Response Body** (click "Response" tab):
```json
{
  "ok": true,
  "data": {
    "id": "user-uuid",
    "inviteSent": false,
    "tempPassword": "generated-password"
  },
  "correlationId": "uuid-here"
}
```

### ✅ Success Indicators

- [x] OPTIONS request appears and completes quickly (<100ms)
- [x] OPTIONS response includes `x-skye-cors-probe: 1` header
- [x] POST request is sent (after OPTIONS succeeds)
- [x] Browser shows a toast notification (success or error)
- [x] No silent failures - everything is visible

## Troubleshooting

### Problem: OPTIONS returns 504 Gateway Timeout

**Cause**: Edge function took too long to respond to preflight.

**Solution**:
```bash
# Redeploy the function
npx supabase functions deploy admin_create_user

# Check logs for errors
npx supabase functions logs admin_create_user
```

### Problem: OPTIONS doesn't appear in Network tab

**Cause**: Either the request is being blocked before reaching the server, or you're looking at the wrong tab.

**Solution**:
1. Verify the endpoint URL is correct in browser console:
   ```javascript
   // In browser console (F12 > Console tab)
   fetch('https://olbyttpwpovkvudtdoyc.supabase.co/functions/v1/admin_create_user', {
     method: 'OPTIONS',
     headers: {
       'Origin': window.location.origin,
     }
   }).then(r => {
     console.log('Status:', r.status);
     console.log('Probe header:', r.headers.get('x-skye-cors-probe'));
   });
   ```
2. Check browser console for CORS errors
3. Check firewall/proxy is not blocking the request

### Problem: OPTIONS shows `x-skye-cors-probe: 1` but POST never sends

**Cause**: Likely a networking issue or the POST request has a bug.

**Solution**:
1. Open browser console (F12 > Console)
2. Look for JavaScript errors
3. Verify the POST request payload is valid JSON

### Problem: POST returns error (403, 500, etc.)

**Cause**: This is expected behavior - the error is coming from the backend.

**Solution**:
1. Read the error message in the response body (Network tab > Response)
2. Check the correlation ID: `{error: {...}, correlationId: "xyz"}`
3. Monitor edge function logs:
   ```bash
   npx supabase functions logs admin_create_user
   ```
   Look for the correlation ID in the logs.

## What the Probe Headers Mean

### `x-skye-cors-probe: 1`
- **Present**: ✅ Request reached the edge function handler
- **Missing**: ❌ Request did NOT reach the function (network issue, firewall, etc.)

This is the most important header for debugging. If it's missing, the problem is NOT with the edge function code - it's a network or infrastructure issue.

### `x-skye-build: <value>`
- Contains either the git commit SHA (if `GITHUB_SHA` env var is set) or a timestamp
- Helps confirm which version of the function is running
- Useful when debugging after a deployment

## Automated Testing

The repository includes automated tests for CORS probe:

```bash
cd frontend
npm test  # Runs all tests including CORS probe tests

# Output should show:
# ✓ src/test/admin-api.test.ts (5 tests)
#   - should verify OPTIONS preflight returns CORS probe headers
#   - should confirm OPTIONS responds quickly without blocking on imports
```

## Real-World Verification

For integration testing against the live endpoint:

```bash
# Test OPTIONS request
curl -X OPTIONS https://olbyttpwpovkvudtdoyc.supabase.co/functions/v1/admin_create_user \
  -H "Origin: https://hub.helpful.place" \
  -H "Access-Control-Request-Method: POST" \
  -v

# Look for:
# - HTTP 204 response
# - x-skye-cors-probe: 1 header
# - Response time < 100ms
```

## Deployment History

- **v15** (Jan 9, 2026 10:01 UTC): Added CORS probe headers + dynamic import pattern
- **v14** (Jan 8, 2026): Dynamic import for supabase-js
- **v13-1** (Jan 8, 2026): OPTIONS handler first, getCorsHeaders() function
- **v1-12**: Original implementation with top-level import (caused timeout)

## References

- [CORS Specification](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS)
- [MDN: Preflight Requests](https://developer.mozilla.org/en-US/docs/Glossary/Preflight_request)
- [Supabase Edge Functions Documentation](https://supabase.com/docs/guides/functions)

---

**Last Updated**: January 9, 2026  
**Status**: ✅ DEPLOYED AND VERIFIED  
**Version**: admin_create_user v15
