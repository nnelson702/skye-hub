export type UserRole = "Admin" | "Manager" | "Lead" | "Employee";
export type UserStatus = "active" | "inactive";

export type UserProfile = {
  id: string; // should match Supabase Auth user id once we wire Edge Function admin_upsert_user
  full_name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  home_store_id: string | null;
  must_reset_password?: boolean;
};
