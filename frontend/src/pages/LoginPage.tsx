// frontend/src/pages/LoginPage.tsx
import React, { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

export default function LoginPage() {
  const nav = useNavigate();
  const loc = useLocation() as any;
  const to = loc?.state?.from ?? "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const signIn = async () => {
    try {
      setErr(null);
      setBusy(true);
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      nav(to, { replace: true });
    } catch (e: any) {
      setErr(e?.message ?? "Login failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ maxWidth: 420 }}>
      <h1 style={{ margin: "8px 0 6px" }}>Login</h1>
      <div style={{ color: "#555", marginBottom: 12 }}>Sign in with your company email.</div>

      {err ? <div style={{ color: "crimson", marginBottom: 10 }}>{err}</div> : null}

      <label>
        <div style={{ fontSize: 12, color: "#666" }}>Email</div>
        <input value={email} onChange={(e) => setEmail(e.target.value)} style={{ width: "100%", padding: 10, marginBottom: 10 }} />
      </label>

      <label>
        <div style={{ fontSize: 12, color: "#666" }}>Password</div>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} style={{ width: "100%", padding: 10, marginBottom: 12 }} />
      </label>

      <button
        onClick={signIn}
        disabled={busy}
        style={{ border: "1px solid #ddd", background: "#fff", borderRadius: 10, padding: "10px 14px", cursor: "pointer", fontWeight: 800 }}
      >
        {busy ? "Signing in…" : "Sign in"}
      </button>
    </div>
  );
}
