import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { checkAdmin } from "@/lib/profile.functions";

export const Route = createFileRoute("/_authenticated/_admin")({
  component: AdminLayout,
});

function AdminLayout() {
  const navigate = useNavigate();
  const fn = useServerFn(checkAdmin);
  const [state, setState] = useState<"loading" | "ok" | "deny">("loading");
  useEffect(() => {
    fn()
      .then((r) => setState(r.isAdmin ? "ok" : "deny"))
      .catch(() => setState("deny"));
  }, [fn]);
  useEffect(() => {
    if (state === "deny") navigate({ to: "/" });
  }, [state, navigate]);
  if (state !== "ok") return <div className="py-12 text-center text-muted-foreground">Checking access…</div>;
  return <Outlet />;
}