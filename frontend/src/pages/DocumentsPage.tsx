export default function DocumentsPage() {
  return (
    <div style={{ display: "grid", gap: 18 }}>
      <div>
        <h1 style={{ margin: "0 0 8px" }}>Document Library</h1>
        <p style={{ color: "#555", margin: 0, maxWidth: 820 }}>
          Planned employee resource library for policies, guides, playbooks, event instructions, department references, and training material.
        </p>
      </div>

      <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
        <div style={{ border: "1px solid #e5e7eb", borderRadius: 14, padding: 18 }}>
          <h2 style={{ marginTop: 0 }}>Operations</h2>
          <p style={{ color: "#4b5563", marginBottom: 0 }}>Store procedures, department guides, return standards, and daily execution references.</p>
        </div>
        <div style={{ border: "1px solid #e5e7eb", borderRadius: 14, padding: 18 }}>
          <h2 style={{ marginTop: 0 }}>Events & Promotions</h2>
          <p style={{ color: "#4b5563", marginBottom: 0 }}>Event playbooks, promo instructions, signage kits, and execution timelines.</p>
        </div>
        <div style={{ border: "1px solid #e5e7eb", borderRadius: 14, padding: 18 }}>
          <h2 style={{ marginTop: 0 }}>Training</h2>
          <p style={{ color: "#4b5563", marginBottom: 0 }}>Onboarding, department readiness, vendor resources, and required reading later.</p>
        </div>
      </div>
    </div>
  );
}
