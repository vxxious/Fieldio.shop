import { useState, type ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { accountSignUpPath } from "../hooks/useRequireAccount";
import { useSession } from "../hooks/useSession";

export function AccountGate({ children }: { children: ReactNode }) {
  const { session, loading } = useSession();
  const location = useLocation();
  const [returnTo] = useState(() => `${location.pathname}${location.search}`);
  if (loading) return <div className="route-loading" role="status">Checking account…</div>;
  if (!session) return <Navigate to={accountSignUpPath(returnTo)} replace />;
  return children;
}
