import { Navigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import type { ReactNode } from "react";

/**
 * RequireAdmin: Gate routes to Admin role only.
 * Non-admins see a 403-style error message.
 * Admins proceed to render children.
 */
export default function RequireAdmin({ children }: { children: ReactNode }) {
  const { booting, user, profileReady, profile } = useAuth();

  // Still loading session or profile
  if (booting || !profileReady) {
    return <div style={{ padding: 24 }}>Loading…</div>;
  }

  // Not signed in -> redirect to login (RequireAuth will catch this earlier in most cases)
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Signed in but not an admin
  if (profile?.role !== "Admin") {
    return (
      <div style={{ padding: 24 }}>
        <h2 style={{ marginTop: 0 }}>Access Denied</h2>
        <p>You do not have permission to access this page.</p>
        <p>Only admins can manage users and stores.</p>
      </div>
    );
  }

  // Admin: render children
  return <>{children}</>;
}
