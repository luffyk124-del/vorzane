import { createContext, useContext, useEffect, useMemo, useState, type PropsWithChildren } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import { friendlyAuthError } from "../lib/authErrors";
export { friendlyAuthError } from "../lib/authErrors";

export type AuthContextValue = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  error: string;
  clearError: () => void;
  signIn: (email: string, password: string) => Promise<string | null>;
  signUp: (email: string, password: string) => Promise<{ error: string | null; confirmation: boolean }>;
  continueAsGuest: () => Promise<string | null>;
  upgradeGuestWithEmail: (email: string, password: string) => Promise<{ error: string | null; confirmation: boolean }>;
  signOut: () => Promise<string | null>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function redirectUrl() {
  if (typeof window !== "undefined") return `${window.location.origin}${process.env.EXPO_PUBLIC_BASE_PATH ?? ""}/`;
  return "vorzane://auth/callback";
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (!mounted) return;
      if (sessionError) setError(friendlyAuthError(sessionError));
      setSession(data.session);
      setLoading(false);
    }).catch((caught) => {
      if (mounted) {
        setError(friendlyAuthError(caught));
        setLoading(false);
      }
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setLoading(false);
      if (_event === "SIGNED_OUT") setError("");
    });
    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    session,
    user: session?.user ?? null,
    loading,
    error,
    clearError: () => setError(""),
    signIn: async (email, password) => {
      setError("");
      try {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        const friendly = signInError ? friendlyAuthError(signInError) : null;
        if (friendly) setError(friendly);
        return friendly;
      } catch (caught) {
        const friendly = friendlyAuthError(caught);
        setError(friendly);
        return friendly;
      }
    },
    signUp: async (email, password) => {
      setError("");
      try {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { emailRedirectTo: redirectUrl() },
        });
        const friendly = signUpError ? friendlyAuthError(signUpError) : null;
        if (friendly) setError(friendly);
        return { error: friendly, confirmation: !signUpError && !data.session };
      } catch (caught) {
        const friendly = friendlyAuthError(caught);
        setError(friendly);
        return { error: friendly, confirmation: false };
      }
    },
    continueAsGuest: async () => {
      setError("");
      try {
        const { error: guestError } = await supabase.auth.signInAnonymously();
        const friendly = guestError ? friendlyAuthError(guestError) : null;
        if (friendly) setError(friendly);
        return friendly;
      } catch (caught) {
        const friendly = friendlyAuthError(caught);
        setError(friendly);
        return friendly;
      }
    },
    upgradeGuestWithEmail: async (email, password) => {
      setError("");
      try {
        const { data, error: upgradeError } = await supabase.auth.updateUser(
          { email: email.trim(), password },
          { emailRedirectTo: redirectUrl() },
        );
        const friendly = upgradeError ? friendlyAuthError(upgradeError) : null;
        if (friendly) setError(friendly);
        return { error: friendly, confirmation: !upgradeError && !data.user?.email_confirmed_at };
      } catch (caught) {
        const friendly = friendlyAuthError(caught);
        setError(friendly);
        return { error: friendly, confirmation: false };
      }
    },
    signOut: async () => {
      setError("");
      try {
        const { error: signOutError } = await supabase.auth.signOut();
        const friendly = signOutError ? friendlyAuthError(signOutError) : null;
        if (friendly) setError(friendly);
        return friendly;
      } catch (caught) {
        const friendly = friendlyAuthError(caught);
        setError(friendly);
        return friendly;
      }
    },
  }), [session, loading, error]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
