import { Navigate, Outlet } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import supabase from "../utils/supabase";

const USERS_TABLE = import.meta.env.VITE_SUPABASE_USERS_TABLE ?? "Users";

type AccessState = "checking" | "allowed" | "denied";
type AppRole = "Admin" | "Supervisor" | "Staff";
const ADMIN_ROLES: AppRole[] = ["Admin"];

type AdminOnlyRouteProps = {
  allowedRoles?: readonly AppRole[];
  redirectTo?: string;
};

export default function AdminOnlyRoute({ allowedRoles = ADMIN_ROLES, redirectTo = "/reports" }: AdminOnlyRouteProps) {
  const { user, isLoading } = useAuth();
  const [access, setAccess] = useState<AccessState>("checking");

  useEffect(() => {
    let alive = true;

    const loadAccess = async () => {
      if (isLoading) return;
      if (!user?.id) {
        setAccess("denied");
        return;
      }

      setAccess("checking");
      const { data, error } = await supabase
        .from(USERS_TABLE)
        .select("role, status")
        .eq("user_uuid", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!alive) return;
      if (error) {
        console.error("Failed to load admin access:", error.message);
        setAccess("denied");
        return;
      }

      const role = data?.role;
      setAccess(
        role && allowedRoles.includes(role as AppRole) && data?.status !== "Inactive"
          ? "allowed"
          : "denied"
      );
    };

    void loadAccess();
    return () => {
      alive = false;
    };
  }, [allowedRoles, isLoading, user?.id]);

  if (isLoading || access === "checking") {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center text-slate-500">
        Checking access...
      </div>
    );
  }

  if (access === "denied") {
    return <Navigate to={redirectTo} replace />;
  }

  return <Outlet />;
}
