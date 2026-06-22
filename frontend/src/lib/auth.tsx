"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { api, setAccessToken } from "./api";
import type { Role, User } from "./types";

interface LoginResponse {
  accessToken: string;
  user: User;
}

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (name: string, email: string, password: string) => Promise<User>;
  demoLogin: (role: "user" | "admin") => Promise<User>;
  logout: () => Promise<void>;
  setUser: (user: User | null) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // On mount, attempt to restore a session via the refresh cookie.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const ok = await api.refresh();
        if (ok && !cancelled) {
          const me = await api.get<User>("/auth/me");
          if (!cancelled) setUser(me);
        }
      } catch {
        // No valid session; remain logged out.
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const applySession = useCallback((res: LoginResponse) => {
    setAccessToken(res.accessToken);
    setUser(res.user);
    return res.user;
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      const res = await api.post<LoginResponse>("/auth/login", { email, password }, { auth: false });
      return applySession(res);
    },
    [applySession],
  );

  const register = useCallback(
    async (name: string, email: string, password: string) => {
      const res = await api.post<LoginResponse>(
        "/auth/register",
        { name, email, password },
        { auth: false },
      );
      return applySession(res);
    },
    [applySession],
  );

  const demoLogin = useCallback(
    async (role: "user" | "admin") => {
      const res = await api.post<LoginResponse>("/auth/demo", { role }, { auth: false });
      return applySession(res);
    },
    [applySession],
  );

  const logout = useCallback(async () => {
    try {
      await api.post("/auth/logout");
    } catch {
      // Ignore network/logout errors; we clear local state regardless.
    }
    setAccessToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, loading, login, register, demoLogin, logout, setUser }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}

export type { Role, User };
