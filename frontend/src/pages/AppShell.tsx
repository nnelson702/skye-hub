// frontend/src/pages/AppShell.tsx
import React from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";

export default function AppShell() {
  const { user, session, signOut } = useAuth();
  const location = useLocation();

  const showTopNav = !location.pathname.startsWith("/login") && !location.pathname.startsWith("/reset-password");

  return (
    <div className="app">
      {showTopNav && (
        <header className="topbar">
          <div className="topbar__left">
            <div className="brand">Skye Hub</div>
            <nav className="nav">
              <Link className="nav__link" to="/home">
                Home
              </Link>
              <Link className="nav__link" to="/admin">
                Admin
              </Link>
            </nav>
          </div>

          <div className="topbar__right">
            {session && (
              <>
                <div className="whoami">
                  {user?.user_metadata?.full_name || user?.email || "Signed in"}
                </div>
                <button className="btn" onClick={signOut}>
                  Sign out
                </button>
              </>
            )}
          </div>
        </header>
      )}

      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
