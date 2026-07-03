export default function CommunicationsPage() {
  return (
    <div style={{ display: "grid", gap: 18 }}>
      <div>
        <h1 style={{ margin: "0 0 8px" }}>Communications</h1>
        <p style={{ color: "#555", margin: 0, maxWidth: 820 }}>
          Planned BAND-style communication center for company announcements, store groups, department threads, role-based messages, pinned posts, and future push notifications.
        </p>
      </div>

      <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
        <div style={{ border: "1px solid #e5e7eb", borderRadius: 14, padding: 18 }}>
          <h2 style={{ marginTop: 0 }}>Company Announcements</h2>
          <p style={{ color: "#4b5563", marginBottom: 0 }}>Chainwide updates, urgent notices, and leadership communication.</p>
        </div>
        <div style={{ border: "1px solid #e5e7eb", borderRadius: 14, padding: 18 }}>
          <h2 style={{ marginTop: 0 }}>Store Groups</h2>
          <p style={{ color: "#4b5563", marginBottom: 0 }}>Store-specific discussion and execution notes.</p>
        </div>
        <div style={{ border: "1px solid #e5e7eb", borderRadius: 14, padding: 18 }}>
          <h2 style={{ marginTop: 0 }}>Department Groups</h2>
          <p style={{ color: "#4b5563", marginBottom: 0 }}>Department-level guidance, priorities, resets, and follow-up.</p>
        </div>
      </div>

      <section style={{ border: "1px solid #e5e7eb", borderRadius: 14, padding: 18 }}>
        <h2 style={{ marginTop: 0 }}>Build Notes</h2>
        <ul style={{ color: "#374151", lineHeight: 1.7, marginBottom: 0 }}>
          <li>Start with structured posts and groups, not open-ended chat.</li>
          <li>Add comments, attachments, pinned posts, and priority levels before read receipts.</li>
          <li>Use the future mobile app for push alerts after the web model is stable.</li>
        </ul>
      </section>
    </div>
  );
}
