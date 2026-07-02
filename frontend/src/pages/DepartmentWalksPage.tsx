export default function DepartmentWalksPage() {
  return (
    <div style={{ display: "grid", gap: 18 }}>
      <div>
        <h1 style={{ margin: "0 0 8px" }}>Department Walks</h1>
        <p style={{ color: "#555", margin: 0, maxWidth: 820 }}>
          Planned store execution tool for department walks, reset checks, notes, photos, and manager review.
        </p>
      </div>

      <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
        <div style={{ border: "1px solid #e5e7eb", borderRadius: 14, padding: 18 }}>
          <h2 style={{ marginTop: 0 }}>Walk Templates</h2>
          <p style={{ color: "#4b5563", marginBottom: 0 }}>Repeatable checklists by store, department, or event type.</p>
        </div>
        <div style={{ border: "1px solid #e5e7eb", borderRadius: 14, padding: 18 }}>
          <h2 style={{ marginTop: 0 }}>Photo Uploads</h2>
          <p style={{ color: "#4b5563", marginBottom: 0 }}>Capture completed merchandising, displays, and reset work.</p>
        </div>
        <div style={{ border: "1px solid #e5e7eb", borderRadius: 14, padding: 18 }}>
          <h2 style={{ marginTop: 0 }}>Review</h2>
          <p style={{ color: "#4b5563", marginBottom: 0 }}>Manager review, follow-up notes, and next-step tasks.</p>
        </div>
      </div>
    </div>
  );
}
