import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type Role = "admin" | "author" | "reader";

export type AuthContextValue = {
  user: User | null;
  session: Session | null;
  roles: Role[];
  isAdmin: boolean;
  isAuthor: boolean;
  /** True until the initial session lookup settles. */
  loading: boolean;
  /** True while roles for the current user are being fetched. */
  rolesLoading: boolean;
  signOut: () => Promise<void>;
  refreshRoles: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue>({
  user: null,
  session: null,
  roles: [],
  isAdmin: false,
  isAuthor: false,
  loading: true,
  rolesLoading: true,
  signOut: async () => {},
  refreshRoles: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [rolesLoading, setRolesLoading] = useState(true);

  const loadRoles = useCallback(async (userId: string | null) => {
    if (!userId) {
      setRoles([]);
      setRolesLoading(false);
      return;
    }
    setRolesLoading(true);
    const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", userId);
    if (error) {
      // Never block the UI on a role lookup failure: no roles = no admin rights.
      console.warn("[auth] could not load roles", error.message);
      setRoles([]);
    } else {
      setRoles((data ?? []).map((row) => row.role as Role));
    }
    setRolesLoading(false);
  }, []);

  useEffect(() => {
    let active = true;

    // Initial session (also resolves the very first render).
    // A failed lookup (backend down / not configured) must never leave the UI
    // stuck in a loading state or raise an unhandled rejection.
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!active) return;
        setSession(data.session);
        setLoading(false);
        void loadRoles(data.session?.user?.id ?? null);
      })
      .catch((error: unknown) => {
        if (!active) return;
        console.warn("[auth] could not read the session", error);
        setSession(null);
        setRoles([]);
        setRolesLoading(false);
        setLoading(false);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return;
      setSession(nextSession);
      setLoading(false);
      // Deferred: Supabase forbids awaiting other calls inside this callback.
      setTimeout(() => {
        if (active) void loadRoles(nextSession?.user?.id ?? null);
      }, 0);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [loadRoles]);

  const refreshRoles = useCallback(async () => {
    const userId = session?.user?.id ?? null;
    await loadRoles(userId);
  }, [loadRoles, session?.user?.id]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setRoles([]);
    setSession(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user: session?.user ?? null,
      session,
      roles,
      isAdmin: roles.includes("admin"),
      isAuthor: roles.includes("author") || roles.includes("admin"),
      loading,
      rolesLoading,
      signOut,
      refreshRoles,
    }),
    [session, roles, loading, rolesLoading, signOut, refreshRoles],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
