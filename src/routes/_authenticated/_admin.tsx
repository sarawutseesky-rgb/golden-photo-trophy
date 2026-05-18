import { createFileRoute, Outlet, redirect, isRedirect } from "@tanstack/react-router";
import { checkAdmin } from "@/lib/profile.functions";

export const Route = createFileRoute("/_authenticated/_admin")({
  beforeLoad: async () => {
    try {
      const { isAdmin } = await checkAdmin();
      if (!isAdmin) throw redirect({ to: "/" });
    } catch (err) {
      if (isRedirect(err)) throw err;
      throw redirect({ to: "/" });
    }
  },
  component: () => <Outlet />,
});