import { Navigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";

export default function RequirePasswordReset({ children }: { children: React.ReactNode }) {
  // Placeholder guard for later. We are NOT using user_profiles.force_password_reset (column does not exist).
  // Keeping this file so the app structure doesn't drift.
  const { booting, user } = useAuth();

  if (booting) return <div style={{ padding: 24 }}>Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;

  return <>{children}</>;
}
