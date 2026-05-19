import { createFileRoute, Outlet, useNavigate, useLocation } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/_authenticated")({
  component: AuthLayout,
});

function AuthLayout() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  useEffect(() => {
    if (!loading && !user) {
      const here = location.pathname + location.searchStr + location.hash;
      navigate({ to: "/login", search: { redirect: here } });
    }
  }, [user, loading, navigate, location]);
  if (loading) return <div className="py-12 text-center text-muted-foreground">Loading…</div>;
  if (!user) return null;
  return <Outlet />;
}