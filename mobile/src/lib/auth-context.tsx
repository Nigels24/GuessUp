import axios from 'axios';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { loadApiUrl, setUnauthorizedHandler } from './api';
import * as auth from './auth';

interface AuthState {
  user: auth.User | null;
  /** False until the saved API address and session have been read. */
  ready: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (input: auth.RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
  /** Replace the signed-in user (after Edit profile), here and in storage. */
  updateUser: (user: auth.User) => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<auth.User | null>(null);
  const [ready, setReady] = useState(false);

  const logout = useCallback(async () => {
    await auth.clearSession();
    setUser(null);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => void logout());

    void (async () => {
      await loadApiUrl();
      const session = await auth.restoreSession();
      setUser(session?.user ?? null);
      setReady(true);

      // Confirm the saved session with the server in the background. An
      // expired token (401) or a deactivated account (403) signs the student
      // out; no connection keeps them signed in until the server is reachable.
      if (session) {
        try {
          const fresh = await auth.fetchMe();
          setUser(fresh);
          await auth.saveUser(fresh);
        } catch (error) {
          if (axios.isAxiosError(error) && error.response?.status === 403)
            await logout();
        }
      }
    })();
  }, [logout]);

  const login = useCallback(async (email: string, password: string) => {
    const session = await auth.login(email, password);
    setUser(session.user);
  }, []);

  const register = useCallback(async (input: auth.RegisterInput) => {
    const session = await auth.register(input);
    setUser(session.user);
  }, []);

  const updateUser = useCallback(async (next: auth.User) => {
    setUser(next);
    await auth.saveUser(next);
  }, []);

  const value = useMemo(
    () => ({ user, ready, login, register, logout, updateUser }),
    [user, ready, login, register, logout, updateUser],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
