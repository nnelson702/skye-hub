import SectionCard from "../components/SectionCard";

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
        <SectionCard title="Company Announcements">
          Chainwide updates, urgent notices, and leadership communication.
        </SectionCard>
        <SectionCard title="Store Groups">
          Store-specific discussion and execution notes.
        </SectionCard>
        <SectionCard title="Department Groups">
          Department-level guidance, priorities, resets, and follow-up.
        </SectionCard>
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
