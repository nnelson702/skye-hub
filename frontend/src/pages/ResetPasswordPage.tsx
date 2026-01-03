import { useState } from "react";
import { supabase } from "../lib/supabaseClient";

export default function ResetPasswordPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const send = async () => {
    setBusy(true);
    setErr(null);
    setMsg(null);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;

      setMsg("Password reset email sent (if the account exists).");
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      setErr(message || "Failed to send reset email.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ maxWidth: 520 }}>
      <h1 style={{ marginTop: 0 }}>Reset Password</h1>

      {err ? <div style={{ color: "crimson", marginBottom: 12 }}>{err}</div> : null}
      {msg ? <div style={{ color: "green", marginBottom: 12 }}>{msg}</div> : null}

      <label>
        <div>Email</div>
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          style={{ width: "100%", padding: 8 }}
        />
      </label>

      <div style={{ marginTop: 12 }}>
        <button disabled={busy} onClick={() => void send()} style={{ padding: "10px 12px" }}>
          {busy ? "Sending…" : "Send reset email"}
        </button>
      </div>
    </div>
  );
}
