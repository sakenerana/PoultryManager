import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { PropsWithChildren } from "react";
import type { Session, User } from "@supabase/supabase-js";
import supabase from "../utils/supabase";
import { toRole } from "../type/user.types";
import type { Role } from "../type/user.types";

type SignInInput = {
  email: string;
  password: string;
  rememberMe: boolean;
};

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  isLoading: boolean;
  role: Role | null;
  isAccessLoading: boolean;
  canWrite: boolean;
  isViewer: boolean;
  signInWithPassword: (input: SignInInput) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);
const REMEMBER_ME_KEY = "ggdc_remember_me";

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [access, setAccess] = useState<{ userId: string | null; role: Role | null; active: boolean }>({
    userId: null, role: null, active: false,
  });
  const [isProfileLoading, setIsProfileLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    const refreshAccess = async () => {
      if (!user?.id) {
        setAccess({ userId: null, role: null, active: false });
        setIsProfileLoading(false);
        return;
      }
      const { data, error } = await supabase
        .from(import.meta.env.VITE_SUPABASE_USERS_TABLE ?? "Users")
        .select("role,status").eq("user_uuid", user.id)
        .order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (!alive) return;
      setAccess({ userId: user.id, role: error ? null : toRole(data?.role), active: !error && !!data && data.status !== "Inactive" });
      setIsProfileLoading(false);
    };
    void refreshAccess();
    window.addEventListener("focus", refreshAccess);
    return () => { alive = false; window.removeEventListener("focus", refreshAccess); };
  }, [user?.id]);

  const role = access.userId === user?.id && access.active ? access.role : null;
  const isAccessLoading = isLoading || isProfileLoading || (!!user && access.userId !== user.id);

  useEffect(() => {
    let isMounted = true;

    const bootstrap = async () => {
      // Keep existing auth session across refreshes.
      const { data } = await supabase.auth.getSession();
      if (!isMounted) return;
      setSession(data.session ?? null);
      setUser(data.session?.user ?? null);
      setIsLoading(false);
    };

    void bootstrap();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession ?? null);
      setUser(nextSession?.user ?? null);
      setIsLoading(false);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user,
      isLoading,
      role,
      isAccessLoading,
      canWrite: !isAccessLoading && role != null && role !== "Viewer",
      isViewer: role === "Viewer",
      signInWithPassword: async ({ email, password, rememberMe }) => {
        localStorage.setItem(REMEMBER_ME_KEY, String(rememberMe));
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        return { error: error?.message ?? null };
      },
      signOut: async () => {
        await supabase.auth.signOut();
      },
    }),
    [session, user, isLoading, role, isAccessLoading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// The auth hook intentionally shares the provider's context.
// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
