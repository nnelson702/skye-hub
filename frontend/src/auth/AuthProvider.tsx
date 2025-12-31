import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabaseClient";

type AuthState = {
  booting: boolean;
  session: Session | null;
  user: User | null;
  error: string | null;
  retry: () => void;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = window.setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    p.then(
      (v) => {
        window.clearTimeout(t);
        resolve(v);
      },
      (e) => {
        window.clearTimeout(t);
        reject(e);
      }
    );
  });
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [booting, setBooting] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [error, setError] = useState<string | null>(null);

  const retryNonce = useRef(0);
  const mounted = useRef(true);

  const boot = async () => {
    setBooting(true);
    setError(null);

    try {
      // Primary session fetch (no /health calls)
      const { data, error: sessErr } = await withTimeout(
        supabase.auth.getSession(),
        8000,
        "auth.getSession"
      );

      if (sessErr) throw sessErr;

      if (!mounted.current) return;

      setSession(data.session ?? null);
      setBooting(false);
    } catch (e: unknown) {
      if (!mounted.current) return;
      setSession(null);
      setBooting(false);
      const message = e instanceof Error ? e.message : String(e);
      setError(message || "Auth initialization failed.");
    }
  };

  useEffect(() => {
    mounted.current = true;
    void boot();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession ?? null);
    });

    return () => {
      mounted.current = false;
      sub.subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [retryNonce.current]);

  const value = useMemo<AuthState>(() => {
    return {
      booting,
      session,
      user: session?.user ?? null,
      error,
      retry: () => {
        retryNonce.current += 1;
        void boot();
      },
      signOut: async () => {
        await supabase.auth.signOut();
      },
    };
  }, [booting, session, error]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
