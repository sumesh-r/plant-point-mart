import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, SESSION_ENDED } from "../lib/api";
import type { User } from "../lib/types";

type AuthMode = "login" | "register";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  /**
   * Run `action` if signed in; otherwise open the sign-in dialog and run it
   * right after the user signs in or registers.
   */
  requireAuth: (action?: () => void, reason?: string) => void;
  openAuth: (mode?: AuthMode, reason?: string) => void;
  closeAuth: () => void;
  onAuthenticated: (user: User) => void;
  logout: () => Promise<void>;
  dialog: { open: boolean; mode: AuthMode; reason?: string };
  setMode: (mode: AuthMode) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["me"],
    queryFn: () => api.get<{ user: User | null }>("/auth/me"),
    staleTime: Infinity,
  });
  const user = data?.user ?? null;
  // Ref so callbacks captured before sign-in (e.g. a resumed action) see the current user.
  const userRef = useRef<User | null>(user);
  userRef.current = user;

  const [dialog, setDialog] = useState<{ open: boolean; mode: AuthMode; reason?: string }>({ open: false, mode: "login" });
  const pending = useRef<(() => void) | null>(null);

  const openAuth = useCallback((mode: AuthMode = "login", reason?: string) => {
    setDialog({ open: true, mode, reason });
  }, []);

  const closeAuth = useCallback(() => {
    pending.current = null;
    setDialog((d) => ({ ...d, open: false }));
  }, []);

  const requireAuth = useCallback(
    (action?: () => void, reason?: string) => {
      if (userRef.current) {
        action?.();
        return;
      }
      pending.current = action ?? null;
      setDialog({ open: true, mode: "login", reason });
    },
    [],
  );

  const onAuthenticated = useCallback(
    (u: User) => {
      userRef.current = u;
      qc.setQueryData(["me"], { user: u });
      qc.invalidateQueries({ predicate: (q) => q.queryKey[0] !== "me" });
      setDialog((d) => ({ ...d, open: false }));
      const action = pending.current;
      pending.current = null;
      // Let React commit the new user before resuming the action
      if (action) setTimeout(action, 0);
    },
    [qc],
  );

  const logout = useCallback(async () => {
    await api.post("/auth/logout");
    qc.setQueryData(["me"], { user: null });
    qc.removeQueries({ predicate: (q) => q.queryKey[0] !== "me" });
  }, [qc]);

  // A request came back 401 while we thought we were signed in: show the signed-out state.
  useEffect(() => {
    const ended = () => {
      if (!userRef.current) return;
      userRef.current = null;
      qc.setQueryData(["me"], { user: null });
      qc.removeQueries({ predicate: (q) => q.queryKey[0] !== "me" });
      toast.info("You've been signed out. Please sign in again.");
    };
    window.addEventListener(SESSION_ENDED, ended);
    return () => window.removeEventListener(SESSION_ENDED, ended);
  }, [qc]);

  const setMode = useCallback((mode: AuthMode) => setDialog((d) => ({ ...d, mode })), []);

  return (
    <AuthContext.Provider
      value={{ user, loading: isLoading, requireAuth, openAuth, closeAuth, onAuthenticated, logout, dialog, setMode }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
