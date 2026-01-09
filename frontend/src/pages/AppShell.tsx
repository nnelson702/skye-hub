import { type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";

function NavLink({ to, label }: { to: string; label: string }) {
  const loc = useLocation();
  const active = loc.pathname === to || (to !== "/" && loc.pathname.startsWith(to));
  return (
    <Link
      to={to}
      style={{
        marginRight: 14,
        textDecoration: "none",
        color: active ? "#111" : "#1a0dab",
        fontWeight: active ? 700 : 400,
      }}
    >
      {label}
    </Link>
  );
}

export default function AppShell({ children }: { children: ReactNode }) {
  const { user, signOut } = useAuth();
  const loc = useLocation();

  // Hide navigation on login and password reset pages
  const hideNav = loc.pathname === "/login" || loc.pathname === "/reset-password";

  return (
    <div>
      {!hideNav && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "14px 18px",
            borderBottom: "1px solid #e5e5e5",
          }}
        >
          <div style={{ display: "flex", alignItems: "center" }}>
            <div style={{ fontWeight: 800, marginRight: 18 }}>Skye Hub</div>
            <NavLink to="/" label="Home" />
            <NavLink to="/admin" label="Admin" />
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {user ? (
              <>
                <div style={{ color: "#555" }}>{user.email ?? "Signed in"}</div>
                <button onClick={() => void signOut()}>Sign out</button>
              </>
            ) : null}
          </div>
        </div>
      )}

      <div style={{ padding: 18 }}>{children}</div>
    </div>
  );
}
