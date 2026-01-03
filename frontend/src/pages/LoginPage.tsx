import { useMemo, useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../auth/AuthProvider";

export default function LoginPage() {
  const nav = useNavigate();
  type LocationState = { from?: string };
  const loc = useLocation() as { state?: LocationState };
  const { user } = useAuth();

  const from = useMemo(() => loc?.state?.from ?? "/", [loc]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (user) {
    // Already signed in
    nav(from, { replace: true });
  }

  const signIn = async () => {
    setBusy(true);
    setErr(null);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) throw error;
      nav(from, { replace: true });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      setErr(message || "Sign-in failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ maxWidth: 520 }}>
      <h1 style={{ marginTop: 0 }}>Login</h1>

      {err ? <div style={{ color: "crimson", marginBottom: 12 }}>{err}</div> : null}

      <div style={{ display: "grid", gap: 10 }}>
        <label>
          <div>Email</div>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            style={{ width: "100%", padding: 8 }}
          />
        </label>

        <label>
          <div>Password</div>
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            autoComplete="current-password"
            style={{ width: "100%", padding: 8 }}
          />
        </label>

        <button disabled={busy} onClick={() => void signIn()} style={{ padding: "10px 12px" }}>
          {busy ? "Signing in…" : "Sign in"}
        </button>

        <div style={{ marginTop: 6 }}>
          <Link to="/reset-password">Forgot password?</Link>
        </div>
      </div>
    </div>
  );
}
