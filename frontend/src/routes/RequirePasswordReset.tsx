import { Navigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";

export function RequirePasswordReset({ children }: { children: JSX.Element }) {
  const { profile, loading } = useAuth();

  if (loading) return <div style={{ padding: 24 }}>Loading…</div>;
  if (!profile) return <Navigate to="/login" replace />;

  if (profile.must_reset_password) {
    return <Navigate to="/reset-password" replace />;
  }

  return children;
}
