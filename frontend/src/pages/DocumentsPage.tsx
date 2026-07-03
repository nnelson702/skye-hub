import SectionCard from "../components/SectionCard";

export default function DocumentsPage() {
  return (
    <div style={{ display: "grid", gap: 18 }}>
      <div>
        <h1 style={{ margin: "0 0 8px" }}>Document Library</h1>
        <p style={{ color: "#555", margin: 0, maxWidth: 820 }}>
          Planned employee resource library for guides, playbooks, event instructions, department references, and training material.
        </p>
      </div>

      <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
        <SectionCard title="Operations">
          Store procedures, department guides, and daily execution references.
        </SectionCard>
        <SectionCard title="Events & Promotions">
          Event playbooks, promo instructions, signage kits, and execution timelines.
        </SectionCard>
        <SectionCard title="Training">
          Onboarding, department readiness, and vendor resources.
        </SectionCard>
      </div>
    </div>
  );
}
