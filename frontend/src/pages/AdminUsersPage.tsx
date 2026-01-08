// Fixed: Added user selection, store access sync, edge function wiring for create/edit/reset
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import type { UserProfile, UserRole, UserStatus } from "../types/profile";

type StoreRow = {
  id: string;
  ace_store_number: string;
  store_name: string;
  status?: string | null;
};

function formatError(err: unknown) {
  if (!err) return "";
  if (typeof err === "string") return err;
  if (err && typeof err === "object" && "message" in err) return String(err.message);
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

export default function AdminUsersPage() {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string>("");

  const [stores, setStores] = useState<StoreRow[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);

  const [filter, setFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<"active" | "inactive" | "all">("active");

  // Selected user state
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  // Form state
  const [formId, setFormId] = useState<string>("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<UserRole>("Employee");
  const [status, setStatus] = useState<UserStatus>("active");
  const [homeStoreId, setHomeStoreId] = useState<string | null>(null);
  const [mustResetPassword, setMustResetPassword] = useState(false);

  const [sendInviteEmail, setSendInviteEmail] = useState(true);
  const [tempPassword, setTempPassword] = useState("");

  // Store access state
  const [storeAccessIds, setStoreAccessIds] = useState<Set<string>>(new Set());
  const [initialStoreAccessIds, setInitialStoreAccessIds] = useState<Set<string>>(new Set());

  // Result display state
  const [lastResetLink, setLastResetLink] = useState<string>("");
  const [lastTempPassword, setLastTempPassword] = useState<string>("");

  const filteredUsers = useMemo(() => {
    const f = filter.trim().toLowerCase();
    return users.filter((u) => {
      const matchesText =
        !f ||
        (u.full_name ?? "").toLowerCase().includes(f) ||
        (u.email ?? "").toLowerCase().includes(f);

      const matchesStatus =
        statusFilter === "all" ? true : (u.status ?? "").toLowerCase() === statusFilter;

      return matchesText && matchesStatus;
    });
  }, [users, filter, statusFilter]);

  async function refreshUsersAndStores() {
    setErr("");
    setLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const uid = sessionData?.session?.user?.id;

      // Stores
      const { data: storesData, error: storesErr } = await supabase
        .from("stores")
        .select("id, ace_store_number, store_name, status")
        .order("store_name", { ascending: true });

      if (storesErr) throw storesErr;
      setStores((storesData ?? []) as StoreRow[]);

      // Users
      const { data: usersData, error: usersErr } = await supabase
        .from("user_profiles")
        .select("id, full_name, email, role, status, home_store_id, must_reset_password")
        .order("full_name", { ascending: true });

      if (usersErr) throw usersErr;

      console.log(
        `AdminUsersPage: fetched stores=${(storesData ?? []).length} users=${(usersData ?? []).length} as user=${uid}`
      );

      setUsers((usersData ?? []) as UserProfile[]);
    } catch (e: unknown) {
      console.error("AdminUsersPage refresh error:", e);
      setErr(formatError(e));
    } finally {
      setLoading(false);
    }
  }

  // Load selected user profile and store access
  async function loadUserForEdit(userId: string) {
    setErr("");
    setLoading(true);
    try {
      // Load profile
      const { data: profileData, error: profileErr } = await supabase
        .from("user_profiles")
        .select("*")
        .eq("id", userId)
        .single();

      if (profileErr) throw profileErr;

      const profile = profileData as UserProfile;
      setFormId(profile.id);
      setFullName(profile.full_name ?? "");
      setEmail(profile.email ?? "");
      setRole(profile.role as UserRole);
      setStatus(profile.status as UserStatus);
      setHomeStoreId(profile.home_store_id ?? null);
      setMustResetPassword(profile.must_reset_password ?? false);

      // Load store access
      const { data: accessData, error: accessErr } = await supabase
        .from("user_store_access")
        .select("store_id")
        .eq("user_id", userId);

      if (accessErr) throw accessErr;

      const accessSet = new Set<string>((accessData ?? []).map((r) => r.store_id));
      setStoreAccessIds(accessSet);
      setInitialStoreAccessIds(new Set(accessSet));

      setLastResetLink("");
      setLastTempPassword("");
    } catch (e: unknown) {
      console.error("AdminUsersPage loadUserForEdit error:", e);
      setErr(formatError(e));
    } finally {
      setLoading(false);
    }
  }

  // Clear form for new user
  function clearForm() {
    setSelectedUserId(null);
    setFormId("");
    setFullName("");
    setEmail("");
    setRole("Employee");
    setStatus("active");
    setHomeStoreId(null);
    setMustResetPassword(false);
    setSendInviteEmail(true);
    setTempPassword("");
    setStoreAccessIds(new Set());
    setInitialStoreAccessIds(new Set());
    setLastResetLink("");
    setLastTempPassword("");
    setErr("");
  }

  useEffect(() => {
    refreshUsersAndStores();
  }, []);

  // When user selects a user from the list
  function handleUserClick(userId: string) {
    setSelectedUserId(userId);
    loadUserForEdit(userId);
  }

  function generatePassword() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
    let out = "";
    for (let i = 0; i < 12; i++) out += chars[Math.floor(Math.random() * chars.length)];
    out += "!A1";
    setTempPassword(out);
  }

  // Sync store access (insert new, delete removed)
  async function syncStoreAccess(userId: string) {
    const toAdd = Array.from(storeAccessIds).filter((id) => !initialStoreAccessIds.has(id));
    const toRemove = Array.from(initialStoreAccessIds).filter((id) => !storeAccessIds.has(id));

    const { data: sessionData } = await supabase.auth.getSession();
    const adminId = sessionData?.session?.user?.id;

    if (toAdd.length > 0) {
      const inserts = toAdd.map((store_id) => ({
        user_id: userId,
        store_id,
        assigned_by: adminId,
      }));
      const { error: insErr } = await supabase.from("user_store_access").insert(inserts);
      if (insErr) throw insErr;
    }

    if (toRemove.length > 0) {
      const { error: delErr } = await supabase
        .from("user_store_access")
        .delete()
        .eq("user_id", userId)
        .in("store_id", toRemove);
      if (delErr) throw delErr;
    }

    setInitialStoreAccessIds(new Set(storeAccessIds));
  }

  async function handleSave() {
    setErr("");
    setLastResetLink("");
    setLastTempPassword("");

    if (!fullName.trim() || !email.trim()) {
      setErr("Full Name and Email are required.");
      return;
    }

    setLoading(true);

    try {
      // NEW USER: call edge function
      if (!formId) {
        const { data: sessionData, error: sessionErr } = await supabase.auth.getSession();
        if (sessionErr) throw sessionErr;

        const token = sessionData?.session?.access_token;
        if (!token) {
          setErr("No session token found. You must be signed in.");
          setLoading(false);
          return;
        }

        const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
        if (!anonKey) {
          setErr("Missing VITE_SUPABASE_ANON_KEY.");
          setLoading(false);
          return;
        }

        const payload = {
          email: email.trim(),
          full_name: fullName.trim(),
          role,
          status,
          home_store_id: homeStoreId,
          must_reset_password: mustResetPassword,
          invite: sendInviteEmail,
          tempPassword: tempPassword || undefined,
          redirectTo: `${window.location.origin}/reset-password`,
        };

        console.log("AdminUsersPage: calling admin_create_user payload=", payload);

        const resp = await fetch(
          "https://olbyttpwpovkvudtdoyc.supabase.co/functions/v1/admin_create_user",
          {
            method: "POST",
            headers: {
              apikey: anonKey,
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
          }
        );

        const text = await resp.text();
        let json: { id?: string; resetLink?: string; tempPassword?: string } | null = null;
        try {
          json = text ? JSON.parse(text) : null;
        } catch {
          json = null;
        }

        console.log(`AdminUsersPage: admin_create_user status=${resp.status}`, json);

        if (!resp.ok) {
          if (resp.status === 401) {
            setErr("Unauthorized (check apikey or session).");
          } else if (resp.status === 403) {
            setErr("Forbidden: caller is not Admin.");
          } else if (resp.status === 409) {
            setErr("Email already exists. Use Send Password Reset for existing users.");
          } else {
            setErr(formatError(json) || `admin_create_user failed with status ${resp.status}`);
          }
          setLoading(false);
          return;
        }

        const newUserId = json?.id;
        if (!newUserId) {
          setErr("No user id returned from admin_create_user.");
          setLoading(false);
          return;
        }

        setLastResetLink(json?.resetLink ?? "");
        setLastTempPassword(json?.tempPassword ?? "");

        // Refresh list and select new user
        await refreshUsersAndStores();
        setSelectedUserId(newUserId);
        await loadUserForEdit(newUserId);

        // Sync store access if any selected
        if (storeAccessIds.size > 0) {
          await syncStoreAccess(newUserId);
        }
      } else {
        // EXISTING USER: upsert profile
        const { error: upsertErr } = await supabase
          .from("user_profiles")
          .upsert({
            id: formId,
            full_name: fullName.trim(),
            email: email.trim(),
            role,
            status,
            home_store_id: homeStoreId,
            must_reset_password: mustResetPassword,
          });

        if (upsertErr) throw upsertErr;

        // Sync store access
        await syncStoreAccess(formId);

        // Refresh list and keep selection
        await refreshUsersAndStores();
        setSelectedUserId(formId);
      }
    } catch (e: unknown) {
      console.error("AdminUsersPage save error:", e);
      setErr(formatError(e));
    } finally {
      setLoading(false);
    }
  }

  async function handleSendReset() {
    if (!formId || !email) {
      setErr("Select a user first.");
      return;
    }

    setErr("");
    setLastResetLink("");
    setLoading(true);

    try {
      const { data: sessionData, error: sessionErr } = await supabase.auth.getSession();
      if (sessionErr) throw sessionErr;

      const token = sessionData?.session?.access_token;
      if (!token) {
        setErr("No session token found.");
        setLoading(false);
        return;
      }

      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
      if (!anonKey) {
        setErr("Missing VITE_SUPABASE_ANON_KEY.");
        setLoading(false);
        return;
      }

      const payload = {
        mode: "reset",
        email: email.trim(),
        redirectTo: `${window.location.origin}/reset-password`,
      };

      const resp = await fetch(
        "https://olbyttpwpovkvudtdoyc.supabase.co/functions/v1/admin_create_user",
        {
          method: "POST",
          headers: {
            apikey: anonKey,
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        }
      );

      const text = await resp.text();
      let json: { resetLink?: string } | null = null;
      try {
        json = text ? JSON.parse(text) : null;
      } catch {
        json = null;
      }

      if (!resp.ok) {
        setErr(formatError(json) || `Reset failed with status ${resp.status}`);
        setLoading(false);
        return;
      }

      setLastResetLink(json?.resetLink ?? "");
    } catch (e: unknown) {
      console.error("AdminUsersPage reset error:", e);
      setErr(formatError(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 12 }}>
        <h2 style={{ margin: 0 }}>Admin — Users</h2>
        {loading ? <span>Loading…</span> : null}
        {err ? <span style={{ color: "crimson" }}>{err}</span> : null}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 16 }}>
        {/* Left list */}
        <div style={{ border: "1px solid #ddd", padding: 12 }}>

          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            <input
              style={{ flex: 1 }}
              placeholder="Filter by name or email"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as "active" | "inactive" | "all")}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="all">All</option>
            </select>
          </div>

          {filteredUsers.map((u) => (
            <div
              key={u.id}
              onClick={() => handleUserClick(u.id)}
              style={{
                marginBottom: 12,
                cursor: "pointer",
                padding: 8,
                border: selectedUserId === u.id ? "2px solid #0066cc" : "1px solid transparent",
                borderRadius: 4,
                background: selectedUserId === u.id ? "#f0f8ff" : undefined,
              }}
            >
              <div style={{ fontWeight: 700 }}>{u.full_name || "(no name)"}</div>
              <div style={{ fontSize: 13, color: "#555" }}>
                {u.email || "(no email)"} • {u.role || "?"} • {u.status || "?"}
              </div>
            </div>
          ))}
        </div>

        {/* Right form */}
        <div style={{ border: "1px solid #ddd", padding: 12 }}>
          <h3>{formId ? "Edit User" : "Create User (Pre-provision)"}</h3>

          {lastResetLink && (
            <div style={{ background: "#f0fff0", padding: 8, marginBottom: 12, borderRadius: 4 }}>
              <div style={{ fontWeight: 700 }}>Reset Link:</div>
              <a href={lastResetLink} target="_blank" rel="noreferrer">
                {lastResetLink}
              </a>
            </div>
          )}

          {lastTempPassword && (
            <div style={{ background: "#fff8f0", padding: 8, marginBottom: 12, borderRadius: 4 }}>
              <div style={{ fontWeight: 700 }}>Temporary Password:</div>
              <code>{lastTempPassword}</code>
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <div>Full Name</div>
              <input value={fullName} onChange={(e) => setFullName(e.target.value)} style={{ width: "100%" }} />
            </div>
            <div>
              <div>Email</div>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{ width: "100%" }}
                disabled={!!formId}
              />
            </div>

            <div>
              <div>Role</div>
              <select value={role} onChange={(e) => setRole(e.target.value as UserRole)} style={{ width: "100%" }}>
                <option value="Employee">Employee</option>
                <option value="Manager">Manager</option>
                <option value="Lead">Lead</option>
                <option value="Admin">Admin</option>
              </select>
            </div>

            <div>
              <div>Status</div>
              <select value={status} onChange={(e) => setStatus(e.target.value as UserStatus)} style={{ width: "100%" }}>
                <option value="active">active</option>
                <option value="inactive">inactive</option>
                <option value="deleted">deleted</option>
              </select>
            </div>

            <div style={{ gridColumn: "1 / span 2" }}>
              <div>Home Store</div>
              <select
                value={homeStoreId ?? ""}
                onChange={(e) => setHomeStoreId(e.target.value || null)}
                style={{ width: "100%" }}
              >
                <option value="">— None —</option>
                {stores.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.store_name} (ACE {s.ace_store_number})
                    {s.status !== "active" ? " (inactive)" : ""}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ marginTop: 12 }}>
            <label style={{ display: "block" }}>
              <input
                type="checkbox"
                checked={mustResetPassword}
                onChange={(e) => setMustResetPassword(e.target.checked)}
              />{" "}
              Force password reset
            </label>

            {!formId && (
              <>
                <label style={{ display: "block" }}>
                  <input
                    type="checkbox"
                    checked={sendInviteEmail}
                    onChange={(e) => setSendInviteEmail(e.target.checked)}
                  />{" "}
                  Send invite email (recommended)
                </label>

                <div style={{ marginTop: 8 }}>
                  <div>Temporary Password (optional)</div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input value={tempPassword} onChange={(e) => setTempPassword(e.target.value)} style={{ flex: 1 }} />
                    <button type="button" onClick={generatePassword}>
                      Generate
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

          <div style={{ marginTop: 12 }}>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>Store Access</div>
            {!formId ? (
              <div style={{ color: "#555" }}>Create the user first, then assign store access.</div>
            ) : (
              <>
                {stores.map((s) => (
                  <label key={s.id} style={{ display: "block", marginBottom: 4 }}>
                    <input
                      type="checkbox"
                      checked={storeAccessIds.has(s.id)}
                      onChange={(e) => {
                        const newSet = new Set(storeAccessIds);
                        if (e.target.checked) {
                          newSet.add(s.id);
                        } else {
                          newSet.delete(s.id);
                        }
                        setStoreAccessIds(newSet);
                      }}
                    />{" "}
                    {s.store_name} (ACE {s.ace_store_number})
                    {s.status !== "active" ? " (inactive)" : ""}
                  </label>
                ))}
              </>
            )}
          </div>

          <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
            <button type="button" onClick={handleSave} disabled={loading}>
              Save
            </button>
            <button type="button" onClick={clearForm} disabled={loading}>
              Clear
            </button>
            {formId && (
              <button type="button" onClick={handleSendReset} disabled={loading}>
                Send Password Reset
              </button>
            )}
            <button type="button" onClick={refreshUsersAndStores} disabled={loading}>
              Refresh
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
