import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";

type HubCard = {
  title: string;
  description: string;
  status: "Available" | "Planned" | "Admin";
  to?: string;
};

const cards: HubCard[] = [
  {
    title: "Company Announcements",
    description: "Central feed for chainwide updates, store priorities, event notes, and urgent communication.",
    status: "Planned",
  },
  {
    title: "Store Messages",
    description: "BAND-style communication by company, store, department, role, or project group.",
    status: "Planned",
  },
  {
    title: "Document Library",
    description: "Employee resources, policies, guides, playbooks, training material, and manager references.",
    status: "Planned",
  },
  {
    title: "Tasks",
    description: "Assigned work, due dates, follow-up items, photo proof, and manager review workflows.",
    status: "Planned",
  },
  {
    title: "Department Walks",
    description: "Commercial-grade replacement for walk checklists, reset proof, and store execution tracking.",
    status: "Planned",
  },
  {
    title: "Admin Tools",
    description: "Manage users, stores, and the shared platform foundation.",
    status: "Admin",
    to: "/admin",
  },
];

function StatusBadge({ status }: { status: HubCard["status"] }) {
  return (
    <span
      style={{
        border: "1px solid #d8d8d8",
        borderRadius: 999,
        color: status === "Available" ? "#14532d" : status === "Admin" ? "#111827" : "#6b7280",
        display: "inline-block",
        fontSize: 12,
        fontWeight: 700,
        padding: "3px 8px",
      }}
    >
      {status}
    </span>
  );
}

export default function HomePage() {
  const { profile, user } = useAuth();
  const displayName = profile?.full_name || user?.email || "Team member";
  const isAdmin = profile?.role === "Admin";

  const visibleCards = cards.filter((card) => card.status !== "Admin" || isAdmin);

  return (
    <div style={{ display: "grid", gap: 22 }}>
      <section
        style={{
          background: "linear-gradient(135deg, #111827 0%, #374151 100%)",
          borderRadius: 18,
          color: "white",
          padding: "28px 30px",
        }}
      >
        <div style={{ color: "#d1d5db", fontSize: 14, fontWeight: 700, letterSpacing: 0.8, textTransform: "uppercase" }}>
          Skye ACE Employee Hub
        </div>
        <h1 style={{ fontSize: 34, lineHeight: 1.1, margin: "10px 0 10px" }}>Welcome, {displayName}</h1>
        <p style={{ color: "#e5e7eb", fontSize: 16, margin: 0, maxWidth: 840 }}>
          This hub is being shaped into the operating home for company communication, documents, tasks, department walks, and store execution.
        </p>
      </section>

      <section style={{ display: "grid", gap: 14 }}>
        <div>
          <h2 style={{ margin: "0 0 6px" }}>Current Build Direction</h2>
          <p style={{ color: "#555", margin: 0 }}>
            The near-term goal is a useful employee portal first: communication, resources, assigned work, and photo-backed execution.
          </p>
        </div>

        <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
          {visibleCards.map((card) => {
            const body = (
              <div
                style={{
                  border: "1px solid #e5e7eb",
                  borderRadius: 14,
                  boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
                  minHeight: 150,
                  padding: 18,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginBottom: 10 }}>
                  <h3 style={{ margin: 0 }}>{card.title}</h3>
                  <StatusBadge status={card.to ? "Available" : card.status} />
                </div>
                <p style={{ color: "#4b5563", lineHeight: 1.45, margin: 0 }}>{card.description}</p>
              </div>
            );

            return card.to ? (
              <Link key={card.title} to={card.to} style={{ color: "inherit", textDecoration: "none" }}>
                {body}
              </Link>
            ) : (
              <div key={card.title}>{body}</div>
            );
          })}
        </div>
      </section>

      <section
        style={{
          border: "1px solid #e5e7eb",
          borderRadius: 14,
          padding: 18,
        }}
      >
        <h2 style={{ marginTop: 0 }}>What Comes Next</h2>
        <ol style={{ color: "#374151", lineHeight: 1.7, marginBottom: 0 }}>
          <li>Add route shells for communications, documents, tasks, and department walks.</li>
          <li>Audit the current Supabase schema before adding new tables or writes.</li>
          <li>Build the first database-backed employee module only after the shared data model is confirmed.</li>
        </ol>
      </section>
    </div>
  );
}
