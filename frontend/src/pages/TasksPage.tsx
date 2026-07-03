export default function TasksPage() {
  return (
    <div style={{ display: "grid", gap: 18 }}>
      <div>
        <h1 style={{ margin: "0 0 8px" }}>Tasks</h1>
        <p style={{ color: "#555", margin: 0, maxWidth: 820 }}>
          Planned task center for store work, due dates, notes, and photo uploads.
        </p>
      </div>

      <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
        <div style={{ border: "1px solid #e5e7eb", borderRadius: 14, padding: 18 }}>
          <h2 style={{ marginTop: 0 }}>Work Queue</h2>
          <p style={{ color: "#4b5563", marginBottom: 0 }}>Store, department, and manager-created work items.</p>
        </div>
        <div style={{ border: "1px solid #e5e7eb", borderRadius: 14, padding: 18 }}>
          <h2 style={{ marginTop: 0 }}>Timing</h2>
          <p style={{ color: "#4b5563", marginBottom: 0 }}>Visibility into current, upcoming, and late work.</p>
        </div>
        <div style={{ border: "1px solid #e5e7eb", borderRadius: 14, padding: 18 }}>
          <h2 style={{ marginTop: 0 }}>Photos</h2>
          <p style={{ color: "#4b5563", marginBottom: 0 }}>Photos and notes for merchandising, resets, and operations.</p>
        </div>
      </div>
    </div>
  );
}
