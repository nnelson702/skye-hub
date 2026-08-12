import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { formatError } from "../lib/errors";
import { showError, showSuccess } from "../lib/toast";

type Store = { id: string; store_name: string; ace_store_number: string; status: string };
type Department = { id: string; store_id: string; name: string; sort_order: number; status: string };
type Question = { id: string; store_id: string; department_id: string; question_text: string; sort_order: number; status: string };

export default function AdminWalkQuestionsPage() {
  const [stores, setStores] = useState<Store[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [storeId, setStoreId] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [newDepartment, setNewDepartment] = useState("");
  const [newQuestion, setNewQuestion] = useState("");
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const loadStores = async () => {
    const { data, error } = await supabase
      .from("stores")
      .select("id, store_name, ace_store_number, status")
      .eq("status", "active")
      .order("sort_order", { ascending: true });
    if (error) throw error;
    const rows = (data ?? []) as Store[];
    setStores(rows);
    if (!storeId && rows[0]) setStoreId(rows[0].id);
  };

  const loadConfiguration = async (nextStoreId: string) => {
    if (!nextStoreId) return;
    const [{ data: departmentRows, error: departmentError }, { data: questionRows, error: questionError }] = await Promise.all([
      supabase.from("departments").select("id, store_id, name, sort_order, status").eq("store_id", nextStoreId).order("sort_order"),
      supabase.from("department_walk_questions").select("id, store_id, department_id, question_text, sort_order, status").eq("store_id", nextStoreId).order("sort_order"),
    ]);
    if (departmentError) throw departmentError;
    if (questionError) throw questionError;
    const nextDepartments = (departmentRows ?? []) as Department[];
    setDepartments(nextDepartments);
    setQuestions((questionRows ?? []) as Question[]);
    if (!nextDepartments.some((d) => d.id === departmentId)) setDepartmentId(nextDepartments[0]?.id ?? "");
  };

  useEffect(() => {
    void (async () => {
      setLoading(true);
      try {
        await loadStores();
      } catch (e) {
        setErr(formatError(e) || "Unable to load stores.");
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!storeId) return;
    void (async () => {
      setErr(null);
      try {
        await loadConfiguration(storeId);
      } catch (e) {
        setErr(formatError(e) || "Unable to load department walk configuration. Apply the Department Walks migration first if these tables do not exist yet.");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId]);

  const selectedQuestions = useMemo(
    () => questions.filter((q) => q.department_id === departmentId).sort((a, b) => a.sort_order - b.sort_order),
    [questions, departmentId]
  );

  const addDepartment = async () => {
    const name = newDepartment.trim();
    if (!storeId || !name) return;
    setErr(null);
    const { error } = await supabase.from("departments").insert({ store_id: storeId, name, sort_order: departments.length + 1 });
    if (error) return setErr(formatError(error));
    setNewDepartment("");
    await loadConfiguration(storeId);
    showSuccess(`Department added: ${name}`);
  };

  const addQuestion = async () => {
    const questionText = newQuestion.trim();
    if (!storeId || !departmentId || !questionText) return;
    setErr(null);
    const { error } = await supabase.from("department_walk_questions").insert({
      store_id: storeId,
      department_id: departmentId,
      question_text: questionText,
      sort_order: selectedQuestions.length + 1,
    });
    if (error) return setErr(formatError(error));
    setNewQuestion("");
    await loadConfiguration(storeId);
    showSuccess("Walk question added.");
  };

  const saveQuestion = async (id: string) => {
    const text = editingText.trim();
    if (!text) return;
    const { error } = await supabase.from("department_walk_questions").update({ question_text: text, updated_at: new Date().toISOString() }).eq("id", id);
    if (error) return showError(formatError(error));
    setEditingQuestionId(null);
    setEditingText("");
    await loadConfiguration(storeId);
    showSuccess("Walk question updated.");
  };

  const toggleQuestion = async (question: Question) => {
    const nextStatus = question.status === "active" ? "inactive" : "active";
    const { error } = await supabase.from("department_walk_questions").update({ status: nextStatus, updated_at: new Date().toISOString() }).eq("id", question.id);
    if (error) return showError(formatError(error));
    await loadConfiguration(storeId);
  };

  const moveQuestion = async (index: number, direction: -1 | 1) => {
    const otherIndex = index + direction;
    if (otherIndex < 0 || otherIndex >= selectedQuestions.length) return;
    const current = selectedQuestions[index];
    const other = selectedQuestions[otherIndex];
    const [{ error: firstError }, { error: secondError }] = await Promise.all([
      supabase.from("department_walk_questions").update({ sort_order: other.sort_order }).eq("id", current.id),
      supabase.from("department_walk_questions").update({ sort_order: current.sort_order }).eq("id", other.id),
    ]);
    if (firstError || secondError) return showError(formatError(firstError ?? secondError));
    await loadConfiguration(storeId);
  };

  if (loading) return <div>Loading…</div>;

  return (
    <div style={{ display: "grid", gap: 18, maxWidth: 1100 }}>
      <div>
        <Link to="/admin">← Admin Tools</Link>
        <h1 style={{ marginBottom: 6 }}>Department Walk Questions</h1>
        <p style={{ marginTop: 0, color: "#555" }}>Customize the monthly walk by store and department. Changes affect future walks only; completed walk wording is snapshotted.</p>
      </div>

      {err ? <div style={{ padding: 12, border: "1px solid #f0b4b4", background: "#fff6f6", borderRadius: 8 }}>{err}</div> : null}

      <section style={{ border: "1px solid #ddd", borderRadius: 12, padding: 16, display: "grid", gap: 14 }}>
        <div style={{ display: "grid", gridTemplateColumns: "minmax(240px, 1fr) minmax(240px, 1fr)", gap: 12 }}>
          <label>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>Store</div>
            <select value={storeId} onChange={(e) => setStoreId(e.target.value)} style={{ width: "100%", padding: 10 }}>
              {stores.map((store) => <option key={store.id} value={store.id}>{store.store_name} · ACE {store.ace_store_number}</option>)}
            </select>
          </label>
          <label>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>Department</div>
            <select value={departmentId} onChange={(e) => setDepartmentId(e.target.value)} style={{ width: "100%", padding: 10 }}>
              {departments.map((department) => <option key={department.id} value={department.id}>{department.name}{department.status !== "active" ? " (inactive)" : ""}</option>)}
            </select>
          </label>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <input value={newDepartment} onChange={(e) => setNewDepartment(e.target.value)} placeholder="Add department" style={{ flex: 1, padding: 10 }} />
          <button onClick={() => void addDepartment()}>Add Department</button>
        </div>
      </section>

      <section style={{ border: "1px solid #ddd", borderRadius: 12, padding: 16, display: "grid", gap: 12 }}>
        <div>
          <h2 style={{ margin: 0 }}>Prescribed Questions</h2>
          <p style={{ color: "#666", margin: "5px 0 0" }}>These appear in order during the monthly department walk.</p>
        </div>
        {!departmentId ? <div style={{ color: "#666" }}>Add or select a department first.</div> : null}
        {selectedQuestions.map((question, index) => (
          <div key={question.id} style={{ border: "1px solid #eee", borderRadius: 10, padding: 12, opacity: question.status === "active" ? 1 : 0.55 }}>
            {editingQuestionId === question.id ? (
              <div style={{ display: "flex", gap: 8 }}>
                <input value={editingText} onChange={(e) => setEditingText(e.target.value)} style={{ flex: 1, padding: 9 }} />
                <button onClick={() => void saveQuestion(question.id)}>Save</button>
                <button onClick={() => setEditingQuestionId(null)}>Cancel</button>
              </div>
            ) : (
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <strong style={{ minWidth: 30 }}>{index + 1}.</strong>
                <div style={{ flex: 1 }}>{question.question_text}</div>
                <button disabled={index === 0} onClick={() => void moveQuestion(index, -1)}>↑</button>
                <button disabled={index === selectedQuestions.length - 1} onClick={() => void moveQuestion(index, 1)}>↓</button>
                <button onClick={() => { setEditingQuestionId(question.id); setEditingText(question.question_text); }}>Edit</button>
                <button onClick={() => void toggleQuestion(question)}>{question.status === "active" ? "Disable" : "Enable"}</button>
              </div>
            )}
          </div>
        ))}
        {departmentId ? (
          <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
            <input value={newQuestion} onChange={(e) => setNewQuestion(e.target.value)} placeholder="Add a prescribed walk question" style={{ flex: 1, padding: 10 }} />
            <button onClick={() => void addQuestion()}>Add Question</button>
          </div>
        ) : null}
      </section>
    </div>
  );
}
