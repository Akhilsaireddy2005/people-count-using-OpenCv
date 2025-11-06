import { createContext, useEffect, useState, ReactNode } from 'react';
import { localStorageService, type User } from '../lib/localStorage';

type AuthContextType = {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is already logged in
    const currentUser = localStorageService.getCurrentUser();
    setUser(currentUser);
    setLoading(false);
  }, []);

  const signIn = async (email: string, password: string) => {
    // Simple validation - in a real app, you'd verify credentials
    if (!email || !password) {
      throw new Error('Email and password are required');
    }
    
    const user: User = {
      id: `user-${Date.now()}`,
      email,
    };
    
    localStorageService.setCurrentUser(user);
    setUser(user);
  };

  const signUp = async (email: string, password: string) => {
    // Simple validation - in a real app, you'd create an account
    if (!email || !password) {
      throw new Error('Email and password are required');
    }
    
    const user: User = {
      id: `user-${Date.now()}`,
      email,
    };
    
    localStorageService.setCurrentUser(user);
    setUser(user);
  };

  const signOut = async () => {
    localStorageService.setCurrentUser(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

