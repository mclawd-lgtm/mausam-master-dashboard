import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
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

const EXPLICIT_SIGNOUT_KEY = 'mausam_explicit_signout_v2';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Check auth status on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        // FIRST: Check if user explicitly signed out (highest priority)
        // This must be checked BEFORE Supabase session to prevent auto-login
        const explicitSignout = localStorage.getItem(EXPLICIT_SIGNOUT_KEY);
        
        if (explicitSignout === 'true') {
          console.log('[Auth] User explicitly signed out, forcing logged out state');
          // Force sign out from Supabase to clear their IndexedDB/cookie storage
          await supabase.auth.signOut();
          setUser(null);
          setIsLoading(false);
          return;
        }

        // Check for Supabase session (only if not explicitly signed out)
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('[Auth] Session error:', error);
          setUser(null);
          setIsLoading(false);
          return;
        }

        if (session?.user) {
          console.log('[Auth] Found Supabase session');
          setUser(session.user);
          localStorage.removeItem(EXPLICIT_SIGNOUT_KEY);
        } else {
          // No session - check if this is first visit
          const hasVisited = localStorage.getItem('mausam_visited');
          
          if (!hasVisited) {
            // First time visitor - auto login as dev
            console.log('[Auth] First visit, auto-login as dev');
            setUser(DEV_USER);
            localStorage.setItem('mausam_visited', 'true');
          } else {
            // Returning visitor, no session
            console.log('[Auth] Returning visitor, no session');
            setUser(null);
          }
        }
      } catch (err) {
        console.error('[Auth] Unexpected error:', err);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();

    // Listen for auth state changes from Supabase
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('[Auth] State change:', event);
      
      if (event === 'SIGNED_IN' && session?.user) {
        setUser(session.user);
        localStorage.removeItem(EXPLICIT_SIGNOUT_KEY);
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        localStorage.setItem(EXPLICIT_SIGNOUT_KEY, 'true');
      } else if (event === 'TOKEN_REFRESHED' && session?.user) {
        setUser(session.user);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const devLogin = useCallback(() => {
    console.log('[Auth] Dev login clicked');
    setUser(DEV_USER);
    localStorage.removeItem(EXPLICIT_SIGNOUT_KEY);
    localStorage.setItem('mausam_visited', 'true');
  }, []);

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
    console.log('[Auth] Signing out...');
    
    // Mark as explicitly signed out FIRST
    localStorage.setItem(EXPLICIT_SIGNOUT_KEY, 'true');
    localStorage.removeItem('mausam_visited');
    
    // Clear local state
    setUser(null);
    
    // Sign out from Supabase
    try {
      await supabase.auth.signOut();
      console.log('[Auth] Supabase signOut complete');
    } catch (err) {
      console.error('[Auth] Supabase signOut error:', err);
    }
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
