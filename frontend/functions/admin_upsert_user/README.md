admin_upsert_user Edge Function

Purpose
- Allows an Admin (authenticated) to create a new Supabase Auth user and upsert a `user_profiles` record using the Supabase service role key.

Security & env
- This function requires a service role key and Supabase URL to operate. Do NOT commit the service role key.
- Required env vars in the Functions runtime (set via Supabase or your host):
  - SUPABASE_URL
  - SUPABASE_SERVICE_ROLE_KEY

Request
- Method: POST
- Auth: Authorization: Bearer <access_token> (must be an admin user)
- Body (JSON): { email, full_name, role?, status?, home_store_id? }

Response
- 200: { id: string, tempPassword: string } (tempPassword is a temporary password; use secure channel to communicate)
- 4xx/5xx: { error: string, details?: any }

Notes
- The function uses Supabase Admin APIs and will attempt to create a user, or find an existing user by email as a best-effort fallback.
- Consider replacing the temp password flow with a password reset/invite flow depending on your email setup.
