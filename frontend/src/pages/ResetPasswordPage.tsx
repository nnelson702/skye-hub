// frontend/src/pages/ResetPasswordPage.tsx
import React, { useState } from "react";
import { supabase } from "../lib/supabaseClient";

export default function ResetPasswordPage() {
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const send = async () => {
    try {
      setErr(null);
      setMsg(null);
      setBusy(true);
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + "/login",
      });
      if (error) throw error;
      setMsg("Password reset email sent.");
    } catch (e: any) {
      setErr(e?.message ?? "Failed to send reset email.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ maxWidth: 520 }}>
      <h1 style={{ margin: "8px 0 6px" }}>Reset Password</h1>
      {err ? <div style={{ color: "crimson", marginBottom: 10 }}>{err}</div> : null}
      {msg ? <div style={{ color: "green", marginBottom: 10 }}>{msg}</div> : null}

      <label>
        <div style={{ fontSize: 12, color: "#666" }}>Email</div>
        <input value={email} onChange={(e) => setEmail(e.target.value)} style={{ width: "100%", padding: 10, marginBottom: 12 }} />
      </label>

      <button
        onClick={send}
        disabled={busy}
        style={{ border: "1px solid #ddd", background: "#fff", borderRadius: 10, padding: "10px 14px", cursor: "pointer", fontWeight: 800 }}
      >
        {busy ? "Sending…" : "Send reset email"}
      </button>
    </div>
  );
}
