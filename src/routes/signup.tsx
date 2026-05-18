import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/signup")({
  head: () => ({ meta: [{ title: "Sign up — StarShot" }] }),
  component: SignupPage,
});

function SignupPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { display_name: displayName },
      },
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Check your email to confirm your account.");
    navigate({ to: "/login" });
  };

  return (
    <div className="mx-auto max-w-sm py-12">
      <h1 className="text-2xl font-bold">Create your account</h1>
      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <input
          required
          placeholder="Display name"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
        <input
          type="email"
          required
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
        <input
          type="password"
          required
          minLength={6}
          placeholder="Password (min 6)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-primary py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
        >
          {loading ? "Creating…" : "Sign up"}
        </button>
      </form>
      <p className="mt-4 text-sm text-muted-foreground">
        Already have one?{" "}
        <Link to="/login" className="text-[var(--gold)] hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}