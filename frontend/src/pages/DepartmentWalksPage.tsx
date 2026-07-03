import SectionCard from "../components/SectionCard";

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
        <SectionCard title="Walk Templates">
          Repeatable checklists by store, department, or event type.
        </SectionCard>
        <SectionCard title="Photo Uploads">
          Capture completed merchandising, displays, and reset work.
        </SectionCard>
        <SectionCard title="Review">
          Manager review, follow-up notes, and next-step tasks.
        </SectionCard>
      </div>
    </div>
  );
}
