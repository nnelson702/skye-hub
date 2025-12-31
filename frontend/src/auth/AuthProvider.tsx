// frontend/src/auth/AuthProvider.tsx
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabaseClient";

type AuthState = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  error: string | null;
  signOut: () => Promise<void>;
  retry: () => Promise<void>;
};

const AuthContext = createContext<AuthState | undefined>(undefined);

function withTimeout<T>(p: Promise<T>, ms: number, label = "operation"): Promise<T> {
  let t: number | undefined;
  const timeout = new Promise<T>((_, reject) => {
    t = window.setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
  });
  return Promise.race([p, timeout]).finally(() => {
    if (t) window.clearTimeout(t);
  }) as Promise<T>;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const boot = async () => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: getErr } = await withTimeout(
        supabase.auth.getSession(),
        10000,
        "auth.getSession"
      );

      if (getErr) throw getErr;

      setSession(data.session ?? null);
      setUser(data.session?.user ?? null);
    } catch (e: any) {
      setSession(null);
      setUser(null);
      setError(e?.message ?? "Auth initialization failed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;

    (async () => {
      if (!mounted) return;
      await boot();
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      // if auth state changes, we are no longer “booting”
      setLoading(false);
      setError(null);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      session,
      user,
      loading,
      error,
      signOut: async () => {
        await supabase.auth.signOut();
      },
      retry: async () => {
        await boot();
      },
    }),
    [session, user, loading, error]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
