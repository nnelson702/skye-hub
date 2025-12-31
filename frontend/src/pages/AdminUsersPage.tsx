// frontend/src/pages/AdminUsersPage.tsx
import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../auth/AuthProvider";

type Role = "employee" | "lead" | "manager" | "admin";
type Status = "active" | "inactive";

type StoreRow = { id: string; store_name: string; ace_store_number: string; status: Status };
type ProfileRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: Role | null;
  status: Status | null;
  home_store_id: string | null;
};

export default function AdminUsersPage() {
  const { role: myRole } = useAuth();
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [stores, setStores] = useState<StoreRow[]>([]);
  const [users, setUsers] = useState<ProfileRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const emptyUser: ProfileRow = useMemo(
    () => ({
      id: "",
      full_name: "",
      email: "",
      role: "employee",
      status: "active",
      home_store_id: null,
    }),
    []
  );

  const [form, setForm] = useState<ProfileRow>(emptyUser);

  const load = async () => {
    try {
      setErr(null);
      setLoading(true);

      const [{ data: storeData, error: storeErr }, { data: userData, error: userErr }] = await Promise.all([
        supabase.from("stores").select("id, store_name, ace_store_number, status").order("store_name", { ascending: true }),
        supabase.from("user_profiles").select("id, full_name, email, role, status, home_store_id").order("full_name", { ascending: true }),
      ]);

      if (storeErr) throw storeErr;
      if (userErr) throw userErr;

      setStores((storeData as StoreRow[]) ?? []);
      setUsers((userData as ProfileRow[]) ?? []);

      if (selectedId) {
        const match = (userData as ProfileRow[])?.find((u) => u.id === selectedId);
        if (match) setForm(match);
      }
    } catch (e: any) {
      setErr(e?.message ?? "Failed to load users.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (myRole !== "admin") return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myRole]);

  if (myRole !== "admin") return <div>Not authorized.</div>;

  const pick = (id: string) => {
    setSelectedId(id);
    const u = users.find((x) => x.id === id);
    if (u) setForm(u);
  };

  const newUser = () => {
    setSelectedId(null);
    setForm({ ...emptyUser });
  };

  const saveProfileOnly = async () => {
    try {
      setErr(null);

      // IMPORTANT:
      // user_profiles.id MUST be the Supabase Auth user.id.
      // This screen is only for editing an existing profile row.
      // Creating a brand-new user must be done via Edge Function (admin_upsert_user) later.
      if (!form.id) {
        setErr("Create is not wired yet. Pick an existing user to edit for now.");
        return;
      }

      const payload: any = { ...form };
      if (!payload.full_name) payload.full_name = null;
      if (!payload.email) payload.email = null;
      if (!payload.home_store_id) payload.home_store_id = null;

      const { error } = await supabase.from("user_profiles").upsert(payload, { onConflict: "id" });
      if (error) throw error;

      await load();
    } catch (e: any) {
      setErr(e?.message ?? "Save failed.");
    }
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "340px 1fr", gap: 16, alignItems: "start" }}>
      <div style={{ border: "1px solid #eee", borderRadius: 14, padding: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <div style={{ fontWeight: 800 }}>Users</div>
          <button onClick={newUser} style={{ border: "1px solid #ddd", background: "#fff", borderRadius: 10, padding: "6px 10px", cursor: "pointer" }}>
            + New
          </button>
        </div>

        {loading ? <div>Loading…</div> : null}
        {err ? <div style={{ color: "crimson", marginBottom: 10 }}>{err}</div> : null}

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {users.map((u) => (
            <button
              key={u.id}
              onClick={() => pick(u.id)}
              style={{
                textAlign: "left",
                border: "1px solid #eee",
                background: selectedId === u.id ? "rgba(0,0,0,0.04)" : "#fff",
                borderRadius: 12,
                padding: 10,
                cursor: "pointer",
              }}
            >
              <div style={{ fontWeight: 800 }}>{u.full_name ?? u.email ?? "—"}</div>
              <div style={{ color: "#666", fontSize: 12 }}>
                {u.email ?? "—"} • {u.role ?? "—"} • {u.status ?? "—"}
              </div>
            </button>
          ))}
        </div>
      </div>

      <div style={{ border: "1px solid #eee", borderRadius: 14, padding: 12 }}>
        <div style={{ fontWeight: 800, marginBottom: 10 }}>{selectedId ? "Edit User (profile)" : "Create User (not wired yet)"}</div>

        {err ? <div style={{ color: "crimson", marginBottom: 10 }}>{err}</div> : null}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <label style={{ gridColumn: "span 2" }}>
            <div style={{ fontSize: 12, color: "#666" }}>Auth User ID (read-only)</div>
            <input value={form.id} readOnly style={{ width: "100%", padding: 8, background: "#fafafa" }} />
          </label>

          <label>
            <div style={{ fontSize: 12, color: "#666" }}>Full Name</div>
            <input value={form.full_name ?? ""} onChange={(e) => setForm({ ...form, full_name: e.target.value })} style={{ width: "100%", padding: 8 }} />
          </label>

          <label>
            <div style={{ fontSize: 12, color: "#666" }}>Email</div>
            <input value={form.email ?? ""} onChange={(e) => setForm({ ...form, email: e.target.value })} style={{ width: "100%", padding: 8 }} />
          </label>

          <label>
            <div style={{ fontSize: 12, color: "#666" }}>Role</div>
            <select value={(form.role ?? "employee") as Role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })} style={{ width: "100%", padding: 8 }}>
              <option value="employee">Employee</option>
              <option value="lead">Lead</option>
              <option value="manager">Manager</option>
              <option value="admin">Admin</option>
            </select>
          </label>

          <label>
            <div style={{ fontSize: 12, color: "#666" }}>Status</div>
            <select value={(form.status ?? "active") as Status} onChange={(e) => setForm({ ...form, status: e.target.value as Status })} style={{ width: "100%", padding: 8 }}>
              <option value="active">active</option>
              <option value="inactive">inactive</option>
            </select>
          </label>

          <label style={{ gridColumn: "span 2" }}>
            <div style={{ fontSize: 12, color: "#666" }}>Home Store</div>
            <select
              value={form.home_store_id ?? ""}
              onChange={(e) => setForm({ ...form, home_store_id: e.target.value || null })}
              style={{ width: "100%", padding: 8 }}
            >
              <option value="">— None —</option>
              {stores
                .filter((s) => s.status === "active")
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.store_name} (ACE {s.ace_store_number})
                  </option>
                ))}
            </select>
          </label>
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
          <button onClick={saveProfileOnly} style={{ border: "1px solid #ddd", background: "#fff", borderRadius: 10, padding: "8px 12px", cursor: "pointer", fontWeight: 700 }}>
            Save
          </button>
          <button onClick={newUser} style={{ border: "1px solid #ddd", background: "#fff", borderRadius: 10, padding: "8px 12px", cursor: "pointer" }}>
            Clear / New
          </button>
        </div>

        <div style={{ marginTop: 14, border: "1px solid #eee", borderRadius: 12, padding: 12, background: "#fafafa" }}>
          <div style={{ fontWeight: 800, marginBottom: 8 }}>Notes / Rules</div>
          <ul style={{ margin: 0, paddingLeft: 18, color: "#555" }}>
            <li>Non-admin users must have a Home Store.</li>
            <li>Managers will only manage users within stores they are the Primary Store Manager for (we’ll enforce via RLS later).</li>
            <li>User creation (Auth + profile) will be wired through Edge Function next (admin_upsert_user).</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
