export type UserRole = "Employee" | "Lead" | "Manager" | "Admin";
export type UserStatus = "active" | "inactive";

export type UserProfile = {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  status: UserStatus;
  home_store_id: string | null;
  must_reset_password: boolean;
};
