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
  email?: string | null;
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
      // NOTE: we store `must_reset_password` on the profile so Admins can require a password reset.
      // This UI pre-provisions profiles only (no Auth user creation).
      must_reset_password: false,
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
            .select("id, full_name, email, role, status, home_store_id, must_reset_password")
            .order("full_name", { ascending: true }),
        ]);

      if (storeErr) throw storeErr;
      if (userErr) throw userErr;

      // Normalize stores in case server uses legacy `store_email` column
      const normalizedStores = (storeData ?? []).map((r: Partial<StoreRow> & { store_email?: string }) => ({ ...r, email: r.email ?? r.store_email ?? null })) as StoreRow[];
      const hadLegacy = (storeData ?? []).some((r: Partial<StoreRow> & { store_email?: string }) => r.store_email !== undefined);
      if (hadLegacy) console.warn("AdminUsersPage: normalized legacy column `store_email` to `email`");
      setStores(normalizedStores);
      setUsers((userData ?? []) as UserProfile[]);
      console.log("AdminUsersPage: fetched stores:", normalizedStores.length, "users:", (userData ?? []).length);
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

  // Assignment state for inline checklist
  const [initialAssignedStoreIds, setInitialAssignedStoreIds] = useState<string[]>([]);
  const [selectedStoreIds, setSelectedStoreIds] = useState<string[]>([]);

  const loadAssignments = async (userId: string) => {
    if (!userId) {
      setInitialAssignedStoreIds([]);
      setSelectedStoreIds([]);
      return;
    }
    try {
      const { data, error } = await supabase.from("user_store_access").select("store_id").eq("user_id", userId);
      if (error) throw error;
      const ids = (data ?? []).map((r: { store_id: string }) => r.store_id);
      setInitialAssignedStoreIds(ids);
      setSelectedStoreIds(ids);
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
      must_reset_password: u.must_reset_password ?? false,
    });
    void loadAssignments(u.id);
  };

  const clear = () => {
    setForm({ ...emptyForm });
    setInitialAssignedStoreIds([]);
    setSelectedStoreIds([]);
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

      // If no id -> PRE-PROVISION a profile row (no Auth user is created from the browser)
      if (!form.id) {
        const winCrypto = (globalThis as unknown) as { crypto?: Crypto & { randomUUID?: () => string } };
        const newId = winCrypto.crypto?.randomUUID?.() ?? `preprov-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        const insertPayload = {
          id: newId,
          full_name,
          email,
          role,
          status,
          home_store_id,
          must_reset_password: form.must_reset_password ? true : false,
        };

        console.log(`AdminUsersPage: pre-provision profile id=${newId} email=${email}`);
        const { data: insertData, error: insertErr } = await supabase.from("user_profiles").insert(insertPayload).select();
        if (insertErr) {
          throw insertErr;
        }

        await load();
        const created = (insertData ?? [])[0] ?? (users ?? []).find((u) => u.id === newId);
        if (created) pickUser(created as UserProfile);

        setNotice("User pre-provisioned. User must sign up/login with this email to activate access.");
        console.log(`AdminUsersPage: pre-provision done ok=true id=${newId}`);
        return;
      }

      const payload = {
        id: form.id,
        full_name,
        email,
        role,
        status,
        home_store_id,
        must_reset_password: form.must_reset_password ? true : false,
      };

      console.log(`AdminUsersPage: saving profile id=${form.id || '<new>'} home_store_id=${payload.home_store_id} must_reset=${payload.must_reset_password}`);

      // Upsert profile
      const { error } = await supabase.from("user_profiles").upsert(payload, { onConflict: "id" });
      if (error) throw error;

      // If this was a new (pre-provision) profile, ensure we have an id to operate on
      const profileId = form.id || payload.id;

      // Apply assignment diffs (inserts/deletes)
      const applyAssignmentDiff = async (userId: string) => {
          const prev = initialAssignedStoreIds ?? [];
          const now = selectedStoreIds ?? [];
          const toAdd = now.filter((x) => !prev.includes(x));
          const toRemove = prev.filter((x) => !now.includes(x));

          const adminId = auth.user?.id;
          if (!adminId) throw new Error("Not signed in.");

          if (toAdd.length) {
            const inserts = toAdd.map((store_id) => ({ user_id: userId, store_id, assigned_by: adminId }));
            const { error: insErr } = await supabase.from("user_store_access").insert(inserts).select();
            if (insErr) throw insErr;
          }

          if (toRemove.length) {
            const { error: delErr } = await supabase.from("user_store_access").delete().in("store_id", toRemove).eq("user_id", userId);
            if (delErr) throw delErr;
          }

          // refresh assignments
          await loadAssignments(userId);
      };

      // If we created a pre-provisioned profile (no form.id before), ensure we select it and then apply assignments
      if (!form.id) {
        await load();
        const created = (users ?? []).find((u) => u.id === profileId);
        if (created) pickUser(created);
        // apply selected assignments (initialAssignedStoreIds will be [])
        if (selectedStoreIds && selectedStoreIds.length) {
          await applyAssignmentDiff(profileId);
        }
      } else {
        // Existing user: reload and apply diffs
        await load();
        await applyAssignmentDiff(profileId);
        // Keep selection in place
        setForm((prev) => ({ ...prev, full_name, email, role, status, home_store_id: home_store_id ?? "" }));
      }

      console.log("AdminUsersPage: save complete ok=true");
    } catch (e: unknown) {
      const message = formatError(e) || "Save failed.";
      console.error("AdminUsersPage save error:", e);
      setErr(message);
      console.log("AdminUsersPage: save complete ok=false");
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
        <h2 style={{ marginTop: 0 }}>{form.id ? "Edit User (Profile)" : "Create User (Pre-provision)"}</h2>

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
              checked={form.must_reset_password}
              onChange={(e) => setForm((p) => ({ ...p, must_reset_password: e.target.checked }))}
            />
            <div>
              Force password reset (sets <code>must_reset_password</code> on the profile; user must sign up/login to activate account)
            </div>
          </label>
        </div>

        <div style={{ marginTop: 14, display: "flex", gap: 10 }}>
          <button onClick={() => void saveProfileOnly()}>Save</button>
          <button onClick={clear}>Clear / New</button>
        </div>

        <div style={{ marginTop: 12, borderTop: "1px solid #eee", paddingTop: 12 }}>
          <div style={{ fontWeight: 800, marginBottom: 6 }}>Store Access</div>

          {stores.length === 0 ? (
            <div style={{ color: "#666" }}>(no stores available)</div>
          ) : (
            <div style={{ display: "grid", gap: 6 }}>
              {stores.map((s) => {
                const disabled = !form.id; // disable until profile exists
                const checked = selectedStoreIds.includes(s.id);
                return (
                  <label key={s.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <input
                      type="checkbox"
                      disabled={disabled}
                      checked={checked}
                      onChange={() => {
                        if (disabled) return;
                        setSelectedStoreIds((prev) => (prev.includes(s.id) ? prev.filter((x) => x !== s.id) : [...prev, s.id]));
                      }}
                    />
                    <div>
                      {s.store_name} {s.status !== "active" ? "(inactive)" : ""} (ACE {s.ace_store_number})
                    </div>
                  </label>
                );
              })}

              {!form.id ? (
                <div style={{ color: "#666" }}>Create the user first, then assign store access.</div>
              ) : null}
            </div>
          )}
        </div>

        <div style={{ marginTop: 18, borderTop: "1px solid #eee", paddingTop: 12, color: "#555" }}>
          <div style={{ fontWeight: 800, marginBottom: 6 }}>Notes / Rules</div>
          <ul style={{ marginTop: 0 }}>
            <li>Non-admin users must have a Home Store.</li>
            <li>This screen currently manages <b>user_profiles only</b>.</li>
            <li>
              This screen pre-provisions <b>user_profiles</b> only; Admins can create profiles here and optionally run a backend job to link an Auth user later. Users must sign up/login with the email to activate access.
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
