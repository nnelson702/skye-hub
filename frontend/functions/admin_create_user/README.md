admin_create_user Edge Function

Usage:
- POST /functions/v1/admin_create_user
- Headers: Authorization: Bearer <admin_access_token>
- Body: { email, full_name, role, status, home_store_id, invite?: boolean, tempPassword?: string, redirectTo?: string }

Behavior:
- Verifies caller is an Admin by checking `user_profiles.role` using the caller token
- Uses SUPABASE_SERVICE_ROLE_KEY (must be set in Functions environment) to create the Supabase Auth user (temp password fallback)
- Upserts `user_profiles` with returned user id
- Attempts to generate a password reset link (best-effort) if `invite` truthy; otherwise returns tempPassword

Notes:
- Do NOT store service role key in frontend. Deploy this function to Supabase Functions environment and set `SUPABASE_SERVICE_ROLE_KEY` and `SUPABASE_URL` as env vars.
