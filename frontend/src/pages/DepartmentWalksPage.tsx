import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth/AuthProvider";
import { supabase } from "../lib/supabaseClient";
import { formatError } from "../lib/errors";
import { showError, showSuccess } from "../lib/toast";

type Store = { id: string; store_name: string; ace_store_number: string; pos_store_number: string; status: string };
type Department = { id: string; store_id: string; name: string; status: string; sort_order: number };
type Question = { id: string; question_text: string; sort_order: number };
type Walk = { id: string; store_id: string; department_id: string; status: "questions" | "observations" | "completed" };
type Result = "standards_met" | "needs_attention" | "na";
type ResponseMap = Record<string, Result>;
type Mode = "home" | "walk" | "observation";

const EVENT_TYPES = [
  "Safety",
  "Merchandising / Presentation",
  "Inventory / Outs",
  "Pricing / Signage",
  "Cleanliness",
  "Customer Experience",
  "Maintenance",
  "Other",
];

const firstDayOfCurrentMonth = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
};

export default function DepartmentWalksPage() {
  const auth = useAuth();
  const [mode, setMode] = useState<Mode>("home");
  const [stores, setStores] = useState<Store[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [storeId, setStoreId] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [walk, setWalk] = useState<Walk | null>(null);
  const [responses, setResponses] = useState<ResponseMap>({});
  const [eventType, setEventType] = useState(EVENT_TYPES[0]);
  const [notes, setNotes] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [createTask, setCreateTask] = useState(false);
  const [taskTitle, setTaskTitle] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!auth.authReady || !auth.user) return;
    void (async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("stores")
          .select("id, store_name, ace_store_number, pos_store_number, status")
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
  }, [auth.authReady, auth.user]);

  useEffect(() => {
    if (!storeId) return;
    void (async () => {
      try {
        const { data, error } = await supabase
          .from("departments")
          .select("id, store_id, name, status, sort_order")
          .eq("store_id", storeId)
          .eq("status", "active")
          .order("sort_order");
        if (error) throw error;
        const rows = (data ?? []) as Department[];
        setDepartments(rows);
        setDepartmentId(rows[0]?.id ?? "");
      } catch (e) {
        setDepartments([]);
        setDepartmentId("");
        setErr(formatError(e) || "Unable to load departments. Department Walk setup may still need to be deployed.");
      }
    })();
  }, [storeId]);

  const selectedStore = useMemo(() => stores.find((store) => store.id === storeId) ?? null, [stores, storeId]);
  const selectedDepartment = useMemo(() => departments.find((department) => department.id === departmentId) ?? null, [departments, departmentId]);
  const answeredCount = Object.keys(responses).length;
  const allAnswered = questions.length > 0 && answeredCount === questions.length;

  const loadWalkResponses = async (walkId: string) => {
    const { data, error } = await supabase.from("department_walk_responses").select("question_id, result").eq("walk_id", walkId);
    if (error) throw error;
    const next: ResponseMap = {};
    for (const row of data ?? []) if (row.question_id) next[row.question_id as string] = row.result as Result;
    setResponses(next);
  };

  const startWalk = async () => {
    if (!auth.user || !storeId || !departmentId) return;
    setSaving(true);
    setErr(null);
    try {
      const { data: questionRows, error: questionError } = await supabase
        .from("department_walk_questions")
        .select("id, question_text, sort_order")
        .eq("store_id", storeId)
        .eq("department_id", departmentId)
        .eq("status", "active")
        .order("sort_order");
      if (questionError) throw questionError;
      const activeQuestions = (questionRows ?? []) as Question[];
      if (!activeQuestions.length) throw new Error("No active walk questions are configured for this store and department.");

      const walkMonth = firstDayOfCurrentMonth();
      const { data: existingWalk, error: existingError } = await supabase
        .from("department_walks")
        .select("id, store_id, department_id, status")
        .eq("store_id", storeId)
        .eq("department_id", departmentId)
        .eq("walk_month", walkMonth)
        .maybeSingle();
      if (existingError) throw existingError;

      let currentWalk = existingWalk as Walk | null;
      if (!currentWalk) {
        const { data: created, error: createError } = await supabase
          .from("department_walks")
          .insert({ store_id: storeId, department_id: departmentId, walk_month: walkMonth, started_by: auth.user.id })
          .select("id, store_id, department_id, status")
          .single();
        if (createError) throw createError;
        currentWalk = created as Walk;
      }

      setQuestions(activeQuestions);
      setWalk(currentWalk);
      await loadWalkResponses(currentWalk.id);
      setMode(currentWalk.status === "questions" ? "walk" : "observation");
    } catch (e) {
      setErr(formatError(e) || "Unable to start the department walk.");
    } finally {
      setSaving(false);
    }
  };

  const answerQuestion = async (question: Question, result: Result) => {
    if (!auth.user || !walk) return;
    setSaving(true);
    setErr(null);
    try {
      const { data: response, error } = await supabase
        .from("department_walk_responses")
        .upsert({
          walk_id: walk.id,
          question_id: question.id,
          question_text_snapshot: question.question_text,
          result,
          answered_by: auth.user.id,
          answered_at: new Date().toISOString(),
        }, { onConflict: "walk_id,question_id" })
        .select("id")
        .single();
      if (error) throw error;

      if (result === "needs_attention") {
        const { data: existingTask, error: taskLookupError } = await supabase
          .from("tasks")
          .select("id")
          .eq("source_type", "walk_question")
          .eq("source_id", response.id)
          .neq("status", "cancelled")
          .maybeSingle();
        if (taskLookupError) throw taskLookupError;
        if (!existingTask) {
          const { error: taskError } = await supabase.from("tasks").insert({
            store_id: walk.store_id,
            department_id: walk.department_id,
            title: question.question_text,
            description: `Created automatically from a Needs Attention response during the monthly ${selectedDepartment?.name ?? "department"} walk.`,
            source_type: "walk_question",
            source_id: response.id,
            created_by: auth.user.id,
          });
          if (taskError) throw taskError;
        }
      } else {
        const { error: cancelError } = await supabase
          .from("tasks")
          .update({ status: "cancelled", updated_at: new Date().toISOString() })
          .eq("source_type", "walk_question")
          .eq("source_id", response.id)
          .in("status", ["open", "in_progress"]);
        if (cancelError) throw cancelError;
      }

      setResponses((previous) => ({ ...previous, [question.id]: result }));
    } catch (e) {
      showError(formatError(e) || "Unable to save response.");
    } finally {
      setSaving(false);
    }
  };

  const advanceToObservations = async () => {
    if (!walk || !allAnswered) return;
    const { error } = await supabase.from("department_walks").update({ status: "observations", updated_at: new Date().toISOString() }).eq("id", walk.id);
    if (error) return showError(formatError(error));
    setWalk({ ...walk, status: "observations" });
    setMode("observation");
  };

  const saveObservation = async () => {
    if (!auth.user || !storeId || !eventType) return;
    setSaving(true);
    setErr(null);
    try {
      let imagePath: string | null = null;
      if (image) {
        const extension = image.name.split(".").pop() || "jpg";
        const path = `${storeId}/${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.${extension}`;
        const { error: uploadError } = await supabase.storage.from("walk-images").upload(path, image, { upsert: false });
        if (uploadError) throw uploadError;
        imagePath = path;
      }

      const { data: observation, error: observationError } = await supabase
        .from("department_walk_observations")
        .insert({
          walk_id: walk?.id ?? null,
          store_id: storeId,
          department_id: departmentId || null,
          event_type: eventType,
          notes: notes.trim() || null,
          image_path: imagePath,
          logged_by: auth.user.id,
        })
        .select("id")
        .single();
      if (observationError) throw observationError;

      if (createTask) {
        const title = taskTitle.trim() || `${eventType} follow-up`;
        const { data: task, error: taskError } = await supabase
          .from("tasks")
          .insert({
            store_id: storeId,
            department_id: departmentId || null,
            title,
            description: notes.trim() || `Follow-up created from ${eventType} observation.`,
            source_type: "observation",
            source_id: observation.id,
            created_by: auth.user.id,
          })
          .select("id")
          .single();
        if (taskError) throw taskError;
        const { error: linkError } = await supabase.from("department_walk_observations").update({ task_id: task.id }).eq("id", observation.id);
        if (linkError) throw linkError;
      }

      setNotes("");
      setImage(null);
      setCreateTask(false);
      setTaskTitle("");
      showSuccess("Observation logged.");
    } catch (e) {
      setErr(formatError(e) || "Unable to log observation.");
    } finally {
      setSaving(false);
    }
  };

  const completeWalk = async () => {
    if (!walk) return setMode("home");
    const { error } = await supabase
      .from("department_walks")
      .update({ status: "completed", completed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", walk.id);
    if (error) return showError(formatError(error));
    showSuccess("Monthly department walk completed.");
    setWalk(null);
    setQuestions([]);
    setResponses({});
    setMode("home");
  };

  if (loading) return <div>Loading…</div>;

  const selector = (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(220px, 1fr) minmax(220px, 1fr)", gap: 12 }}>
      <label>
        <div style={{ fontWeight: 700, marginBottom: 5 }}>Store</div>
        <select value={storeId} onChange={(e) => setStoreId(e.target.value)} style={{ width: "100%", padding: 10 }}>
          {stores.map((store) => <option key={store.id} value={store.id}>{store.store_name} · {store.pos_store_number}</option>)}
        </select>
      </label>
      <label>
        <div style={{ fontWeight: 700, marginBottom: 5 }}>Department</div>
        <select value={departmentId} onChange={(e) => setDepartmentId(e.target.value)} style={{ width: "100%", padding: 10 }}>
          {departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
        </select>
      </label>
    </div>
  );

  return (
    <div style={{ display: "grid", gap: 18, maxWidth: 1100 }}>
      <div>
        <h1 style={{ margin: "0 0 6px" }}>Department Walks</h1>
        <p style={{ color: "#555", margin: 0 }}>Complete the monthly prescribed walk or log an observation as you see it.</p>
      </div>

      {err ? <div style={{ padding: 12, border: "1px solid #f0b4b4", background: "#fff6f6", borderRadius: 8 }}>{err}</div> : null}

      {mode === "home" ? (
        <>
          {selector}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 16 }}>
            <button
              onClick={() => void startWalk()}
              disabled={!storeId || !departmentId || saving}
              style={{ textAlign: "left", padding: 22, minHeight: 180, borderRadius: 14, border: "2px solid #222", background: "white", cursor: "pointer" }}
            >
              <div style={{ fontSize: 23, fontWeight: 800, marginBottom: 8 }}>Start Monthly Department Walk</div>
              <div style={{ color: "#555", lineHeight: 1.5 }}>Complete the prescribed standards questions for this store and department. Any “Needs Attention” answer automatically becomes a task.</div>
            </button>
            <button
              onClick={() => setMode("observation")}
              disabled={!storeId}
              style={{ textAlign: "left", padding: 22, minHeight: 180, borderRadius: 14, border: "2px solid #222", background: "white", cursor: "pointer" }}
            >
              <div style={{ fontSize: 23, fontWeight: 800, marginBottom: 8 }}>Log Observation / Event</div>
              <div style={{ color: "#555", lineHeight: 1.5 }}>Capture something you see in the store with an event type, photo, notes, and an optional follow-up task.</div>
            </button>
          </div>
        </>
      ) : null}

      {mode === "walk" && walk ? (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
            <div>
              <h2 style={{ margin: 0 }}>{selectedDepartment?.name} Monthly Walk</h2>
              <div style={{ color: "#666", marginTop: 4 }}>{selectedStore?.store_name} · {answeredCount} of {questions.length} answered</div>
            </div>
            <button onClick={() => setMode("home")}>Exit</button>
          </div>
          <div style={{ display: "grid", gap: 10 }}>
            {questions.map((question, index) => (
              <div key={question.id} style={{ border: "1px solid #ddd", borderRadius: 12, padding: 14, display: "grid", gap: 12 }}>
                <div style={{ fontWeight: 750 }}>{index + 1}. {question.question_text}</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
                  {([
                    ["standards_met", "Standards Met"],
                    ["needs_attention", "Needs Attention"],
                    ["na", "N/A"],
                  ] as [Result, string][]).map(([value, label]) => (
                    <button
                      key={value}
                      disabled={saving}
                      onClick={() => void answerQuestion(question, value)}
                      style={{ padding: 11, fontWeight: responses[question.id] === value ? 800 : 500, border: responses[question.id] === value ? "2px solid #111" : "1px solid #ccc", borderRadius: 8 }}
                    >{label}</button>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <button disabled={!allAnswered || saving} onClick={() => void advanceToObservations()} style={{ padding: 14, fontWeight: 800 }}>
            {allAnswered ? "Continue to Observations" : `Answer ${questions.length - answeredCount} Remaining Question${questions.length - answeredCount === 1 ? "" : "s"}`}
          </button>
        </>
      ) : null}

      {mode === "observation" ? (
        <section style={{ display: "grid", gap: 14, border: "1px solid #ddd", borderRadius: 14, padding: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
            <div>
              <h2 style={{ margin: 0 }}>Log Observation / Event</h2>
              <div style={{ color: "#666", marginTop: 4 }}>{selectedStore?.store_name}{selectedDepartment ? ` · ${selectedDepartment.name}` : ""}</div>
            </div>
            <button onClick={() => setMode("home")}>Back</button>
          </div>

          {!walk ? selector : null}

          <label>
            <div style={{ fontWeight: 700, marginBottom: 5 }}>Event Type</div>
            <select value={eventType} onChange={(e) => setEventType(e.target.value)} style={{ width: "100%", padding: 10 }}>
              {EVENT_TYPES.map((type) => <option key={type}>{type}</option>)}
            </select>
          </label>

          <label>
            <div style={{ fontWeight: 700, marginBottom: 5 }}>Photo</div>
            <input type="file" accept="image/*" capture="environment" onChange={(e) => setImage(e.target.files?.[0] ?? null)} />
          </label>

          <label>
            <div style={{ fontWeight: 700, marginBottom: 5 }}>Notes</div>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={5} placeholder="What did you observe? Add the detail someone will need later." style={{ width: "100%", padding: 10, resize: "vertical" }} />
          </label>

          <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input type="checkbox" checked={createTask} onChange={(e) => setCreateTask(e.target.checked)} />
            <span><strong>Create a task</strong> from this observation</span>
          </label>

          {createTask ? (
            <label>
              <div style={{ fontWeight: 700, marginBottom: 5 }}>Task Title</div>
              <input value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} placeholder={`${eventType} follow-up`} style={{ width: "100%", padding: 10 }} />
            </label>
          ) : null}

          <div style={{ display: "flex", gap: 10 }}>
            <button disabled={saving || !storeId} onClick={() => void saveObservation()} style={{ padding: "11px 18px", fontWeight: 800 }}>Log Observation</button>
            {walk ? <button disabled={saving} onClick={() => void completeWalk()} style={{ padding: "11px 18px" }}>Complete Monthly Walk</button> : null}
          </div>
        </section>
      ) : null}
    </div>
  );
}
