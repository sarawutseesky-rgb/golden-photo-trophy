import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/_authenticated/profile/me")({
  component: MyProfileRedirect,
});

function MyProfileRedirect() {
  const { user } = useAuth();
  if (!user) return null;
  return <Navigate to="/profile/$id" params={{ id: user.id }} />;
}