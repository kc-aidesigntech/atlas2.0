/**
 * Mobile auth context bridge for Supabase sessions. It centralizes bootstrap
 * and subscription updates so route-level screens can stay declarative.
 */
import type { Session } from "@supabase/supabase-js";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

interface AuthContextValue {
  session: Session | null;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextValue>({
  session: null,
  isLoading: true,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function bootstrapSession() {
      if (!supabase) {
        // No client means auth is intentionally disabled for this build; release loading gate immediately.
        if (isMounted) setIsLoading(false);
        return;
      }

      const { data } = await supabase.auth.getSession();
      if (isMounted) {
        // Initial session value is authoritative for first paint; route redirects read this before subscriptions fire.
        setSession(data.session);
        setIsLoading(false);
      }
    }

    bootstrapSession();

    if (!supabase) {
      return () => {
        isMounted = false;
      };
    }

    // Keep context in sync with token refresh/sign-out events so route gates react without manual polling.
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (isMounted) {
        setSession(nextSession);
      }
    });

    return () => {
      isMounted = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo(
    () => ({
      session,
      isLoading,
    }),
    [session, isLoading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
