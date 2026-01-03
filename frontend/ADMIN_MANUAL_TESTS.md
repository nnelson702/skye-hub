Manual Test Checklist (Tracks 1-3)

Track 1 — Vercel SPA (60s)
1) Hard refresh https://hub.helpful.place/admin/users — the app should load (not 404). If unauthenticated, you should be redirected to /login.
2) Hard refresh https://hub.helpful.place/reset-password — the app should load (not 404).

Track 2 — Require auth for entire site
1) From an incognito/private window, load https://hub.helpful.place/ — you should be redirected to /login.
2) Load https://hub.helpful.place/admin/users while unauthenticated — you should be redirected to /login.
3) Log in as a non-admin user — navigate to /admin/users; you should see “Not authorized.”

Track 3 — Admin user lifecycle (use existing users/emails only)
1) Log in as an Admin and go to Admin → Users.
2) Select an EXISITING user (do NOT create a new email). Note the user's status and store access.
3) Click “Send Password Reset” — the admin UI should show a reset link (if generated) and a success notice. Use the link in a private window to confirm the reset flow.
4) Click “Deactivate” — the user’s status should change to `inactive` and their store access should be removed.
   - Verify in a separate browser (or incognito) that the deactivated user cannot sign in and is shown: “Account inactive. Contact admin.”
5) Click “Reactivate” — the user’s status should change to `active` and they should be able to sign in again.
6) Click “Soft Delete” — the user’s status should become `deleted` (or `inactive`) and their store access removed.

Notes / Troubleshooting
- The admin password reset and invite flows depend on the Edge Function `admin_create_user` being deployed in Supabase Functions and configured with required HUB_* env vars (HUB_SUPABASE_SERVICE_ROLE_KEY, HUB_SUPABASE_URL, optionally HUB_REDIRECT_URL/HUB_SITE_URL). If reset link generation fails, the function will still return `ok: true` and may return `resetLink: null`.
- All tests above use existing emails only; do NOT create or send invites to new emails as part of these checks.
