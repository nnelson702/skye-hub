import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import type { ReactNode } from "react";

export default function RequireAuth({ children }: { children: ReactNode }) {
  const { booting, user, error, retry, signOut } = useAuth();
  const loc = useLocation();

  if (booting) {
    return <div style={{ padding: 24 }}>Loading…</div>;
  }

  if (error) {
    return (
      <div style={{ padding: 24 }}>
        <h2 style={{ marginTop: 0 }}>Auth Error</h2>
        <div style={{ color: "crimson", marginBottom: 12 }}>{error}</div>
        <button onClick={retry} style={{ marginRight: 8 }}>
          Retry
        </button>
        <button onClick={() => void signOut()}>Sign out</button>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  }

  return <>{children}</>;
}
