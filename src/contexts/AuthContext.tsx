import { createContext, useContext, useState, ReactNode } from 'react';

interface User {
  id: string;
  email: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Fixed dev user - always logged in
const DEV_USER: User = {
  id: '895cd28a-37ea-443c-b7bb-eca88c857d05',
  email: 'mausampatel111@gmail.com',
  app_metadata: {},
  user_metadata: {},
  aud: 'authenticated',
  created_at: new Date().toISOString(),
} as User;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user] = useState<User>(DEV_USER);
  const [isLoading] = useState(false);

  const value: AuthContextType = {
    user,
    isLoading,
    isAuthenticated: true,
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
