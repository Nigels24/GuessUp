"use client";

import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  apiFetch,
  ApiError,
  clearSession,
  getStoredSession,
  setSignedOutHandler,
  storeSession,
  type AuthResponse,
  type User,
} from "./api";

export const NOT_ADMIN_MESSAGE = "This account does not have the administrator role.";

interface AuthState {
  user: User | null;
  token: string | null;
  /** False until the stored session has been read on first load. */
  ready: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const logout = useCallback(() => {
    clearSession();
    setUser(null);
    setToken(null);
    router.replace("/login");
  }, [router]);

  // Restore the session saved in localStorage, then confirm it with the API
  // (the account may have been deactivated or the token may have expired).
  useEffect(() => {
    setSignedOutHandler(logout);
    const saved = getStoredSession();
    if (saved) {
      setUser(saved.user);
      setToken(saved.token);
      apiFetch<User>("/auth/me")
        .then((fresh) => {
          if (fresh.role !== "ADMIN") return logout();
          setUser(fresh);
          storeSession(saved.token, fresh);
        })
        .catch((error: unknown) => {
          // 401 is handled by apiFetch; a 403 here means the account was deactivated.
          if (error instanceof ApiError && error.status === 403) logout();
        });
    }
    setReady(true);
  }, [logout]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await apiFetch<AuthResponse>("/auth/login", {
      method: "POST",
      body: { email, password },
      auth: false,
    });
    if (res.user.role !== "ADMIN") throw new Error(NOT_ADMIN_MESSAGE);
    storeSession(res.accessToken, res.user);
    setToken(res.accessToken);
    setUser(res.user);
  }, []);

  const value = useMemo(() => ({ user, token, ready, login, logout }), [user, token, ready, login, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
