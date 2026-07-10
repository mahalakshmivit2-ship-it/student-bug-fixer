import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Bug } from "lucide-react";
import { toast } from "sonner";

const authSearch = z.object({ mode: z.enum(["signin", "signup"]).optional() });

export const Route = createFileRoute("/auth")({
  validateSearch: authSearch,
  component: AuthPage,
});

const roles = [
  { value: "student", label: "Student", desc: "Report bugs, comment, upload screenshots" },
  { value: "team_leader", label: "Team Leader", desc: "Assign bugs, manage projects & team" },
  { value: "faculty", label: "Faculty", desc: "Monitor progress across projects" },
] as const;

function AuthPage() {
  const { mode: initialMode } = Route.useSearch();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">(initialMode ?? "signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<"student" | "team_leader" | "faculty">("student");
  const [loading, setLoading] = useState(false);

  const schema = mode === "signup"
    ? z.object({ email: z.string().email(), password: z.string().min(6), fullName: z.string().min(2).max(80) })
    : z.object({ email: z.string().email(), password: z.string().min(6) });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = schema.safeParse({ email, password, fullName });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Invalid input");
      return;
    }
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: {
            emailRedirectTo: `${window.location.origin}/dashboard`,
            data: { full_name: fullName, role },
          },
        });
        if (error) throw error;
        toast.success("Account created — signing you in…");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      navigate({ to: "/dashboard" });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    setLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
      if (result.error) throw result.error;
      if (result.redirected) return;
      navigate({ to: "/dashboard" });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Google sign-in failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="grid-bg absolute inset-0 -z-10 opacity-30" />
      <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
        <Link to="/" className="mb-8 inline-flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-md bg-primary/15 ring-1 ring-primary/30">
            <Bug className="size-4 text-primary" />
          </div>
          <span className="font-semibold tracking-tight">BugTrack Pro</span>
        </Link>

        <div className="glass rounded-2xl p-6 sm:p-8">
          <h1 className="text-2xl font-semibold tracking-tight">
            {mode === "signup" ? "Create your account" : "Welcome back"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {mode === "signup" ? "Start tracking bugs across your projects." : "Sign in to your BugTrack Pro workspace."}
          </p>

          <button onClick={handleGoogle} disabled={loading}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-md border border-border bg-surface px-4 py-2.5 text-sm font-medium transition hover:bg-surface-2 disabled:opacity-50">
            <svg className="size-4" viewBox="0 0 24 24" aria-hidden><path fill="#EA4335" d="M12 10.2v3.9h5.5c-.24 1.5-1.68 4.4-5.5 4.4-3.3 0-6-2.75-6-6.15S8.7 6.2 12 6.2c1.9 0 3.16.8 3.9 1.5l2.65-2.55C16.9 3.6 14.7 2.6 12 2.6 6.9 2.6 2.8 6.7 2.8 12s4.1 9.4 9.2 9.4c5.3 0 8.8-3.7 8.8-8.95 0-.6-.07-1.05-.15-1.5H12z"/></svg>
            Continue with Google
          </button>

          <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
            <div className="h-px flex-1 bg-border" /> or email <div className="h-px flex-1 bg-border" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "signup" && (
              <>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Full name</label>
                  <input value={fullName} onChange={(e) => setFullName(e.target.value)} required maxLength={80}
                    className="w-full rounded-md border border-input bg-surface px-3 py-2 text-sm outline-none focus:border-primary" />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Role</label>
                  <div className="grid gap-2">
                    {roles.map((r) => (
                      <label key={r.value} className={`flex cursor-pointer items-start gap-3 rounded-md border p-3 text-sm transition ${role === r.value ? "border-primary bg-primary/10" : "border-border bg-surface hover:bg-surface-2"}`}>
                        <input type="radio" name="role" checked={role === r.value} onChange={() => setRole(r.value)} className="mt-0.5 accent-primary" />
                        <div>
                          <div className="font-medium">{r.label}</div>
                          <div className="text-xs text-muted-foreground">{r.desc}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              </>
            )}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required maxLength={255}
                className="w-full rounded-md border border-input bg-surface px-3 py-2 text-sm outline-none focus:border-primary" />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Password</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} maxLength={128}
                className="w-full rounded-md border border-input bg-surface px-3 py-2 text-sm outline-none focus:border-primary" />
            </div>
            <button disabled={loading} className="w-full rounded-md bg-primary py-2.5 text-sm font-medium text-primary-foreground shadow-lg shadow-primary/30 transition hover:bg-primary/90 disabled:opacity-50">
              {loading ? "Please wait…" : mode === "signup" ? "Create account" : "Sign in"}
            </button>
          </form>

          <p className="mt-5 text-center text-sm text-muted-foreground">
            {mode === "signup" ? (
              <>Have an account? <button onClick={() => setMode("signin")} className="text-primary hover:underline">Sign in</button></>
            ) : (
              <>New here? <button onClick={() => setMode("signup")} className="text-primary hover:underline">Create account</button></>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}