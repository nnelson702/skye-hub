60-second Manual Test Checklist (Vercel SPA rewrite)

1) Hard refresh https://hub.helpful.place/admin/users — the app should load (not a 404) and show the Admin Users page (or redirect to /login when unauthenticated).
2) Hard refresh https://hub.helpful.place/reset-password — the app should load (not a 404) and show the Reset Password UI.

Notes:
- If deploying with Vercel root set to `frontend/`, this file confirms the SPA rewrite is present in `frontend/vercel.json`.
- If you still see a 404, verify Vercel's Project > Settings > Root Directory is set to `frontend` (or move `vercel.json` to repo root if the root is the repository).