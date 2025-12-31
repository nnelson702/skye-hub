import { createContext, useContext, useEffect, useMemo, useRef, useState, useCallback } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabaseClient";
import { formatError } from "../lib/errors";
import type { UserProfile } from "../types/profile";

type AuthState = {
  booting: boolean;
  authReady: boolean; // session resolved (even if null)
  profileReady: boolean; // profile load attempted (even if null)
  session: Session | null;
  user: User | null;
  profile: UserProfile | null;
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
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileReady, setProfileReady] = useState(false);

  const retryNonce = useRef(0);
  const mounted = useRef(true);

  const loadProfile = useCallback(async (sess: Session | null) => {
    setProfileReady(false);
    if (!sess) {
      setProfile(null);
      setProfileReady(true);
      return;
    }

    try {
      const { data, error: pErr } = await supabase
        .from("user_profiles")
        .select("id, full_name, email, role, status, home_store_id")
        .eq("id", sess.user.id)
        .single();

      if (pErr) {
        // If no profile exists, still mark profileReady so pages can proceed
        console.warn("AuthProvider: user profile not found or error:", pErr);
        setProfile(null);
        setProfileReady(true);
        return;
      }

      setProfile((data ?? null) as UserProfile | null);
      setProfileReady(true);
    } catch (e: unknown) {
      console.error("AuthProvider loadProfile error:", e);
      setProfile(null);
      setProfileReady(true);
    }
  }, []);

  const boot = useCallback(async () => {
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

      const sess = data.session ?? null;
      setSession(sess);
      // Mark auth ready now
      setBooting(false);

      // Load profile for this session (if any)
      void loadProfile(sess);
    } catch (e: unknown) {
      if (!mounted.current) return;
      setSession(null);
      setBooting(false);
      const message = formatError(e);
      setError(message || "Auth initialization failed.");
      // ensure profile ready so dependent pages don't hang indefinitely
      setProfile(null);
      setProfileReady(true);
    }
  }, [loadProfile]);

  useEffect(() => {
    mounted.current = true;
    void boot();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      const sess = newSession ?? null;
      setSession(sess);
      // When auth state changes, reload profile for the new session
      void loadProfile(sess);
    });

    return () => {
      mounted.current = false;
      sub.subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [retryNonce.current, boot, loadProfile]);

  const value = useMemo<AuthState>(() => {
    return {
      booting,
      authReady: !booting,
      profileReady,
      session,
      user: session?.user ?? null,
      profile,
      error,
      retry: () => {
        retryNonce.current += 1;
        void boot();
      },
      signOut: async () => {
        await supabase.auth.signOut();
      },
    };
  }, [booting, session, profileReady, profile, error, boot]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
