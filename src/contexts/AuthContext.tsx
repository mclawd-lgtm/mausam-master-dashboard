import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase, User } from '../lib/supabase';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  signInWithOtp: (email: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<void>;
  devLogin: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Fixed UUID matching the real Supabase user
const DEV_USER: User = {
  id: '895cd28a-37ea-443c-b7bb-eca88c857d05',
  email: 'mausampatel111@gmail.com',
  app_metadata: {},
  user_metadata: {},
  aud: 'authenticated',
  created_at: new Date().toISOString(),
} as User;

const DEV_LOGIN_KEY = 'dev_auto_login';
const EXPLICIT_SIGNOUT_KEY = 'explicit_signout';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check for existing session on mount
    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        if (session?.user) {
          setUser(session.user);
        } else {
          // Check if user explicitly signed out
          const explicitSignout = localStorage.getItem(EXPLICIT_SIGNOUT_KEY);
          
          if (explicitSignout) {
            // User signed out - don't auto login
            setUser(null);
          } else {
            // First visit - auto login as dev user for convenience
            setUser(DEV_USER);
            localStorage.setItem(DEV_LOGIN_KEY, 'true');
          }
        }
      })
      .catch((err) => {
        console.error('[Auth] getSession error:', err);
        setUser(null);
      })
      .finally(() => {
        setIsLoading(false);
      });

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        // Real user logged in
        setUser(session.user);
        localStorage.removeItem(EXPLICIT_SIGNOUT_KEY);
      }
      // Don't auto-login dev user here - only on initial mount
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const devLogin = () => {
    setUser(DEV_USER);
    localStorage.setItem(DEV_LOGIN_KEY, 'true');
    localStorage.removeItem(EXPLICIT_SIGNOUT_KEY);
  };

  const signInWithOtp = async (email: string) => {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: window.location.origin,
      },
    });
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    localStorage.setItem(EXPLICIT_SIGNOUT_KEY, 'true');
    localStorage.removeItem(DEV_LOGIN_KEY);
  };

  const refreshSession = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      setUser(session.user);
    }
  };

  const value: AuthContextType = {
    user,
    isLoading,
    isAuthenticated: !!user,
    signInWithOtp,
    signOut,
    refreshSession,
    devLogin,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
