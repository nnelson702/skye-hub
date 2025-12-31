// frontend/src/routes/RequireAuth.tsx
import React from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";

export default function RequireAuth() {
  const { session, loading, error } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div style={{ padding: 24 }}>Loading…</div>;
  }

  if (!session) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (error) {
    return (
      <div style={{ padding: 24 }}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>Auth Error</div>
        <div style={{ color: "#b91c1c" }}>{error}</div>
      </div>
    );
  }

  return <Outlet />;
}
