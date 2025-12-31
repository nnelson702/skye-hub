import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";

type StoreRow = {
  id: string;
  ace_store_number: string;
  pos_store_number: string;
  store_name: string;
  store_email: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  country: string | null;
  date_opened: string | null;
  sort_order: number | null;
  timezone: string | null;
  status: "active" | "inactive";
  primary_store_manager_id: string | null;
};

const empty = (): StoreRow => ({
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
  date_opened: "",
  sort_order: 0,
  timezone: "America/Los_Angeles",
  status: "active",
  primary_store_manager_id: null,
});

export default function AdminStoresPage() {
  const [stores, setStores] = useState<StoreRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [form, setForm] = useState<StoreRow>(empty());

  const load = async () => {
    setLoading(true);
    setErr(null);
    try {
      const { data, error } = await supabase
        .from("stores")
        .select(
          "id, ace_store_number, pos_store_number, store_name, store_email, address_line1, address_line2, city, state, postal_code, country, date_opened, sort_order, timezone, status, primary_store_manager_id"
        )
        .order("sort_order", { ascending: true })
        .order("store_name", { ascending: true });

      if (error) throw error;
      setStores((data ?? []) as StoreRow[]);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      setErr(message || "Failed to load stores.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const pick = (s: StoreRow) => setForm({ ...s });
  const clear = () => setForm(empty());

  const save = async () => {
    setErr(null);

    const payload = {
      ace_store_number: form.ace_store_number.trim(),
      pos_store_number: form.pos_store_number.trim(),
      store_name: form.store_name.trim(),
      store_email: form.store_email?.trim() || null,
      address_line1: form.address_line1?.trim() || null,
      address_line2: form.address_line2?.trim() || null,
      city: form.city?.trim() || null,
      state: form.state?.trim() || null,
      postal_code: form.postal_code?.trim() || null,
      country: form.country?.trim() || null,
      date_opened: form.date_opened || null,
      sort_order: Number.isFinite(Number(form.sort_order)) ? Number(form.sort_order) : null,
      timezone: form.timezone?.trim() || null,
    };

    if (!payload.ace_store_number) return setErr("ACE Store # is required.");
    if (!payload.pos_store_number) return setErr("POS Store # is required.");
    if (!payload.store_name) return setErr("Store Name is required.");

    try {
      // If form.id is falsy -> create new store (omit id so DB can generate it)
      if (!form.id) {
        const { error } = await supabase.from("stores").insert(payload).select();
        if (error) throw error;
        // ensure we refresh the list with the newly created store included
        await load();
        // If desired, pick the newly created item into the form (keep simple: clear form)
        clear();
        return;
      }

      // Existing store -> update via upsert (id present)
      const { error } = await supabase.from("stores").upsert({ ...payload, id: form.id }, { onConflict: "id" });
      if (error) throw error;

      await load();
      clear();
    } catch (e: unknown) {
      // Safe message extraction with JSON fallback
      let message = "Save failed.";
      if (e instanceof Error) message = e.message;
      else if (typeof e === "string") message = e;
      else {
        try {
          message = JSON.stringify(e as object);
        } catch {
          message = String(e);
        }
      }
      console.error("AdminStoresPage save error:", e);
      setErr(message || "Save failed.");
    }
  };

  const list = useMemo(() => stores, [stores]);

  if (loading) return <div>Loading…</div>;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "360px 1fr", gap: 18 }}>
      <div style={{ border: "1px solid #e5e5e5", borderRadius: 10, padding: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ margin: 0 }}>Stores</h2>
          <button onClick={clear}>+ New</button>
        </div>

        <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
          {list.map((s) => (
            <div
              key={s.id}
              onClick={() => pick(s)}
              style={{
                border: "1px solid #eee",
                borderRadius: 10,
                padding: 12,
                cursor: "pointer",
              }}
            >
              <div style={{ fontWeight: 800 }}>{s.store_name}</div>
              <div style={{ color: "#555", fontSize: 13 }}>
                ACE {s.ace_store_number} • POS {s.pos_store_number} • {s.status}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ border: "1px solid #e5e5e5", borderRadius: 10, padding: 14 }}>
        <h2 style={{ marginTop: 0 }}>{form.id ? "Edit Store" : "Create Store"}</h2>

        {err ? <div style={{ color: "crimson", marginBottom: 10 }}>{err}</div> : null}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, maxWidth: 980 }}>
          <label>
            <div>ACE Store #</div>
            <input
              value={form.ace_store_number}
              onChange={(e) => setForm((p) => ({ ...p, ace_store_number: e.target.value }))}
              style={{ width: "100%", padding: 8 }}
            />
          </label>

          <label>
            <div>POS Store #</div>
            <input
              value={form.pos_store_number}
              onChange={(e) => setForm((p) => ({ ...p, pos_store_number: e.target.value }))}
              style={{ width: "100%", padding: 8 }}
            />
          </label>

          <label>
            <div>Store Name</div>
            <input
              value={form.store_name}
              onChange={(e) => setForm((p) => ({ ...p, store_name: e.target.value }))}
              style={{ width: "100%", padding: 8 }}
            />
          </label>

          <label>
            <div>Store Email</div>
            <input
              value={form.store_email ?? ""}
              onChange={(e) => setForm((p) => ({ ...p, store_email: e.target.value }))}
              style={{ width: "100%", padding: 8 }}
            />
          </label>

          <label>
            <div>Address Line 1</div>
            <input
              value={form.address_line1 ?? ""}
              onChange={(e) => setForm((p) => ({ ...p, address_line1: e.target.value }))}
              style={{ width: "100%", padding: 8 }}
            />
          </label>

          <label>
            <div>Address Line 2</div>
            <input
              value={form.address_line2 ?? ""}
              onChange={(e) => setForm((p) => ({ ...p, address_line2: e.target.value }))}
              style={{ width: "100%", padding: 8 }}
            />
          </label>

          <label>
            <div>City</div>
            <input
              value={form.city ?? ""}
              onChange={(e) => setForm((p) => ({ ...p, city: e.target.value }))}
              style={{ width: "100%", padding: 8 }}
            />
          </label>

          <label>
            <div>State</div>
            <input
              value={form.state ?? ""}
              onChange={(e) => setForm((p) => ({ ...p, state: e.target.value }))}
              style={{ width: "100%", padding: 8 }}
            />
          </label>

          <label>
            <div>Postal Code</div>
            <input
              value={form.postal_code ?? ""}
              onChange={(e) => setForm((p) => ({ ...p, postal_code: e.target.value }))}
              style={{ width: "100%", padding: 8 }}
            />
          </label>

          <label>
            <div>Country</div>
            <input
              value={form.country ?? ""}
              onChange={(e) => setForm((p) => ({ ...p, country: e.target.value }))}
              style={{ width: "100%", padding: 8 }}
            />
          </label>

          <label>
            <div>Date Opened</div>
            <input
              type="date"
              value={form.date_opened ?? ""}
              onChange={(e) => setForm((p) => ({ ...p, date_opened: e.target.value }))}
              style={{ width: "100%", padding: 8 }}
            />
          </label>

          <label>
            <div>Sort Order</div>
            <input
              value={String(form.sort_order ?? 0)}
              onChange={(e) => setForm((p) => ({ ...p, sort_order: Number(e.target.value) }))}
              style={{ width: "100%", padding: 8 }}
            />
          </label>

          <label>
            <div>Timezone</div>
            <input
              value={form.timezone ?? ""}
              onChange={(e) => setForm((p) => ({ ...p, timezone: e.target.value }))}
              style={{ width: "100%", padding: 8 }}
            />
          </label>

          <label>
            <div>Status</div>
            <select
              value={form.status}
              onChange={(e) => setForm((p) => ({ ...p, status: e.target.value as StoreRow['status'] }))}
              style={{ width: "100%", padding: 8 }}
            >
              <option value="active">active</option>
              <option value="inactive">inactive</option>
            </select>
          </label>
        </div>

        <div style={{ marginTop: 14, display: "flex", gap: 10 }}>
          <button onClick={() => void save()}>Save</button>
          <button onClick={clear}>Clear / New</button>
        </div>
      </div>
    </div>
  );
}
