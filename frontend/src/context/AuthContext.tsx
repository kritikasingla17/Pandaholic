import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabaseClient';

interface StaffCheck {
  userId: string;
  isStaff: boolean;
  error: string | null;
}

interface AuthContextValue {
  session: Session | null;
  isStaff: boolean;
  // True until the session and, for a signed-in user, their staff status are known.
  loading: boolean;
  accessError: string | null;
  signIn: (email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

async function checkStaff(userId: string): Promise<StaffCheck> {
  try {
    const { data, error } = await supabase.rpc('is_staff');
    if (error) return { userId, isStaff: false, error: `Couldn't verify staff access: ${error.message}` };
    return { userId, isStaff: data === true, error: null };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { userId, isStaff: false, error: `Couldn't verify staff access: ${message}` };
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [sessionLoaded, setSessionLoaded] = useState(false);
  const [staffCheck, setStaffCheck] = useState<StaffCheck | null>(null);

  useEffect(() => {
    // Fires INITIAL_SESSION right away; Supabase advises against calling the client inside this callback.
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setSessionLoaded(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const userId = session?.user.id ?? null;

  useEffect(() => {
    if (!userId) return;
    let active = true;
    checkStaff(userId).then((result) => {
      if (active) setStaffCheck(result);
    });
    return () => {
      active = false;
    };
  }, [userId]);

  const currentCheck = userId && staffCheck?.userId === userId ? staffCheck : null;
  const loading = !sessionLoaded || (userId !== null && currentCheck === null);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return error ? error.message : null;
  }, []);

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) console.error('Sign out failed:', error.message);
  }, []);

  const value = useMemo(
    () => ({
      session,
      isStaff: currentCheck?.isStaff ?? false,
      loading,
      accessError: currentCheck?.error ?? null,
      signIn,
      signOut,
    }),
    [session, currentCheck, loading, signIn, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
