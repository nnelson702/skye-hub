// frontend/src/pages/AdminStoresPage.tsx
import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../auth/AuthProvider";

type StoreStatus = "active" | "inactive";

type StoreRow = {
  id: string;
  ace_store_number: string;
  pos_store_number: string | null;
  store_name: string;
  store_email: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  country: string | null;
  date_opened: string | null;
  timezone: string | null;
  sort_order: number | null;
  primary_manager_user_id: string | null;
  status: StoreStatus;
};

type UserOption = { id: string; full_name: string | null; email: string | null; role: string | null };

export default function AdminStoresPage() {
  const { role } = useAuth();
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [stores, setStores] = useState<StoreRow[]>([]);
  const [managers, setManagers] = useState<UserOption[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const emptyStore: StoreRow = useMemo(
    () => ({
      id: "",
      ace_store_number: "",
      pos_store_number: "",
      store_name: "",
      store_email: "",
      address_line1: "",
      address_line2: "",
      city: "",
      state: "NV",
      postal_code: "",
      country: "US",
      date_opened: null,
      timezone: "America/Los_Angeles",
      sort_order: null,
      primary_manager_user_id: null,
      status: "active",
    }),
    []
  );

  const [form, setForm] = useState<StoreRow>(emptyStore);

  const load = async () => {
    try {
      setErr(null);
      setLoading(true);

      const [{ data: storeData, error: storeErr }, { data: mgrData, error: mgrErr }] = await Promise.all([
        supabase.from("stores").select("*").order("sort_order", { ascending: true }).order("store_name", { ascending: true }),
        supabase
          .from("user_profiles")
          .select("id, full_name, email, role")
          .in("role", ["manager", "admin"])
          .eq("status", "active")
          .order("full_name", { ascending: true }),
      ]);

      if (storeErr) throw storeErr;
      if (mgrErr) throw mgrErr;

      setStores((storeData as StoreRow[]) ?? []);
      setManagers((mgrData as UserOption[]) ?? []);

      // keep selection stable
      if (selectedId) {
        const match = (storeData as StoreRow[])?.find((s) => s.id === selectedId);
        if (match) setForm(match);
      }
    } catch (e: any) {
      setErr(e?.message ?? "Failed to load stores.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (role !== "admin") return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role]);

  if (role !== "admin") return <div>Not authorized.</div>;

  const pick = (id: string) => {
    setSelectedId(id);
    const s = stores.find((x) => x.id === id);
    if (s) setForm(s);
  };

  const newStore = () => {
    setSelectedId(null);
    setForm({ ...emptyStore });
  };

  const save = async () => {
    try {
      setErr(null);

      const payload = { ...form } as any;
      if (!payload.pos_store_number) payload.pos_store_number = null;
      if (!payload.store_email) payload.store_email = null;
      if (!payload.address_line1) payload.address_line1 = null;
      if (!payload.address_line2) payload.address_line2 = null;
      if (!payload.city) payload.city = null;
      if (!payload.state) payload.state = null;
      if (!payload.postal_code) payload.postal_code = null;
      if (!payload.country) payload.country = null;
      if (!payload.timezone) payload.timezone = null;
      if (!payload.primary_manager_user_id) payload.primary_manager_user_id = null;
      if (!payload.sort_order) payload.sort_order = null;

      // Upsert: if id empty -> let DB generate id if configured; otherwise will insert with provided id.
      // Many schemas use uuid default. If your table requires id provided, we can adjust later.
      if (!payload.id) delete payload.id;

      const { error } = await supabase.from("stores").upsert(payload, { onConflict: "ace_store_number" });
      if (error) throw error;

      await load();
      // reselect based on ace_store_number if it was a new insert
      const matchAce = stores.find((s) => s.ace_store_number === form.ace_store_number);
      if (matchAce) setSelectedId(matchAce.id);
    } catch (e: any) {
      setErr(e?.message ?? "Save failed.");
    }
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "340px 1fr", gap: 16, alignItems: "start" }}>
      <div style={{ border: "1px solid #eee", borderRadius: 14, padding: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <div style={{ fontWeight: 800 }}>Stores</div>
          <button onClick={newStore} style={{ border: "1px solid #ddd", background: "#fff", borderRadius: 10, padding: "6px 10px", cursor: "pointer" }}>
            + New
          </button>
        </div>

        {loading ? <div>Loading…</div> : null}
        {err ? <div style={{ color: "crimson", marginBottom: 10 }}>{err}</div> : null}

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {stores.map((s) => (
            <button
              key={s.id}
              onClick={() => pick(s.id)}
              style={{
                textAlign: "left",
                border: "1px solid #eee",
                background: selectedId === s.id ? "rgba(0,0,0,0.04)" : "#fff",
                borderRadius: 12,
                padding: 10,
                cursor: "pointer",
              }}
            >
              <div style={{ fontWeight: 800 }}>{s.store_name}</div>
              <div style={{ color: "#666", fontSize: 12 }}>
                ACE {s.ace_store_number} • POS {s.pos_store_number ?? "—"} • {s.status}
              </div>
            </button>
          ))}
        </div>
      </div>

      <div style={{ border: "1px solid #eee", borderRadius: 14, padding: 12 }}>
        <div style={{ fontWeight: 800, marginBottom: 10 }}>{selectedId ? "Edit Store" : "Create Store"}</div>

        {err ? <div style={{ color: "crimson", marginBottom: 10 }}>{err}</div> : null}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <label>
            <div style={{ fontSize: 12, color: "#666" }}>ACE Store #</div>
            <input value={form.ace_store_number} onChange={(e) => setForm({ ...form, ace_store_number: e.target.value })} style={{ width: "100%", padding: 8 }} />
          </label>

          <label>
            <div style={{ fontSize: 12, color: "#666" }}>POS Store #</div>
            <input value={form.pos_store_number ?? ""} onChange={(e) => setForm({ ...form, pos_store_number: e.target.value })} style={{ width: "100%", padding: 8 }} />
          </label>

          <label style={{ gridColumn: "span 2" }}>
            <div style={{ fontSize: 12, color: "#666" }}>Store Name</div>
            <input value={form.store_name} onChange={(e) => setForm({ ...form, store_name: e.target.value })} style={{ width: "100%", padding: 8 }} />
          </label>

          <label style={{ gridColumn: "span 2" }}>
            <div style={{ fontSize: 12, color: "#666" }}>Store Email</div>
            <input value={form.store_email ?? ""} onChange={(e) => setForm({ ...form, store_email: e.target.value })} style={{ width: "100%", padding: 8 }} />
          </label>

          <label style={{ gridColumn: "span 2" }}>
            <div style={{ fontSize: 12, color: "#666" }}>Address Line 1</div>
            <input value={form.address_line1 ?? ""} onChange={(e) => setForm({ ...form, address_line1: e.target.value })} style={{ width: "100%", padding: 8 }} />
          </label>

          <label style={{ gridColumn: "span 2" }}>
            <div style={{ fontSize: 12, color: "#666" }}>Address Line 2</div>
            <input value={form.address_line2 ?? ""} onChange={(e) => setForm({ ...form, address_line2: e.target.value })} style={{ width: "100%", padding: 8 }} />
          </label>

          <label>
            <div style={{ fontSize: 12, color: "#666" }}>City</div>
            <input value={form.city ?? ""} onChange={(e) => setForm({ ...form, city: e.target.value })} style={{ width: "100%", padding: 8 }} />
          </label>

          <label>
            <div style={{ fontSize: 12, color: "#666" }}>State</div>
            <input value={form.state ?? ""} onChange={(e) => setForm({ ...form, state: e.target.value })} style={{ width: "100%", padding: 8 }} />
          </label>

          <label>
            <div style={{ fontSize: 12, color: "#666" }}>Postal Code</div>
            <input value={form.postal_code ?? ""} onChange={(e) => setForm({ ...form, postal_code: e.target.value })} style={{ width: "100%", padding: 8 }} />
          </label>

          <label>
            <div style={{ fontSize: 12, color: "#666" }}>Country</div>
            <input value={form.country ?? ""} onChange={(e) => setForm({ ...form, country: e.target.value })} style={{ width: "100%", padding: 8 }} />
          </label>

          <label>
            <div style={{ fontSize: 12, color: "#666" }}>Date Opened</div>
            <input
              type="date"
              value={form.date_opened ?? ""}
              onChange={(e) => setForm({ ...form, date_opened: e.target.value || null })}
              style={{ width: "100%", padding: 8 }}
            />
          </label>

          <label>
            <div style={{ fontSize: 12, color: "#666" }}>Sort Order</div>
            <input
              type="number"
              value={form.sort_order ?? ""}
              onChange={(e) => setForm({ ...form, sort_order: e.target.value ? Number(e.target.value) : null })}
              style={{ width: "100%", padding: 8 }}
            />
          </label>

          <label>
            <div style={{ fontSize: 12, color: "#666" }}>Timezone</div>
            <input value={form.timezone ?? ""} onChange={(e) => setForm({ ...form, timezone: e.target.value })} style={{ width: "100%", padding: 8 }} />
          </label>

          <label>
            <div style={{ fontSize: 12, color: "#666" }}>Status</div>
            <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as StoreStatus })} style={{ width: "100%", padding: 8 }}>
              <option value="active">active</option>
              <option value="inactive">inactive</option>
            </select>
          </label>

          <label style={{ gridColumn: "span 2" }}>
            <div style={{ fontSize: 12, color: "#666" }}>Primary Store Manager</div>
            <select
              value={form.primary_manager_user_id ?? ""}
              onChange={(e) => setForm({ ...form, primary_manager_user_id: e.target.value || null })}
              style={{ width: "100%", padding: 8 }}
            >
              <option value="">— None —</option>
              {managers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.full_name ?? u.email ?? u.id}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
          <button onClick={save} style={{ border: "1px solid #ddd", background: "#fff", borderRadius: 10, padding: "8px 12px", cursor: "pointer", fontWeight: 700 }}>
            Save
          </button>
          <button onClick={newStore} style={{ border: "1px solid #ddd", background: "#fff", borderRadius: 10, padding: "8px 12px", cursor: "pointer" }}>
            Clear / New
          </button>
        </div>
      </div>
    </div>
  );
}
