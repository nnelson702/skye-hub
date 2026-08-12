import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { formatError } from "../lib/errors";
import { showError, showSuccess } from "../lib/toast";

type Store = { id: string; store_name: string; ace_store_number: string; status: string };
type Assignee = { id: string; full_name: string | null; email: string | null };
type Task = {
  id: string;
  store_id: string;
  title: string;
  description: string | null;
  status: "open" | "in_progress" | "completed" | "cancelled";
  priority: "low" | "normal" | "high";
  assigned_to: string | null;
  source_type: "manual" | "walk_question" | "observation";
  created_at: string;
};

const sourceLabel = (source: Task["source_type"]) => {
  if (source === "walk_question") return "Department Walk";
  if (source === "observation") return "Observation";
  return "Manual";
};

export default function TasksPage() {
  const [stores, setStores] = useState<Store[]>([]);
  const [storeId, setStoreId] = useState("");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [assignees, setAssignees] = useState<Assignee[]>([]);
  const [showCompleted, setShowCompleted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("stores")
          .select("id, store_name, ace_store_number, status")
          .eq("status", "active")
          .order("sort_order");
        if (error) throw error;
        const rows = (data ?? []) as Store[];
        setStores(rows);
        if (rows[0]) setStoreId(rows[0].id);
      } catch (e) {
        setErr(formatError(e) || "Unable to load stores.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const loadTasks = async (nextStoreId: string) => {
    if (!nextStoreId) return;
    setErr(null);
    const [taskResult, assigneeResult] = await Promise.all([
      supabase
        .from("tasks")
        .select("id, store_id, title, description, status, priority, assigned_to, source_type, created_at")
        .eq("store_id", nextStoreId)
        .neq("status", "cancelled")
        .order("created_at", { ascending: false }),
      supabase.rpc("store_task_assignees", { target_store_id: nextStoreId }),
    ]);
    if (taskResult.error) throw taskResult.error;
    if (assigneeResult.error) throw assigneeResult.error;
    setTasks((taskResult.data ?? []) as Task[]);
    setAssignees((assigneeResult.data ?? []) as Assignee[]);
  };

  useEffect(() => {
    if (!storeId) return;
    void loadTasks(storeId).catch((e) => setErr(formatError(e) || "Unable to load the task pool. Apply the Department Walks migrations first if the task model has not been deployed yet."));
  }, [storeId]);

  const visibleTasks = useMemo(
    () => tasks.filter((task) => showCompleted || task.status !== "completed"),
    [tasks, showCompleted]
  );

  const updateTask = async (taskId: string, changes: Partial<Pick<Task, "status" | "assigned_to" | "priority">>) => {
    const payload: Record<string, unknown> = { ...changes, updated_at: new Date().toISOString() };
    if (changes.status === "completed") payload.completed_at = new Date().toISOString();
    if (changes.status && changes.status !== "completed") payload.completed_at = null;
    const { error } = await supabase.from("tasks").update(payload).eq("id", taskId);
    if (error) return showError(formatError(error));
    setTasks((previous) => previous.map((task) => task.id === taskId ? { ...task, ...changes } : task));
    showSuccess("Task updated.");
  };

  if (loading) return <div>Loading…</div>;

  return (
    <div style={{ display: "grid", gap: 18, maxWidth: 1150 }}>
      <div>
        <h1 style={{ margin: "0 0 6px" }}>Task Pool</h1>
        <p style={{ color: "#555", margin: 0 }}>Shared store work generated from department walks, observations, and manager-created tasks.</p>
      </div>

      {err ? <div style={{ padding: 12, border: "1px solid #f0b4b4", background: "#fff6f6", borderRadius: 8 }}>{err}</div> : null}

      <div style={{ display: "flex", gap: 16, alignItems: "end", flexWrap: "wrap" }}>
        <label style={{ minWidth: 280 }}>
          <div style={{ fontWeight: 700, marginBottom: 5 }}>Store</div>
          <select value={storeId} onChange={(e) => setStoreId(e.target.value)} style={{ width: "100%", padding: 10 }}>
            {stores.map((store) => <option key={store.id} value={store.id}>{store.store_name} · ACE {store.ace_store_number}</option>)}
          </select>
        </label>
        <label style={{ display: "flex", gap: 8, alignItems: "center", paddingBottom: 9 }}>
          <input type="checkbox" checked={showCompleted} onChange={(e) => setShowCompleted(e.target.checked)} />
          Show completed
        </label>
      </div>

      <div style={{ display: "grid", gap: 10 }}>
        {visibleTasks.map((task) => {
          const assigned = assignees.find((person) => person.id === task.assigned_to);
          return (
            <article key={task.id} style={{ border: "1px solid #ddd", borderRadius: 12, padding: 14, display: "grid", gap: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "start" }}>
                <div>
                  <div style={{ fontSize: 17, fontWeight: 800 }}>{task.title}</div>
                  {task.description ? <div style={{ color: "#555", marginTop: 4 }}>{task.description}</div> : null}
                </div>
                <div style={{ fontSize: 12, border: "1px solid #ddd", borderRadius: 999, padding: "4px 8px", whiteSpace: "nowrap" }}>{sourceLabel(task.source_type)}</div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "minmax(220px, 1fr) minmax(150px, 220px) minmax(150px, 220px)", gap: 10 }}>
                <label>
                  <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Assigned To</div>
                  <select value={task.assigned_to ?? ""} onChange={(e) => void updateTask(task.id, { assigned_to: e.target.value || null })} style={{ width: "100%", padding: 8 }}>
                    <option value="">Unassigned / Task Pool</option>
                    {assignees.map((person) => <option key={person.id} value={person.id}>{person.full_name || person.email || "User"}</option>)}
                  </select>
                  {task.assigned_to && !assigned ? <div style={{ color: "#777", fontSize: 12, marginTop: 3 }}>Assigned user no longer has store access.</div> : null}
                </label>

                <label>
                  <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Priority</div>
                  <select value={task.priority} onChange={(e) => void updateTask(task.id, { priority: e.target.value as Task["priority"] })} style={{ width: "100%", padding: 8 }}>
                    <option value="low">Low</option>
                    <option value="normal">Normal</option>
                    <option value="high">High</option>
                  </select>
                </label>

                <label>
                  <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Status</div>
                  <select value={task.status} onChange={(e) => void updateTask(task.id, { status: e.target.value as Task["status"] })} style={{ width: "100%", padding: 8 }}>
                    <option value="open">Open</option>
                    <option value="in_progress">In Progress</option>
                    <option value="completed">Completed</option>
                  </select>
                </label>
              </div>
            </article>
          );
        })}
        {!visibleTasks.length ? <div style={{ border: "1px dashed #ccc", borderRadius: 12, padding: 24, color: "#666" }}>No tasks in this view.</div> : null}
      </div>
    </div>
  );
}
