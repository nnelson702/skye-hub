admin_create_user Edge Function (Supabase)

Deploy by running from repo root:

1. supabase login
2. supabase link --project-ref <project-ref>
3. supabase functions deploy admin_create_user
4. supabase functions logs admin_create_user --project-ref <project-ref>

Required Secrets (set in Supabase Functions UI or via CLI env vars):
- HUB_SUPABASE_SERVICE_ROLE_KEY: <service role key>
- HUB_SUPABASE_URL: <supabase url>
- HUB_REDIRECT_URL (optional): e.g., https://hub.helpful.place/reset-password
- HUB_SITE_URL (optional): base site url used to build redirect if HUB_REDIRECT_URL not set

Notes:
- The function expects an Authorization Bearer token from a logged-in Admin user.
- It will create an auth user and upsert a `user_profiles` row.
- If invite is requested, it attempts to generate a reset link and returns it to the caller.
- Do NOT commit service role keys to the repo.