'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

const TOKEN_KEY = 'splitsmart_token';

function readCookie(): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${TOKEN_KEY}=([^;]*)`));
  return match && match[1] !== undefined ? decodeURIComponent(match[1]) : null;
}

interface AuthState {
  token: string | null;
  ready: boolean;
  signIn: (token: string) => void;
  signOut: () => void;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setToken(readCookie());
    setReady(true);
  }, []);

  const signIn = (t: string): void => {
    document.cookie = `${TOKEN_KEY}=${encodeURIComponent(t)}; path=/; SameSite=Lax`;
    setToken(t);
  };
  const signOut = (): void => {
    document.cookie = `${TOKEN_KEY}=; path=/; Max-Age=0`;
    setToken(null);
  };

  return (
    <AuthContext.Provider value={{ token, ready, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
