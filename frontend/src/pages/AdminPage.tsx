// frontend/src/pages/AdminPage.tsx
import React from "react";
import { Link } from "react-router-dom";

export default function AdminPage() {
  return (
    <div className="page">
      <h1>Admin</h1>

      <div className="card" style={{ maxWidth: 720 }}>
        <div style={{ display: "grid", gap: 10 }}>
          <div>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>Admin Tools</div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <Link className="btn" to="/admin/stores">
                Manage Stores
              </Link>
              <Link className="btn" to="/admin/users">
                Manage Users
              </Link>
            </div>
          </div>

          <div style={{ color: "#6b7280", fontSize: 13 }}>
            Stores and Users are accessible through this Admin page (not in the main navigation).
          </div>
        </div>
      </div>
    </div>
  );
}
