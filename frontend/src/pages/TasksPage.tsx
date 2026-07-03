import SectionCard from "../components/SectionCard";

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
        <SectionCard title="Work Queue">
          Store, department, and manager-created work items.
        </SectionCard>
        <SectionCard title="Timing">
          Visibility into current, upcoming, and late work.
        </SectionCard>
        <SectionCard title="Photos">
          Photos and notes for merchandising, resets, and operations.
        </SectionCard>
      </div>
    </div>
  );
}
