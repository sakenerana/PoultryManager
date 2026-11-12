import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function ProtectedRoute() {
  const { session, isLoading, isAccessLoading, role, signOut } = useAuth();

  if (isLoading || isAccessLoading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center text-slate-500">
        Checking session...
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/" replace />;
  }

  if (!role) {
    return <div className="min-h-screen flex flex-col items-center justify-center gap-3 text-slate-600">
      <p>Your account does not have active access. Please contact an Admin.</p>
      <button className="text-green-700 underline" onClick={() => void signOut()}>Sign out</button>
    </div>;
  }

  return <>
    {role === "Viewer" && <div className="bg-sky-50 border-b border-sky-100 px-4 py-2 text-center text-xs text-sky-800" role="status">Viewer access · View only</div>}
    <Outlet />
  </>;
}
