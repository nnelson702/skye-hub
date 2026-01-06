/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../contexts/AuthContext";

type StoreRow = {
  id: number;
  ace_store_number: string;
  store_name: string;
  status: string;
};

type UserProfileRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string | null;
  status: string | null;
  home_store_id: number | null;
  must_reset_password: boolean | null;
};

type StoreAccessRow = {
  user_id: string;
  store_id: number;
};

export default function AdminUsersPage() {
  const { auth } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [stores, setStores] = useState<StoreRow[]>([]);
  const [users, setUsers] = useState<UserProfileRow[]>([]);
  const [access, setAccess] = useState<StoreAccessRow[]>([]);

  const [filterText, setFilterText] = useState("");
  const [statusFilter, setStatusFilter] = useState("Active");

  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  // form state
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("Employee");
  const [userStatus, setUserStatus] = useState("active");
  const [homeStoreId, setHomeStoreId] = useState<number | null>(null);

  const [forceReset, setForceReset] = useState(true);
  const [sendInvite, setSendInvite] = useState(false);
  const [tempPassword, setTempPassword] = useState("");

  const [storeAccessIds, setStoreAccessIds] = useState<number[]>([]);

  const [err, setErr] = useState<string | null>(null);
  const [justCreatedUserId, setJustCreatedUserId] = useState<string | null>(null);

  const filteredUsers = useMemo(() => {
    const ft = filterText.trim().toLowerCase();
    const statusWant = statusFilter.toLowerCase();

    return users
      .filter((u) => {
        const s = (u.status ?? "").toLowerCase();
        if (statusWant === "active" && s !== "active") return false;
        if (statusWant === "inactive" && s === "active") return false;
        return true;
      })
      .filter((u) => {
        if (!ft) return true;
        const n = (u.full_name ?? "").toLowerCase();
        const e = (u.email ?? "").toLowerCase();
        return n.includes(ft) || e.includes(ft);
      });
  }, [users, filterText, statusFilter]);

  async function fetchAll() {
    setLoading(true);
    setErr(null);
    setJustCreatedUserId(null);

    try {
      const userId = auth?.user?.id;
      const userRole = auth?.profile?.role;

      console.log(
        `AdminUsersPage: fetching stores+users as user=${userId} role=${userRole}`,
      );

      const [storesRes, usersRes, accessRes] = await Promise.all([
        supabase
          .from("stores")
          .select("id,ace_store_number,store_name,status")
          .order("store_name", { ascending: true }),
        supabase
          .from("user_profiles")
          .select(
            "id,full_name,email,role,status,home_store_id,must_reset_password",
          )
          .order("full_name", { ascending: true }),
        supabase.from("user_store_access").select("user_id,store_id"),
      ]);

      if (storesRes.error) throw storesRes.error;
      if (usersRes.error) throw usersRes.error;
      if (accessRes.error) throw accessRes.error;

      setStores((storesRes.data ?? []) as StoreRow[]);
      setUsers((usersRes.data ?? []) as UserProfileRow[]);
      setAccess((accessRes.data ?? []) as StoreAccessRow[]);

      console.log(
        `AdminUsersPage: fetched stores: ${(storesRes.data ?? []).length} users: ${(usersRes.data ?? []).length}`,
      );

      // default home store
      if (!homeStoreId && (storesRes.data ?? []).length > 0) {
        setHomeStoreId((storesRes.data ?? [])[0].id);
      }
    } catch (e: any) {
      console.error("AdminUsersPage fetchAll error:", e);
      setErr(e?.message || "Failed to load admin users data.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function clearForm() {
    setSelectedUserId(null);
    setFullName("");
    setEmail("");
    setRole("Employee");
    setUserStatus("active");
    setHomeStoreId(stores[0]?.id ?? null);
    setForceReset(true);
    setSendInvite(false);
    setTempPassword("");
    setStoreAccessIds([]);
    setErr(null);
    setJustCreatedUserId(null);
  }

  function selectUser(u: UserProfileRow) {
    setSelectedUserId(u.id);
    setFullName(u.full_name ?? "");
    setEmail(u.email ?? "");
    setRole(u.role ?? "Employee");
    setUserStatus(u.status ?? "active");
    setHomeStoreId(u.home_store_id ?? null);
    setForceReset(!!u.must_reset_password);
    setSendInvite(false);
    setTempPassword("");
    setStoreAccessIds(
      access.filter((a) => a.user_id === u.id).map((a) => a.store_id),
    );
    setErr(null);
    setJustCreatedUserId(null);
  }

  function toggleStoreAccess(storeId: number) {
    setStoreAccessIds((prev) =>
      prev.includes(storeId) ? prev.filter((x) => x !== storeId) : [...prev, storeId],
    );
  }

  function generatePassword() {
    const chars =
      "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
    let out = "";
    for (let i = 0; i < 10; i++) out += chars[Math.floor(Math.random() * chars.length)];
    out += "!A1";
    setTempPassword(out);
  }

  async function saveUser() {
    setSaving(true);
    setErr(null);
    setJustCreatedUserId(null);

    try {
      if (!fullName.trim() || !email.trim()) {
        setErr("Full name and email are required.");
        setSaving(false);
        return;
      }

      // NOTE: This path creates NEW Auth user + profile via Edge Function.
      // If selectedUserId exists, we only update profile + store access (no new auth user).
      if (!selectedUserId) {
        // Create via Edge Function
        const payload = {
          email: email.trim(),
          full_name: fullName.trim(),
          role,
          status: userStatus,
          home_store_id: homeStoreId,
          invite: !!sendInvite,
          tempPassword: tempPassword ? tempPassword : undefined,
          // Optional: pass redirectTo if you want invite link destination
          // redirectTo: `${window.location.origin}/reset-password`,
        };

        console.log("AdminUsersPage: calling admin_create_user via invoke()", payload);

        const { data: json, error: fnErr } = await supabase.functions.invoke(
          "admin_create_user",
          { body: payload },
        );

        if (fnErr) {
          console.log("AdminUsersPage: admin_create_user done ok=false", fnErr);
          setErr((fnErr as any)?.message || "admin_create_user failed.");
          setSaving(false);
          return;
        }

        const newUserId = (json as any)?.id;
        if (!newUserId) throw new Error("No id returned from admin_create_user");

        console.log("AdminUsersPage: created userId", newUserId);

        // Store access rows
        if (storeAccessIds.length > 0) {
          const accessRows = storeAccessIds.map((sid) => ({
            user_id: newUserId,
            store_id: sid,
          }));

          const { error: accessErr } = await supabase
            .from("user_store_access")
            .insert(accessRows);

          if (accessErr) throw accessErr;
        }

        setJustCreatedUserId(newUserId);
        await fetchAll();
        clearForm();
        setSaving(false);
        return;
      }

      // Existing user update (profile + access)
      const { error: upErr } = await supabase
        .from("user_profiles")
        .update({
          full_name: fullName.trim(),
          email: email.trim(),
          role,
          status: userStatus,
          home_store_id: homeStoreId,
          must_reset_password: !!forceReset,
        })
        .eq("id", selectedUserId);

      if (upErr) throw upErr;

      // Replace store access
      const { error: delErr } = await supabase
        .from("user_store_access")
        .delete()
        .eq("user_id", selectedUserId);
      if (delErr) throw delErr;

      if (storeAccessIds.length > 0) {
        const accessRows = storeAccessIds.map((sid) => ({
          user_id: selectedUserId,
          store_id: sid,
        }));

        const { error: insErr } = await supabase
          .from("user_store_access")
          .insert(accessRows);
        if (insErr) throw insErr;
      }

      await fetchAll();
      setSaving(false);
    } catch (e: any) {
      console.error("AdminUsersPage save error:", e);
      setErr(e?.message || "Save failed.");
      setSaving(false);
    }
  }

  async function sendPasswordResetEmail() {
    setErr(null);
    try {
      if (!email.trim()) {
        setErr("Email is required.");
        return;
      }
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      setErr("Password reset email sent.");
    } catch (e: any) {
      console.error("reset email error:", e);
      setErr(e?.message || "Failed to send reset email.");
    }
  }

  if (loading) return <div style={{ padding: 16 }}>Loading...</div>;

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: "flex", gap: 24 }}>
        {/* Left panel */}
        <div style={{ width: 360 }}>
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            <input
              style={{ flex: 1, padding: 8 }}
              placeholder="Filter by name or email"
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
            />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{ padding: 8 }}
            >
              <option>Active</option>
              <option>Inactive</option>
            </select>
          </div>

          <div style={{ border: "1px solid #ddd", borderRadius: 6, padding: 12 }}>
            {filteredUsers.map((u) => (
              <div
                key={u.id}
                onClick={() => selectUser(u)}
                style={{
                  padding: "10px 8px",
                  cursor: "pointer",
                  borderBottom: "1px solid #eee",
                }}
              >
                <div style={{ fontWeight: 700 }}>{u.full_name || "(no name)"}</div>
                <div style={{ fontSize: 12, color: "#555" }}>
                  {(u.email ?? "")} • {(u.role ?? "")} • {(u.status ?? "")}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right panel */}
        <div style={{ flex: 1 }}>
          <h2 style={{ marginTop: 0 }}>Create User (Pre-provision)</h2>

          {err && (
            <div style={{ color: err.toLowerCase().includes("sent") ? "green" : "crimson", marginBottom: 12 }}>
              {err}
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <div>Full Name</div>
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                style={{ width: "100%", padding: 8 }}
              />
            </div>
            <div>
              <div>Email</div>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{ width: "100%", padding: 8 }}
              />
            </div>

            <div>
              <div>Role</div>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                style={{ width: "100%", padding: 8 }}
              >
                <option>Employee</option>
                <option>Admin</option>
              </select>
            </div>

            <div>
              <div>Status</div>
              <select
                value={userStatus}
                onChange={(e) => setUserStatus(e.target.value)}
                style={{ width: "100%", padding: 8 }}
              >
                <option value="active">active</option>
                <option value="inactive">inactive</option>
              </select>
            </div>

            <div style={{ gridColumn: "1 / span 2" }}>
              <div>Home Store</div>
              <select
                value={homeStoreId ?? ""}
                onChange={(e) => setHomeStoreId(Number(e.target.value))}
                style={{ width: "100%", padding: 8 }}
              >
                {stores.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.store_name} (ACE {s.ace_store_number})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ marginTop: 12 }}>
            <label style={{ display: "block", marginBottom: 6 }}>
              <input
                type="checkbox"
                checked={forceReset}
                onChange={(e) => setForceReset(e.target.checked)}
              />{" "}
              Force password reset (sets must_reset_password on the profile; user must sign up/login to activate account)
            </label>

            <label style={{ display: "block", marginBottom: 6 }}>
              <input
                type="checkbox"
                checked={sendInvite}
                onChange={(e) => setSendInvite(e.target.checked)}
              />{" "}
              Send invite email (recommended)
            </label>
          </div>

          <div style={{ marginTop: 12 }}>
            <div>Temporary Password (optional)</div>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                value={tempPassword}
                onChange={(e) => setTempPassword(e.target.value)}
                style={{ flex: 1, padding: 8 }}
              />
              <button onClick={generatePassword}>Generate</button>
            </div>
          </div>

          <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
            <button onClick={saveUser} disabled={saving}>
              {saving ? "Saving..." : "Save"}
            </button>
            <button onClick={clearForm} disabled={saving}>
              Clear / New
            </button>
            <button onClick={sendPasswordResetEmail} disabled={saving}>
              Send reset link
            </button>
          </div>

          <hr style={{ margin: "18px 0" }} />

          <h3 style={{ marginTop: 0 }}>Store Access</h3>
          <div style={{ display: "grid", gap: 8 }}>
            {stores.map((s) => (
              <label key={s.id} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input
                  type="checkbox"
                  checked={storeAccessIds.includes(s.id)}
                  onChange={() => toggleStoreAccess(s.id)}
                />
                <span>
                  {s.store_name} (ACE {s.ace_store_number})
                </span>
              </label>
            ))}
          </div>

          {justCreatedUserId && (
            <div style={{ marginTop: 14, color: "green" }}>
              Created user id: {justCreatedUserId}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
