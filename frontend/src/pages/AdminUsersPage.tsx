import { useEffect, useState, type ChangeEvent } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../auth/AuthProvider";
import { formatError } from "../lib/errors";
import { showSuccess, showError, generateCorrelationId } from "../lib/toast";
import type { UserProfile, UserStatus, UserRole } from "../types/profile";

// Get anon key for edge function calls (required by Supabase gateway)
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

type StoreRow = {
  id: string;
  store_name: string;
  ace_store_number: string | null;
  status: UserStatus;
};

type ProfileWithExtras = UserProfile & {
  home_store_id?: string | null;
  must_reset_password?: boolean | null;
};

type LocalUserForm = {
  id?: string;
  full_name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  home_store_id: string | null;
  must_reset_password: boolean;
};

const EMPTY_FORM: LocalUserForm = {
  full_name: "",
  email: "",
  role: "Employee" as UserRole,
  status: "active",
  home_store_id: null,
  must_reset_password: false,
};

export default function AdminUsersPage() {
  const auth = useAuth();

  const [users, setUsers] = useState<UserProfile[]>([]);
  const [stores, setStores] = useState<StoreRow[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [form, setForm] = useState<LocalUserForm>(EMPTY_FORM);
  const [assignedStores, setAssignedStores] = useState<Set<string>>(new Set());
  const [initialAssignedStores, setInitialAssignedStores] = useState<Set<string>>(new Set());
  const [inviteChecked, setInviteChecked] = useState(true);
  const [tempPassword, setTempPassword] = useState("");
  const [lastInviteLink, setLastInviteLink] = useState<string | null>(null);
  const [lastTempPassword, setLastTempPassword] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // ---------- Data loading helpers ----------

  async function loadUsers() {
    const { data, error } = await supabase
      .from("user_profiles")
      .select("*")
      .order("full_name");

    if (error) {
      setErr(formatError(error) || "Failed to load users.");
      return;
    }
    setUsers((data ?? []) as UserProfile[]);
  }

  async function loadStores() {
    const { data, error } = await supabase
      .from("stores")
      .select("id, store_name, ace_store_number, status")
      .order("store_name");

    if (error) {
      setErr(formatError(error) || "Failed to load stores.");
      return;
    }
    setStores((data ?? []) as StoreRow[]);
  }

  async function loadUserDetail(userId: string) {
    setErr(null);
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("user_profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle();

      if (error) {
        setErr(formatError(error) || "Failed to load user profile.");
      } else if (data) {
        const row = data as ProfileWithExtras;
        setForm({
          id: row.id,
          full_name: row.full_name ?? "",
          email: row.email ?? "",
          role: row.role as UserRole,
          status: row.status as UserStatus,
          home_store_id: row.home_store_id ?? null,
          must_reset_password: !!row.must_reset_password,
        });
      } else {
        setErr("User not found.");
      }

      const { data: accessRows, error: accessErr } = await supabase
        .from("user_store_access")
        .select("store_id")
        .eq("user_id", userId);

      if (accessErr) {
        setErr(formatError(accessErr) || "Failed to load store access.");
      } else {
        const ids = new Set<string>(
          (accessRows ?? []).map((r: { store_id: string }) => r.store_id)
        );
        setAssignedStores(ids);
        setInitialAssignedStores(new Set(ids));
      }
    } finally {
      setLoading(false);
    }
  }

  // ---------- Effects ----------

  useEffect(() => {
    void loadUsers();
    void loadStores();
  }, []);

  useEffect(() => {
    if (!selectedUserId) {
      // New user mode
      setForm(EMPTY_FORM);
      setAssignedStores(new Set());
      setInitialAssignedStores(new Set());
      setLastInviteLink(null);
      setLastTempPassword(null);
      setErr(null);
      return;
    }
    void loadUserDetail(selectedUserId);
  }, [selectedUserId]);

  // ---------- Form handlers ----------

  function handleFieldChange(
    e: ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) {
    const target = e.target;
    const { name, value, type } = target;
    const checked = (target as HTMLInputElement).checked;
    setForm((prev) => {
      if (type === "checkbox") {
        return { ...prev, [name]: checked } as LocalUserForm;
      }
      return { ...prev, [name]: value } as LocalUserForm;
    });
  }

  function toggleStore(storeId: string) {
    setAssignedStores((prev) => {
      const next = new Set(prev);
      if (next.has(storeId)) {
        next.delete(storeId);
      } else {
        next.add(storeId);
      }
      return next;
    });
  }

  function handleClear() {
    setSelectedUserId(null);
    setForm(EMPTY_FORM);
    setAssignedStores(new Set());
    setInitialAssignedStores(new Set());
    setInviteChecked(true);
    setTempPassword("");
    setLastInviteLink(null);
    setLastTempPassword(null);
    setErr(null);
  }

  function generateTempPassword() {
    const rand = Math.random().toString(36).slice(-10);
    setTempPassword(rand.toUpperCase());
  }

  // ---------- Store access sync ----------

  async function syncStoreAccess(
    userId: string,
    initial: Set<string>,
    current: Set<string>
  ) {
    const toAdd = [...current].filter((id) => !initial.has(id));
    const toRemove = [...initial].filter((id) => !current.has(id));

    if (!toAdd.length && !toRemove.length) return;

    const adminId = auth.profile?.id ?? null;

    if (toAdd.length) {
      const rows = toAdd.map((store_id) => ({
        user_id: userId,
        store_id,
        assigned_by: adminId,
      }));
      const { error } = await supabase.from("user_store_access").insert(rows);
      if (error) {
        setErr(formatError(error) || "Failed to add store access.");
        return;
      }
    }

    if (toRemove.length) {
      const { error } = await supabase
        .from("user_store_access")
        .delete()
        .eq("user_id", userId)
        .in("store_id", toRemove);
      if (error) {
        setErr(formatError(error) || "Failed to remove store access.");
      }
    }

    setInitialAssignedStores(new Set(current));
  }

  // ---------- Save / reset actions ----------

  async function handleSave() {
    setErr(null);
    setLastInviteLink(null);
    setLastTempPassword(null);

    if (!form.full_name || !form.email) {
      setErr("Full name and email are required.");
      return;
    }
    if (!form.role) {
      setErr("Role is required.");
      return;
    }
    if (!form.status) {
      setErr("Status is required.");
      return;
    }
    if (form.role !== "Admin" && !form.home_store_id) {
      setErr("Non-admin users must have a home store.");
      return;
    }

    setLoading(true);
    try {
      if (!form.id) {
        // NEW USER: use Edge Function
        const { data: sessionData, error: sessionErr } =
          await supabase.auth.getSession();
        if (sessionErr || !sessionData?.session?.access_token) {
          setErr("Not authenticated.");
          return;
        }
        const token = sessionData.session.access_token;

        const body = {
          email: form.email,
          full_name: form.full_name,
          role: form.role,
          status: form.status,
          home_store_id: form.home_store_id,
          must_reset_password: form.must_reset_password,
          invite: inviteChecked,
          tempPassword: tempPassword || undefined,
          redirectTo: `${window.location.origin}/reset-password`,
        };

        const correlationId = generateCorrelationId();
        console.log(`[AdminUsersPage] Creating user (correlation: ${correlationId}):`, body);

        const res = await fetch(
          "https://olbyttpwpovkvudtdoyc.supabase.co/functions/v1/admin_create_user",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              apikey: SUPABASE_ANON_KEY,
              "Content-Type": "application/json",
              "x-correlation-id": correlationId,
            },
            body: JSON.stringify(body),
          }
        );

        console.log(`[AdminUsersPage] Edge function response status (correlation: ${correlationId}):`, res.status);

        const json = (await res.json()) as {
          ok?: boolean;
          data?: { id?: string; resetLink?: string | null; tempPassword?: string };
          error?: { message?: string; code?: string; details?: unknown };
          correlationId?: string;
        };

        console.log(`[AdminUsersPage] Edge function response JSON (correlation: ${correlationId}):`, json);

        if (!res.ok || !json.ok || !json.data?.id) {
          const errorMsg = json.error?.message || `Failed to create user (HTTP ${res.status})`;
          console.error(`[AdminUsersPage] Create user failed (correlation: ${correlationId}):`, errorMsg, json);
          showError(errorMsg, { correlationId });
          setErr(errorMsg);
          return;
        }

        const newUserId = json.data.id;
        setLastInviteLink(json.data.resetLink ?? null);
        if (!inviteChecked && json.data.tempPassword) {
          setLastTempPassword(json.data.tempPassword);
        }

        console.log(`[AdminUsersPage] User created successfully (correlation: ${correlationId}), ID: ${newUserId}`);

        await syncStoreAccess(newUserId, new Set(), assignedStores);
        await loadUsers();
        setSelectedUserId(newUserId);
        
        // Clear error and show success toast
        setErr(null);
        showSuccess(`User created successfully: ${form.full_name}`, { correlationId });
      } else {
        // EXISTING USER: simple update
        const updatePayload = {
          full_name: form.full_name,
          role: form.role,
          status: form.status,
          home_store_id: form.home_store_id,
          must_reset_password: form.must_reset_password,
        };

        const { error } = await supabase
          .from("user_profiles")
          .update(updatePayload)
          .eq("id", form.id)
          .select()
          .maybeSingle();

        if (error) {
          const errorMsg = formatError(error) || "Failed to update user.";
          console.error("[AdminUsersPage] Update user failed:", error);
          showError(errorMsg);
          setErr(errorMsg);
          return;
        }

        await syncStoreAccess(form.id, initialAssignedStores, assignedStores);
        await loadUsers();
        
        // Show success toast
        showSuccess(`User updated successfully: ${form.full_name}`);
      }
    } catch (e: unknown) {
      const errorMsg = formatError(e) || "Network error while saving user.";
      console.error("[AdminUsersPage] Save exception:", e);
      setErr(errorMsg);
    } finally {
      setLoading(false);
    }
  }

  async function handleSendReset() {
    if (!form.email) {
      setErr("Email is required to send reset.");
      return;
    }

    setErr(null);
    setLoading(true);
    try {
      const { data: sessionData, error: sessionErr } =
        await supabase.auth.getSession();
      if (sessionErr || !sessionData?.session?.access_token) {
        setErr("Not authenticated.");
        return;
      }
      const token = sessionData.session.access_token;

      const correlationId = generateCorrelationId();
      console.log(`[AdminUsersPage] Sending password reset (correlation: ${correlationId}):`, form.email);

      const res = await fetch(
        "https://olbyttpwpovkvudtdoyc.supabase.co/functions/v1/admin_create_user",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            apikey: SUPABASE_ANON_KEY,
            "Content-Type": "application/json",
            "x-correlation-id": correlationId,
          },
          body: JSON.stringify({
            mode: "reset",
            email: form.email,
            redirectTo: `${window.location.origin}/reset-password`,
          }),
        }
      );

      console.log(`[AdminUsersPage] Password reset response status (correlation: ${correlationId}):`, res.status);

      const json = (await res.json()) as {
        ok?: boolean;
        data?: { resetLink?: string | null };
        error?: { message?: string; code?: string; details?: unknown };
        correlationId?: string;
      };

      console.log(`[AdminUsersPage] Password reset response JSON (correlation: ${correlationId}):`, json);

      if (!res.ok || !json.ok) {
        const errorMsg = json.error?.message || `Failed to send reset (HTTP ${res.status})`;
        console.error(`[AdminUsersPage] Password reset failed (correlation: ${correlationId}):`, errorMsg, json);
        showError(errorMsg, { correlationId });
        setErr(errorMsg);
        return;
      }

      setLastInviteLink(json.data?.resetLink ?? null);
      
      // Clear error and show success toast
      setErr(null);
      showSuccess(`Password reset email sent to ${form.email}`, { correlationId });
      console.log(`[AdminUsersPage] Password reset email sent successfully (correlation: ${correlationId})`);
    } catch (e: unknown) {
      const errorMsg = formatError(e) || "Network error while sending reset.";
      console.error("[AdminUsersPage] Reset exception:", e);
      setErr(errorMsg);
    } finally {
      setLoading(false);
    }
  }

  /**
   * Deactivate: Set status to 'inactive' and remove all store access.
   * Non-admins cannot log in when inactive; they'll see "Account inactive. Contact admin."
   */
  async function handleDeactivate() {
    if (!form.id) {
      setErr("No user selected.");
      return;
    }

    if (!window.confirm(`Deactivate user ${form.email}? They will not be able to sign in.`)) {
      return;
    }

    setErr(null);
    setLoading(true);
    try {
      // Update status to inactive
      const { error: updateErr } = await supabase
        .from("user_profiles")
        .update({ status: "inactive" })
        .eq("id", form.id);

      if (updateErr) {
        setErr(formatError(updateErr) || "Failed to deactivate user.");
        return;
      }

      // Remove all store access
      const { error: delErr } = await supabase
        .from("user_store_access")
        .delete()
        .eq("user_id", form.id);

      if (delErr) {
        console.error("Warning: failed to remove store access:", delErr);
        // Don't fail the entire operation if store access cleanup fails
      }

      // Refresh UI
      await loadUsers();
      setSelectedUserId(form.id);
      showSuccess(`User deactivated: ${form.email}`);
    } finally {
      setLoading(false);
    }
  }

  /**
   * Reactivate: Set status to 'active'.
   */
  async function handleReactivate() {
    if (!form.id) {
      setErr("No user selected.");
      return;
    }

    setErr(null);
    setLoading(true);
    try {
      const { error } = await supabase
        .from("user_profiles")
        .update({ status: "active" })
        .eq("id", form.id);

      if (error) {
        const errorMsg = formatError(error) || "Failed to reactivate user.";
        console.error("[AdminUsersPage] Reactivate failed:", error);
        showError(errorMsg);
        setErr(errorMsg);
        return;
      }

      await loadUsers();
      setSelectedUserId(form.id);
      showSuccess(`User reactivated: ${form.email}`);
    } finally {
      setLoading(false);
    }
  }

  /**
   * Soft delete: Set status to 'deleted' and remove all store access.
   */
  async function handleSoftDelete() {
    if (!form.id) {
      setErr("No user selected.");
      return;
    }

    if (!window.confirm(`Soft delete user ${form.email}? They will be marked as deleted.`)) {
      return;
    }

    setErr(null);
    setLoading(true);
    try {
      // Update status to deleted
      const { error: updateErr } = await supabase
        .from("user_profiles")
        .update({ status: "deleted" })
        .eq("id", form.id);

      if (updateErr) {
        setErr(formatError(updateErr) || "Failed to delete user.");
        return;
      }

      // Remove all store access
      const { error: delErr } = await supabase
        .from("user_store_access")
        .delete()
        .eq("user_id", form.id);

      if (delErr) {
        console.error("Warning: failed to remove store access:", delErr);
      }

      // Refresh UI
      await loadUsers();
      // Clear form to deselect
      showSuccess(`User soft deleted: ${form.email}`);
      handleClear();
    } finally {
      setLoading(false);
    }
  }

  // ---------- Render ----------

  return (
    <div style={{ display: "flex", height: "100%" }}>
      {/* Left: user list */}
      <div
        style={{
          width: 260,
          borderRight: "1px solid #eee",
          overflowY: "auto",
        }}
      >
        <button
          type="button"
          style={{ width: "100%", margin: "8px 0", padding: 8 }}
          onClick={handleClear}
          disabled={loading}
        >
          + New User
        </button>
        {users.map((u) => (
          <div
            key={u.id}
            onClick={() => !loading && setSelectedUserId(u.id)}
            style={{
              padding: "8px 12px",
              cursor: "pointer",
              background: selectedUserId === u.id ? "#f0f6ff" : undefined,
              color: u.status !== "active" ? "crimson" : undefined,
              borderBottom: "1px solid #f6f6f6",
            }}
          >
            <div>
              {u.full_name || u.email}
              {u.status !== "active" && (
                <span style={{ fontSize: 12, marginLeft: 6 }}>
                  ({u.status})
                </span>
              )}
            </div>
            <div style={{ fontSize: 12, color: "#888" }}>{u.email}</div>
          </div>
        ))}
      </div>

      {/* Right: form */}
      <div style={{ flex: 1, padding: 24, overflowY: "auto" }}>
        <h2>{form.id ? "Edit User" : "Create User (Pre-provision)"}</h2>
        {err && (
          <div style={{ color: "crimson", marginBottom: 12 }}>{err}</div>
        )}

        <div style={{ maxWidth: 420 }}>
          <label style={{ display: "block", marginBottom: 8 }}>
            Full Name
            <input
              name="full_name"
              value={form.full_name}
              onChange={handleFieldChange}
              disabled={loading}
              style={{ width: "100%", padding: 8 }}
            />
          </label>

          <label style={{ display: "block", marginBottom: 8 }}>
            Email
            <input
              name="email"
              type="email"
              value={form.email}
              onChange={handleFieldChange}
              disabled={!!form.id || loading}
              style={{ width: "100%", padding: 8 }}
            />
          </label>

          <label style={{ display: "block", marginBottom: 8 }}>
            Role
            <select
              name="role"
              value={form.role}
              onChange={handleFieldChange}
              disabled={loading}
              style={{ width: "100%", padding: 8 }}
            >
              <option value="Employee">Employee</option>
              <option value="Admin">Admin</option>
            </select>
          </label>

          <label style={{ display: "block", marginBottom: 8 }}>
            Status
            <select
              name="status"
              value={form.status}
              onChange={handleFieldChange}
              disabled={loading}
              style={{ width: "100%", padding: 8 }}
            >
              <option value="active">active</option>
              <option value="inactive">inactive</option>
              <option value="deleted">deleted</option>
            </select>
          </label>

          <label style={{ display: "block", marginBottom: 8 }}>
            Home Store
            <select
              name="home_store_id"
              value={form.home_store_id ?? ""}
              onChange={handleFieldChange}
              disabled={loading}
              style={{ width: "100%", padding: 8 }}
            >
              <option value="">-- None --</option>
              {stores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.store_name}
                  {s.ace_store_number ? ` (${s.ace_store_number})` : ""}
                  {s.status !== "active" ? " (inactive)" : ""}
                </option>
              ))}
            </select>
          </label>

          <label style={{ display: "block", marginBottom: 8 }}>
            <input
              type="checkbox"
              name="must_reset_password"
              checked={form.must_reset_password}
              onChange={handleFieldChange}
              disabled={loading}
            />{" "}
            Force password reset
          </label>

          {!form.id && (
            <>
              <label style={{ display: "block", marginBottom: 8 }}>
                <input
                  type="checkbox"
                  checked={inviteChecked}
                  onChange={(e) => setInviteChecked(e.target.checked)}
                  disabled={loading}
                />{" "}
                Send invite email (recommended)
              </label>

              <label style={{ display: "block", marginBottom: 8 }}>
                Temporary Password (optional)
                <div>
                  <input
                    type="text"
                    value={tempPassword}
                    onChange={(e) => setTempPassword(e.target.value)}
                    disabled={loading}
                    style={{ width: 180, padding: 6, marginRight: 8 }}
                  />
                  <button
                    type="button"
                    onClick={generateTempPassword}
                    disabled={loading}
                  >
                    Generate
                  </button>
                </div>
              </label>
            </>
          )}

          <div style={{ marginTop: 16, marginBottom: 8 }}>
            <div style={{ fontWeight: 500, marginBottom: 4 }}>Store Access</div>
            {form.id ? (
              stores.map((s) => (
                <label key={s.id} style={{ display: "block", fontSize: 14 }}>
                  <input
                    type="checkbox"
                    checked={assignedStores.has(s.id)}
                    onChange={() => toggleStore(s.id)}
                    disabled={loading}
                  />{" "}
                  {s.store_name}
                  {s.ace_store_number ? ` (${s.ace_store_number})` : ""}
                  {s.status !== "active" ? " (inactive)" : ""}
                </label>
              ))
            ) : (
              <div style={{ fontSize: 13, color: "#666" }}>
                Create the user first, then assign store access.
              </div>
            )}
          </div>

          <div style={{ marginTop: 16 }}>
            <button
              type="button"
              onClick={handleSave}
              disabled={loading}
              style={{ marginRight: 8 }}
            >
              Save
            </button>
            <button
              type="button"
              onClick={handleClear}
              disabled={loading}
              style={{ marginRight: 8 }}
            >
              Clear
            </button>
            {form.id && (
              <>
                <button
                  type="button"
                  onClick={handleSendReset}
                  disabled={loading}
                  style={{ marginRight: 8 }}
                >
                  Send Password Reset
                </button>
                {form.status === "active" && (
                  <button
                    type="button"
                    onClick={handleDeactivate}
                    disabled={loading}
                    style={{ marginRight: 8, color: "#ff6600" }}
                  >
                    Deactivate
                  </button>
                )}
                {form.status === "inactive" && (
                  <button
                    type="button"
                    onClick={handleReactivate}
                    disabled={loading}
                    style={{ marginRight: 8, color: "#00aa00" }}
                  >
                    Reactivate
                  </button>
                )}
                {form.status !== "deleted" && (
                  <button
                    type="button"
                    onClick={handleSoftDelete}
                    disabled={loading}
                    style={{ color: "crimson" }}
                  >
                    Soft Delete
                  </button>
                )}
              </>
            )}
          </div>

          {lastInviteLink && (
            <div style={{ marginTop: 12, fontSize: 13 }}>
              Reset link:{" "}
              <a href={lastInviteLink} target="_blank" rel="noreferrer">
                {lastInviteLink}
              </a>
            </div>
          )}
          {lastTempPassword && (
            <div style={{ marginTop: 12, fontSize: 13 }}>
              Temporary password: <strong>{lastTempPassword}</strong>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
