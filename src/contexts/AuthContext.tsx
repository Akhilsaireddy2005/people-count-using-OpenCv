import { createContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

const isSupabaseConfigured = (): boolean => {
  // Clear any stale invalid key flags on app start
  if (typeof window !== 'undefined' && supabaseUrl && supabaseAnonKey) {
    try {
      localStorage.removeItem('supabase_invalid_key');
    } catch {
      // Ignore errors
    }
  }
  return !!(supabaseUrl && supabaseAnonKey);
};

type AuthContextType = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isDemoMode: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDemoMode, setIsDemoMode] = useState(!isSupabaseConfigured());

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      // Demo mode: create a mock user
      setUser({ id: 'demo-user', email: 'demo@example.com' } as User);
      setSession(null);
      setLoading(false);
      setIsDemoMode(true);
      return;
    }

    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        console.error('Supabase auth error:', error);
      }
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
      setIsDemoMode(false);
    }).catch((error) => {
      console.error('Auth session error:', error);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => {
      if (subscription) {
        subscription.unsubscribe();
      }
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    if (!isSupabaseConfigured()) {
      // Demo mode: accept any credentials and set user
      setUser({ id: 'demo-user', email } as User);
      setSession(null);
      return;
    }
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      console.error('Sign in error:', error);
      throw error;
    }
    if (data.session) {
      setSession(data.session);
      setUser(data.user);
    }
  };

  const signUp = async (email: string, password: string) => {
    if (!isSupabaseConfigured()) {
      // Demo mode: accept any credentials and set user
      setUser({ id: 'demo-user', email } as User);
      setSession(null);
      return;
    }
    const { data, error } = await supabase.auth.signUp({ 
      email, 
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/dashboard`
      }
    });
    if (error) {
      console.error('Sign up error:', error);
      throw error;
    }
    // For email confirmation disabled, auto sign in
    if (data.session) {
      setSession(data.session);
      setUser(data.user);
    }
  };

  const signOut = async () => {
    if (!isSupabaseConfigured()) {
      setUser(null);
      setSession(null);
      return;
    }
    try {
      // Check if session exists before signing out
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
      } else {
        // No session exists, just clear the state
        setUser(null);
        setSession(null);
      }
    } catch (error) {
      console.error('Sign out error:', error);
      // Ensure user state is cleared even if there's an error
      setUser(null);
      setSession(null);
    }
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, isDemoMode, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

