import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { Bug, LayoutDashboard, Kanban, ShieldCheck, BarChart3, ArrowRight, Sparkles } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Landing,
});

function Feature({ icon: Icon, title, body }: { icon: React.ElementType; title: string; body: string }) {
  return (
    <div className="glass rounded-2xl p-6 transition hover:border-primary/40">
      <div className="flex size-10 items-center justify-center rounded-lg bg-primary/15 text-primary ring-1 ring-primary/30">
        <Icon className="size-5" />
      </div>
      <h3 className="mt-4 text-lg font-semibold">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground leading-relaxed">{body}</p>
    </div>
  );
}

function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="grid-bg absolute inset-0 -z-10 opacity-40" />
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-md bg-primary/15 ring-1 ring-primary/30">
            <Bug className="size-4 text-primary" />
          </div>
          <span className="font-semibold tracking-tight">BugTrack Pro</span>
        </div>
        <nav className="flex items-center gap-2 text-sm">
          <Link to="/auth" className="rounded-md px-3 py-1.5 text-muted-foreground hover:text-foreground">Sign in</Link>
          <Link to="/auth" search={{ mode: "signup" }} className="rounded-md bg-primary px-3 py-1.5 font-medium text-primary-foreground hover:bg-primary/90">
            Get started
          </Link>
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-6">
        <section className="pt-16 pb-24 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs text-muted-foreground">
            <Sparkles className="size-3 text-accent" /> Built for student project teams
          </div>
          <h1 className="mt-6 text-5xl font-semibold tracking-tight text-gradient sm:text-7xl">
            Ship college projects<br />without the chaos.
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-base text-muted-foreground sm:text-lg">
            BugTrack Pro is a modern bug tracker for student teams — report issues, assign work, run a Kanban board, and see the whole picture in one dashboard.
          </p>
          <div className="mt-8 flex justify-center gap-3">
            <Link to="/auth" search={{ mode: "signup" }} className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-lg shadow-primary/30 transition hover:bg-primary/90">
              Create your team <ArrowRight className="size-4" />
            </Link>
            <Link to="/auth" className="rounded-md border border-border bg-surface px-5 py-2.5 text-sm font-medium hover:bg-surface-2">
              Sign in
            </Link>
          </div>
        </section>

        <section className="grid gap-4 pb-24 sm:grid-cols-2 lg:grid-cols-3">
          <Feature icon={Kanban} title="Kanban workflow" body="New → Assigned → In Progress → Testing → Fixed → Closed. Drag-free status updates with one click." />
          <Feature icon={LayoutDashboard} title="Live dashboard" body="Colorful cards and interactive charts show open, in-progress, fixed, and closed bugs at a glance." />
          <Feature icon={ShieldCheck} title="Role-based access" body="Students, Team Leaders, and Faculty each get the right permissions — enforced by database policies." />
          <Feature icon={Bug} title="Full bug details" body="Priority, severity, module, assignee, due date, screenshots, and threaded comments." />
          <Feature icon={BarChart3} title="Reports" body="Export bugs and team performance to CSV. Faculty can monitor project progress across the board." />
          <Feature icon={Sparkles} title="Modern UI" body="A calm dark interface tuned for long coding sessions. Keyboard-friendly, fast, responsive." />
        </section>
      </main>

      <footer className="border-t border-border py-8 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} BugTrack Pro — Student bug tracking, done right.
      </footer>
    </div>
  );
}
