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
  const { user, profile, signOut } = useAuth();
  const loc = useLocation();

  const hideNav = loc.pathname === "/login" || loc.pathname === "/reset-password";

  return (
    <div>
      {!hideNav && (
        <div
          style={{
            alignItems: "center",
            borderBottom: "1px solid #e5e5e5",
            display: "flex",
            justifyContent: "space-between",
            padding: "14px 18px",
          }}
        >
          <div style={{ alignItems: "center", display: "flex", flexWrap: "wrap", rowGap: 8 }}>
            <div style={{ fontWeight: 800, marginRight: 18 }}>Skye Hub</div>
            <NavLink to="/" label="Home" />
            <NavLink to="/communications" label="Communications" />
            <NavLink to="/documents" label="Documents" />
            <NavLink to="/tasks" label="Tasks" />
            <NavLink to="/department-walks" label="Dept Walks" />
            {profile?.role === "Admin" && <NavLink to="/admin" label="Admin Tools" />}
          </div>

          <div style={{ alignItems: "center", display: "flex", gap: 12 }}>
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
