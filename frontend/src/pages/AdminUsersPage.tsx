import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import type { UserProfile, UserRole, UserStatus } from "../types/profile";

type StoreRow = {
  id: string;
  ace_store_number: string;
  pos_store_number: string;
  store_name: string;
  status: string;
};

const ROLES: UserRole[] = ["Admin", "Manager", "Lead", "Employee"];
const STATUSES: UserStatus[] = ["active", "inactive"];

export default function AdminUsersPage() {
  const [stores, setStores] = useState<StoreRow[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [filterText, setFilterText] = useState("");
  const [filterStatus, setFilterStatus] = useState<UserStatus | "all">("active");

  const emptyForm = useMemo(
    () => ({
      id: "",
      full_name: "",
      email: "",
      role: "Employee" as UserRole,
      status: "active" as UserStatus,
      home_store_id: "" as string,
      // NOTE: we are NOT storing force_password_reset anywhere (column does not exist).
      // The real implementation will be via Edge Function (service role) to create/invite auth users.
      request_password_reset: true,
    }),
    []
  );

  const [form, setForm] = useState({ ...emptyForm });

  const load = async () => {
    setLoading(true);
    setErr(null);

    try {
      const [{ data: storeData, error: storeErr }, { data: userData, error: userErr }] =
        await Promise.all([
          supabase
            .from("stores")
            .select("id, ace_store_number, pos_store_number, store_name, status")
            .order("store_name", { ascending: true }),
          supabase
            .from("user_profiles")
            .select("id, full_name, email, role, status, home_store_id")
            .order("full_name", { ascending: true }),
        ]);

      if (storeErr) throw storeErr;
      if (userErr) throw userErr;

      setStores((storeData ?? []) as StoreRow[]);
      setUsers((userData ?? []) as UserProfile[]);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      setErr(message || "Failed to load users.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const filteredUsers = useMemo(() => {
    const t = filterText.trim().toLowerCase();
    return users.filter((u) => {
      const matchesText =
        !t ||
        u.full_name.toLowerCase().includes(t) ||
        (u.email ?? "").toLowerCase().includes(t);
      const matchesStatus = filterStatus === "all" ? true : u.status === filterStatus;
      return matchesText && matchesStatus;
    });
  }, [users, filterText, filterStatus]);

  const pickUser = (u: UserProfile) => {
    setForm({
      ...emptyForm,
      id: u.id,
      full_name: u.full_name ?? "",
      email: u.email ?? "",
      role: (u.role as UserRole) ?? "Employee",
      status: (u.status as UserStatus) ?? "active",
      home_store_id: u.home_store_id ?? "",
      request_password_reset: true,
    });
  };

  const clear = () => setForm({ ...emptyForm });

  const saveProfileOnly = async () => {
    setErr(null);

    const full_name = form.full_name.trim();
    const email = form.email.trim().toLowerCase();
    const role = form.role;
    const status = form.status;

    const isAdmin = role === "Admin";
    const home_store_id = form.home_store_id ? form.home_store_id : null;

    if (!full_name) return setErr("Full Name is required.");
    if (!email) return setErr("Email is required.");
    if (!isAdmin && !home_store_id) return setErr("Non-admin users must have a Home Store.");

    try {
      // IMPORTANT:
      // Without an Edge Function (service role), we cannot create Supabase Auth users from the browser safely.
      // So this screen currently manages PROFILES ONLY.
      // For now, we generate an id only when editing an existing profile.
      if (!form.id) {
        throw new Error(
          "Auth user creation is not wired yet (Edge Function admin_upsert_user). For now, edit existing users only."
        );
      }

      const payload = {
        id: form.id,
        full_name,
        email,
        role,
        status,
        home_store_id,
      };

      const { error } = await supabase.from("user_profiles").upsert(payload, { onConflict: "id" });
      if (error) throw error;

      await load();
      // Keep selection in place
      setForm((prev) => ({ ...prev, full_name, email, role, status, home_store_id: home_store_id ?? "" }));
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      setErr(message || "Save failed.");
    }
  };

  if (loading) return <div>Loading…</div>;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "360px 1fr", gap: 18 }}>
      <div style={{ border: "1px solid #e5e5e5", borderRadius: 10, padding: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ margin: 0 }}>Users</h2>
          <button onClick={clear}>+ New</button>
        </div>

        <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
          <input
            placeholder="Search name/email…"
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            style={{ padding: 8 }}
          />

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as unknown as UserStatus | 'all')}
            style={{ padding: 8 }}
          >
            <option value="active">active</option>
            <option value="inactive">inactive</option>
            <option value="all">all</option>
          </select>
        </div>

        <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
          {filteredUsers.map((u) => (
            <div
              key={u.id}
              onClick={() => pickUser(u)}
              style={{
                border: "1px solid #eee",
                borderRadius: 10,
                padding: 12,
                cursor: "pointer",
              }}
            >
              <div style={{ fontWeight: 800 }}>{u.full_name}</div>
              <div style={{ color: "#555", fontSize: 13 }}>
                {u.email} • {u.role} • {u.status}
              </div>
            </div>
          ))}
          {filteredUsers.length === 0 ? <div style={{ color: "#666" }}>No users found.</div> : null}
        </div>
      </div>

      <div style={{ border: "1px solid #e5e5e5", borderRadius: 10, padding: 14 }}>
        <h2 style={{ marginTop: 0 }}>{form.id ? "Edit User (Profile)" : "Create User (Not Wired Yet)"}</h2>

        {err ? <div style={{ color: "crimson", marginBottom: 10 }}>{err}</div> : null}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, maxWidth: 820 }}>
          <label>
            <div>Full Name</div>
            <input
              value={form.full_name}
              onChange={(e) => setForm((p) => ({ ...p, full_name: e.target.value }))}
              style={{ width: "100%", padding: 8 }}
            />
          </label>

          <label>
            <div>Email</div>
            <input
              value={form.email}
              onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
              style={{ width: "100%", padding: 8 }}
            />
          </label>

          <label>
            <div>Role</div>
            <select
              value={form.role}
              onChange={(e) => setForm((p) => ({ ...p, role: e.target.value as UserRole }))}
              style={{ width: "100%", padding: 8 }}
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </label>

          <label>
            <div>Status</div>
            <select
              value={form.status}
              onChange={(e) => setForm((p) => ({ ...p, status: e.target.value as UserStatus }))}
              style={{ width: "100%", padding: 8 }}
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>

          <label style={{ gridColumn: "1 / span 2" }}>
            <div>Home Store</div>
            <select
              value={form.home_store_id}
              onChange={(e) => setForm((p) => ({ ...p, home_store_id: e.target.value }))}
              style={{ width: "100%", padding: 8 }}
            >
              <option value="">— None —</option>
              {stores
                .filter((s) => String(s.status).toLowerCase() === "active")
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.store_name} (ACE {s.ace_store_number})
                  </option>
                ))}
            </select>
          </label>

          <label style={{ gridColumn: "1 / span 2", display: "flex", alignItems: "center", gap: 8 }}>
            <input
              type="checkbox"
              checked={form.request_password_reset}
              onChange={(e) => setForm((p) => ({ ...p, request_password_reset: e.target.checked }))}
            />
            <div>
              Force password reset (note: this is not stored yet; real user creation requires Edge Function)
            </div>
          </label>
        </div>

        <div style={{ marginTop: 14, display: "flex", gap: 10 }}>
          <button onClick={() => void saveProfileOnly()}>Save</button>
          <button onClick={clear}>Clear / New</button>
        </div>

        <div style={{ marginTop: 18, borderTop: "1px solid #eee", paddingTop: 12, color: "#555" }}>
          <div style={{ fontWeight: 800, marginBottom: 6 }}>Notes / Rules</div>
          <ul style={{ marginTop: 0 }}>
            <li>Non-admin users must have a Home Store.</li>
            <li>This screen currently manages <b>user_profiles only</b>.</li>
            <li>
              Next step: implement <b>Edge Function admin_upsert_user</b> (service role) so Admin can create Auth users,
              then use the Auth user id as user_profiles.id.
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
