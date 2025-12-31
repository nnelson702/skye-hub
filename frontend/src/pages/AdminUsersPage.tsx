import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../auth/AuthProvider";
import { formatError } from "../lib/errors";
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
  const [notice, setNotice] = useState<string | null>(null);

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

  const auth = useAuth();

  const load = async () => {
    setLoading(true);
    setErr(null);

    try {
      console.log(`AdminUsersPage: fetching stores+users as user=${auth.user?.id ?? null} role=${auth.profile?.role ?? null}`);
      // Load stores and users in parallel; surface exact store errors when present
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
      console.log("AdminUsersPage: fetched stores:", (storeData ?? []).length, "users:", (userData ?? []).length);
    } catch (e: unknown) {
      const message = formatError(e) || "Failed to load users.";
      console.error("AdminUsersPage load error:", e);
      setErr(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Wait for auth and profile readiness
    if (!auth.authReady || !auth.profileReady) return;

    if (!auth.user) {
      setErr("Not signed in.");
      setLoading(false);
      return;
    }

    if (!auth.profile || auth.profile.role !== "Admin") {
      setErr("Not authorized.");
      setLoading(false);
      return;
    }

    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.authReady, auth.profileReady, auth.user, auth.profile?.role]);

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

  const [assignedStoreIds, setAssignedStoreIds] = useState<string[]>([]);
  const [assignLoading, setAssignLoading] = useState(false);

  const loadAssignments = async (userId: string) => {
    if (!userId) return setAssignedStoreIds([]);
    try {
      const { data, error } = await supabase.from("user_store_access").select("store_id").eq("user_id", userId);
      if (error) throw error;
      setAssignedStoreIds((data ?? []).map((r: { store_id: string }) => r.store_id));
    } catch (e: unknown) {
      console.error("loadAssignments error:", e);
      setErr(formatError(e) || "Failed to load assigned stores.");
    }
  };

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
    void loadAssignments(u.id);
  };

  const clear = () => {
    setForm({ ...emptyForm });
    setAssignedStoreIds([]);
  };

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
      if (!auth.user) return setErr("Not signed in.");
      if (!auth.profile || auth.profile.role !== "Admin") return setErr("Not authorized.");

      // If no id -> create a new Auth user via Edge Function and upsert profile
      if (!form.id) {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
        const token = auth.session?.access_token;
        if (!token) return setErr("Not signed in.");

        console.log(`AdminUsersPage: invoking admin_upsert_user for email=${email}`);
        const resp = await fetch(`${supabaseUrl}/functions/v1/admin_upsert_user`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ email, full_name, role, status, home_store_id }),
        });

        const json = await resp.json().catch(() => ({}));
        if (!resp.ok) {
          // Provide actionable errors
          if (resp.status === 404) {
            setErr("admin_upsert_user function not found / not deployed (404). Deploy the function or check its name.");
          } else if (resp.status === 401) {
            setErr("Unauthorized: invalid or missing token when calling admin_upsert_user.");
          } else if (resp.status === 403) {
            setErr("Forbidden: caller is not authorized to create users (ensure you are an Admin and function allows calls).");
          } else {
            setErr(formatError(json) || `admin_upsert_user failed with status ${resp.status}`);
          }
          console.log(`AdminUsersPage: admin_upsert_user done ok=false status=${resp.status}`);
          return;
        }

        const newUserId = json?.id;
        if (!newUserId) {
          setErr("No user id returned from admin_upsert_user.");
          console.log("AdminUsersPage: admin_upsert_user done ok=false missing id");
          return;
        }

        // Refresh and select the newly created user
        await load();
        const created = (users ?? []).find((u) => u.id === newUserId);
        if (created) {
          pickUser(created);
        }

        // Show a short-lived notice with temp password
        if (json?.tempPassword) setNotice(`User created. Temp password: ${json.tempPassword}`);
        console.log(`AdminUsersPage: admin_upsert_user done ok=true id=${newUserId}`);
        return;
      }

      const payload = {
        id: form.id,
        full_name,
        email,
        role,
        status,
        home_store_id,
        must_reset_password: form.request_password_reset ? true : false,
      };

      console.log(`AdminUsersPage: saving profile id=${form.id || '<new>'} home_store_id=${payload.home_store_id} must_reset=${payload.must_reset_password}`);

      const { error } = await supabase.from("user_profiles").upsert(payload, { onConflict: "id" });
      if (error) throw error;

      await load();
      // Keep selection in place
      setForm((prev) => ({ ...prev, full_name, email, role, status, home_store_id: home_store_id ?? "" }));
      // reload assignments if this user's id present
      if (form.id) await loadAssignments(form.id);
      console.log("AdminUsersPage: save complete ok=true");
    } catch (e: unknown) {
      const message = formatError(e) || "Save failed.";
      console.error("AdminUsersPage save error:", e);
      setErr(message);
      console.log("AdminUsersPage: save complete ok=false");
    }
  };

  const addAssignment = async (storeId: string) => {
    if (!auth.user) return setErr("Not signed in.");
    if (!auth.profile || auth.profile.role !== "Admin") return setErr("Not authorized.");
    if (!form.id) return setErr("Select a user first.");

    console.log(`AdminUsersPage: addAssignment user=${form.id} store=${storeId}`);
    setAssignLoading(true);
    setErr(null);
    try {
      const payload = {
        user_id: form.id,
        store_id: storeId,
        assigned_by: auth.user.id,
      };
      const { error } = await supabase.from("user_store_access").insert(payload).select();
      if (error) throw error;
      await loadAssignments(form.id);
      console.log(`AdminUsersPage: addAssignment done ok=true`);
    } catch (e: unknown) {
      console.error("addAssignment error:", e);
      setErr(formatError(e) || "Failed to add store assignment.");
      console.log(`AdminUsersPage: addAssignment done ok=false`);
    } finally {
      setAssignLoading(false);
    }
  };

  const removeAssignment = async (storeId: string) => {
    if (!auth.user) return setErr("Not signed in.");
    if (!auth.profile || auth.profile.role !== "Admin") return setErr("Not authorized.");
    if (!form.id) return setErr("Select a user first.");

    console.log(`AdminUsersPage: removeAssignment user=${form.id} store=${storeId}`);
    setAssignLoading(true);
    setErr(null);
    try {
      const { error } = await supabase.from("user_store_access").delete().match({ user_id: form.id, store_id: storeId });
      if (error) throw error;
      await loadAssignments(form.id);
      console.log(`AdminUsersPage: removeAssignment done ok=true`);
    } catch (e: unknown) {
      console.error("removeAssignment error:", e);
      setErr(formatError(e) || "Failed to remove store assignment.");
      console.log(`AdminUsersPage: removeAssignment done ok=false`);
    } finally {
      setAssignLoading(false);
    }
  };

  // Show loading indicator while initial load is running
  if (loading) return <div>Loading…</div>;

  // UI
  return (
    <div style={{ display: "grid", gridTemplateColumns: "360px 1fr", gap: 18 }}>
      <div>
        <div style={{ marginBottom: 8, display: "flex", gap: 8 }}>
          <input
            placeholder="Filter by name or email"
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            style={{ flex: 1, padding: 8 }}
          />
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as UserStatus | "all")} style={{ padding: 8 }}>
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>

        <div style={{ border: "1px solid #e5e5e5", borderRadius: 10, padding: 12 }}>
          {filteredUsers.map((u) => (
            <div
              key={u.id}
              style={{
                padding: 8,
                borderRadius: 8,
                cursor: "pointer",
                marginBottom: 6,
                border: form.id === u.id ? "1px solid #000" : "1px solid transparent",
              }}
              onClick={() => pickUser(u)}
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
        {notice ? <div style={{ color: "green", marginBottom: 10 }}>{notice}</div> : null}

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
              {stores.length === 0 ? (
                <option value="" disabled>
                  (no stores available)
                </option>
              ) : (
                stores
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.store_name} {s.status !== "active" ? "(inactive)" : ""} (ACE {s.ace_store_number})
                    </option>
                  ))
              )}
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

        <div style={{ marginTop: 12, borderTop: "1px solid #eee", paddingTop: 12 }}>
          <div style={{ fontWeight: 800, marginBottom: 6 }}>Assigned Stores</div>
          {form.id ? (
            <>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <select id="assign-store" style={{ padding: 8 }}>
                  <option value="">— select store —</option>
                  {stores
                    .filter((s) => s.status === "active" && !assignedStoreIds.includes(s.id))
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.store_name} (ACE {s.ace_store_number})
                      </option>
                    ))}
                </select>
                <button
                  onClick={() => {
                    const sel = (document.getElementById("assign-store") as HTMLSelectElement).value;
                    if (sel) void addAssignment(sel);
                  }}
                  disabled={assignLoading}
                >
                  Add
                </button>
              </div>

              <div style={{ marginTop: 8 }}>
                {assignedStoreIds.length === 0 ? (
                  <div style={{ color: "#666" }}>No assigned stores.</div>
                ) : (
                  <div style={{ display: "grid", gap: 8 }}>
                    {assignedStoreIds.map((sid) => {
                      const s = stores.find((x) => x.id === sid);
                      return (
                        <div key={sid} style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                          <div>{s ? `${s.store_name} (ACE ${s.ace_store_number})` : sid}</div>
                          <button onClick={() => void removeAssignment(sid)} disabled={assignLoading}>
                            Remove
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div style={{ color: "#666" }}>Select a user to manage store access.</div>
          )}
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
