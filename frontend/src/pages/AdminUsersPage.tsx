import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";

type UserProfileRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string | null;
  status: string | null;
  home_store_id: string | null;
  must_reset_password?: boolean | null;
};

type StoreRow = {
  id: string;
  ace_store_number: string;
  store_name: string;
  status?: string | null;
};

function formatError(err: any) {
  if (!err) return "";
  if (typeof err === "string") return err;
  if (err?.message) return err.message;
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
  const [users, setUsers] = useState<UserProfileRow[]>([]);

  const [filter, setFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<"active" | "inactive" | "all">("active");

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("Employee");
  const [status, setStatus] = useState("active");
  const [homeStoreId, setHomeStoreId] = useState<string | null>(null);

  const [forcePasswordReset, setForcePasswordReset] = useState(true);
  const [sendInviteEmail, setSendInviteEmail] = useState(true);
  const [tempPassword, setTempPassword] = useState("");

  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

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

      setUsers((usersData ?? []) as UserProfileRow[]);
    } catch (e: any) {
      console.error("AdminUsersPage refresh error:", e);
      setErr(formatError(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refreshUsersAndStores();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function generatePassword() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
    let out = "";
    for (let i = 0; i < 12; i++) out += chars[Math.floor(Math.random() * chars.length)];
    out += "!A1";
    setTempPassword(out);
  }

  async function onCreateUser() {
    setErr("");
    setLoading(true);

    try {
      const { data: sessionData, error: sessionErr } = await supabase.auth.getSession();
      if (sessionErr) throw sessionErr;

      const token = sessionData?.session?.access_token;
      if (!token) {
        setErr("No session token found. You must be signed in.");
        return;
      }
      if (!anonKey) {
        setErr("Missing VITE_SUPABASE_ANON_KEY in your Vercel env vars.");
        return;
      }

      const payload = {
        email: email.trim(),
        full_name: fullName.trim(),
        role,
        status,
        home_store_id: homeStoreId,
        invite: !!sendInviteEmail,
        tempPassword: tempPassword ? tempPassword : undefined,
        // your checkbox name in UI is “Force password reset”; keep intent:
        // if not inviting, we still want them forced to reset via temp password workflow
        forcePasswordReset: !!forcePasswordReset,
      };

      console.log("AdminUsersPage: calling admin_create_user payload=", payload);

      const resp = await fetch(
        "https://olbyttpwpovkvudtdoyc.supabase.co/functions/v1/admin_create_user",
        {
          method: "POST",
          headers: {
            // ✅ THIS is the big missing piece
            apikey: anonKey,
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        }
      );

      const text = await resp.text();
      let json: any = null;
      try {
        json = text ? JSON.parse(text) : null;
      } catch {
        json = { raw: text };
      }

      console.log(`AdminUsersPage: admin_create_user status=${resp.status}`, json);

      if (!resp.ok) {
        if (resp.status === 401) {
          setErr("Unauthorized when calling admin_create_user. (Usually missing apikey or invalid session.)");
        } else if (resp.status === 403) {
          setErr("Forbidden: caller is not authorized to create users (ensure you are an Admin).");
        } else if (resp.status === 409) {
          setErr("Email already exists (invite failed). Use Send Password Reset for existing users.");
        } else {
          setErr(formatError(json) || `admin_create_user failed with status ${resp.status}`);
        }
        return;
      }

      const newUserId = json?.id;
      if (!newUserId) {
        setErr("No user id returned from admin_create_user.");
        return;
      }

      // ✅ refresh list so UI shows the new user
      await refreshUsersAndStores();

      // clear form
      setFullName("");
      setEmail("");
      setRole("Employee");
      setStatus("active");
      setHomeStoreId(null);
      setTempPassword("");
      setSendInviteEmail(true);
      setForcePasswordReset(true);
    } catch (e: any) {
      console.error("AdminUsersPage create user error:", e);
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
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="all">All</option>
            </select>
          </div>

          {filteredUsers.map((u) => (
            <div key={u.id} style={{ marginBottom: 12 }}>
              <div style={{ fontWeight: 700 }}>{u.full_name || "(no name)"}</div>
              <div style={{ fontSize: 13, color: "#555" }}>
                {(u.email || "(no email)")} • {u.role || "?"} • {u.status || "?"}
              </div>
            </div>
          ))}
        </div>

        {/* Right create form */}
        <div style={{ border: "1px solid #ddd", padding: 12 }}>
          <h3>Create User (Pre-provision)</h3>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <div>Full Name</div>
              <input value={fullName} onChange={(e) => setFullName(e.target.value)} style={{ width: "100%" }} />
            </div>
            <div>
              <div>Email</div>
              <input value={email} onChange={(e) => setEmail(e.target.value)} style={{ width: "100%" }} />
            </div>

            <div>
              <div>Role</div>
              <select value={role} onChange={(e) => setRole(e.target.value)} style={{ width: "100%" }}>
                <option>Employee</option>
                <option>Admin</option>
              </select>
            </div>

            <div>
              <div>Status</div>
              <select value={status} onChange={(e) => setStatus(e.target.value)} style={{ width: "100%" }}>
                <option value="active">active</option>
                <option value="inactive">inactive</option>
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
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ marginTop: 12 }}>
            <label style={{ display: "block" }}>
              <input
                type="checkbox"
                checked={forcePasswordReset}
                onChange={(e) => setForcePasswordReset(e.target.checked)}
              />{" "}
              Force password reset
            </label>

            <label style={{ display: "block" }}>
              <input
                type="checkbox"
                checked={sendInviteEmail}
                onChange={(e) => setSendInviteEmail(e.target.checked)}
              />{" "}
              Send invite email (recommended)
            </label>
          </div>

          <div style={{ marginTop: 12 }}>
            <div>Temporary Password (optional)</div>
            <div style={{ display: "flex", gap: 8 }}>
              <input value={tempPassword} onChange={(e) => setTempPassword(e.target.value)} style={{ flex: 1 }} />
              <button type="button" onClick={generatePassword}>
                Generate
              </button>
            </div>
          </div>

          <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
            <button type="button" onClick={onCreateUser} disabled={loading}>
              Save
            </button>
            <button type="button" onClick={refreshUsersAndStores} disabled={loading}>
              Refresh
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
