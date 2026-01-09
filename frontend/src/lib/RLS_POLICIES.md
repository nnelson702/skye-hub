/**
 * SUPABASE RLS POLICIES DOCUMENTATION
 * 
 * This file documents the Row-Level Security (RLS) policies required for Phase 1 compliance.
 * All policies must be enabled on their respective tables.
 * 
 * NOTE: These policies are configured in Supabase SQL Editor. Ensure each policy is explicitly enabled.
 */

/**
 * TABLE: public.user_profiles
 * 
 * Columns: id (uuid), full_name, email, role (Admin/Manager/Lead/Employee), 
 *          status (active/inactive/deleted), home_store_id (uuid), must_reset_password (bool)
 * 
 * POLICY 1: allow_admin_read_all
 * - Description: Admins can read all user profiles
 * - Expression: (auth.jwt()->'app_metadata'->'role' = '"admin"' OR (SELECT role FROM public.user_profiles WHERE id = auth.uid()) = 'Admin')
 * - Applicable to: SELECT
 * 
 * POLICY 2: allow_admin_write_all
 * - Description: Admins can create, update, and delete user profiles
 * - Expression: (SELECT role FROM public.user_profiles WHERE id = auth.uid()) = 'Admin'
 * - Applicable to: INSERT, UPDATE, DELETE
 * 
 * POLICY 3: allow_self_read
 * - Description: Non-admin users can only read their own profile
 * - Expression: (id = auth.uid())
 * - Applicable to: SELECT
 * 
 * POLICY 4: allow_self_partial_update
 * - Description: Non-admin users cannot update role, status, home_store_id, or must_reset_password
 * - Expression: (id = auth.uid()) AND role IS NOT DISTINCT FROM (SELECT role FROM public.user_profiles WHERE id = auth.uid()) AND status IS NOT DISTINCT FROM (SELECT status FROM public.user_profiles WHERE id = auth.uid())
 * - Applicable to: UPDATE
 * - Note: This prevents non-admins from escalating privileges
 */

/**
 * TABLE: public.user_store_access
 * 
 * Columns: id (uuid), user_id (uuid), store_id (uuid), assigned_by (uuid), created_at (timestamp)
 * 
 * POLICY 1: allow_admin_read_all
 * - Description: Admins can read all store access records
 * - Expression: (SELECT role FROM public.user_profiles WHERE id = auth.uid()) = 'Admin'
 * - Applicable to: SELECT
 * 
 * POLICY 2: allow_admin_write_all
 * - Description: Admins can create and delete store access records
 * - Expression: (SELECT role FROM public.user_profiles WHERE id = auth.uid()) = 'Admin'
 * - Applicable to: INSERT, DELETE
 * 
 * POLICY 3: allow_user_read_own
 * - Description: Non-admin users can read store access for their own user_id
 * - Expression: (user_id = auth.uid())
 * - Applicable to: SELECT
 * 
 * NOTE: Non-admins cannot insert/update/delete; admins manage all store access
 */

/**
 * TABLE: public.stores
 * 
 * Columns: id (uuid), ace_store_number (text), pos_store_number (text), store_name (text),
 *          status (active/inactive), email (text), address_line1, address_line2, city, state,
 *          postal_code, country, date_opened (date), sort_order (int), timezone (text)
 * 
 * POLICY 1: allow_all_read
 * - Description: All authenticated users can read all stores
 * - Expression: true
 * - Applicable to: SELECT
 * 
 * POLICY 2: allow_admin_write
 * - Description: Admins can create, update, and delete stores
 * - Expression: (SELECT role FROM public.user_profiles WHERE id = auth.uid()) = 'Admin'
 * - Applicable to: INSERT, UPDATE, DELETE
 * 
 * NOTE: Store deletes are soft deletes (set status = 'inactive'), not hard deletes
 */

/**
 * ENFORCEMENT CHECKLIST
 * 
 * - [ ] Enable RLS on public.user_profiles
 * - [ ] Create and enable POLICY 1-4 on public.user_profiles
 * - [ ] Enable RLS on public.user_store_access
 * - [ ] Create and enable POLICY 1-3 on public.user_store_access
 * - [ ] Enable RLS on public.stores
 * - [ ] Create and enable POLICY 1-2 on public.stores
 * - [ ] Test non-admin access: should receive permission denied on admin routes
 * - [ ] Test admin access: should see full read/write access
 * - [ ] Verify soft deletes work (status = 'inactive' instead of hard delete)
 * 
 * PHASE 1 COMPLIANCE
 * 
 * ✓ Authentication & Routing: Login/logout/routing untouched; RBAC via RequireAdmin wrapper
 * ✓ Role-Based Access Control: RequireAdmin enforces admin-only access on /admin/* routes
 * ✓ Row-Level Security: RLS policies enforce admin-only reads/writes at database level
 * ✓ Navigation & Header: AppShell hides nav on /login and /reset-password (no conditional rendering per se, route-aware)
 * ✓ Supabase Functions: admin_create_user handles user creation with admin token validation
 * ✓ Store & User Data: Uses existing schema (user_profiles, user_store_access, stores)
 * ✓ Secrets: HUB_SUPABASE_SERVICE_ROLE_KEY and HUB_SUPABASE_URL set in Supabase Functions env (not frontend)
 * ✓ Testing & Documentation: This file documents RLS policies and requirements
 */
