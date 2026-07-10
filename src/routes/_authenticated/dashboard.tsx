import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, PieChart, Pie, Cell, Legend } from "recharts";
import { BUG_STATUSES, STATUS_LABELS, type BugStatus } from "@/lib/bug-types";
import { Bug, FolderKanban, AlertCircle, CheckCircle2, Clock, Activity, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

function StatCard({ label, value, icon: Icon, hue }: { label: string; value: number; icon: React.ElementType; hue: string }) {
  return (
    <div className="glass relative overflow-hidden rounded-2xl p-5">
      <div className={`absolute -right-4 -top-4 size-24 rounded-full opacity-30 blur-2xl ${hue}`} />
      <div className="relative flex items-start justify-between">
        <div>
          <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
          <div className="mt-2 font-mono text-3xl font-semibold">{value}</div>
        </div>
        <Icon className="size-5 text-muted-foreground" />
      </div>
    </div>
  );
}

function Dashboard() {
  const { data } = useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const [projects, bugs] = await Promise.all([
        supabase.from("projects").select("id, name, created_at"),
        supabase.from("bugs").select("id, code, title, status, priority, project_id, created_at, updated_at").order("updated_at", { ascending: false }),
      ]);
      return { projects: projects.data ?? [], bugs: bugs.data ?? [] };
    },
  });

  const bugs = data?.bugs ?? [];
  const projects = data?.projects ?? [];

  const counts = BUG_STATUSES.reduce((acc, s) => {
    acc[s] = bugs.filter((b) => b.status === s).length;
    return acc;
  }, {} as Record<BugStatus, number>);

  const statusChart = BUG_STATUSES.map((s) => ({ name: STATUS_LABELS[s], count: counts[s] }));
  const priorities = ["low", "medium", "high", "critical"] as const;
  const priorityChart = priorities.map((p) => ({ name: p, value: bugs.filter((b) => b.priority === p).length }));
  const priorityColors = ["#10b981", "#f59e0b", "#f97316", "#f43f5e"];

  const open = counts.new + counts.assigned + counts.reopened;
  const inProgress = counts.in_progress + counts.testing;
  const fixed = counts.fixed;
  const closed = counts.closed;

  return (
    <div className="mx-auto max-w-7xl p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">A live look at your team's bugs and progress.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Projects" value={projects.length} icon={FolderKanban} hue="bg-primary" />
        <StatCard label="Total Bugs" value={bugs.length} icon={Bug} hue="bg-accent" />
        <StatCard label="Open" value={open} icon={AlertCircle} hue="bg-sky-500" />
        <StatCard label="In Progress" value={inProgress} icon={Clock} hue="bg-amber-500" />
        <StatCard label="Fixed" value={fixed} icon={CheckCircle2} hue="bg-emerald-500" />
        <StatCard label="Closed" value={closed} icon={Activity} hue="bg-zinc-500" />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className="glass col-span-2 rounded-2xl p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-medium">Bugs by status</h2>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={statusChart}>
                <XAxis dataKey="name" stroke="var(--muted-foreground)" tick={{ fontSize: 11 }} />
                <YAxis stroke="var(--muted-foreground)" tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8 }} />
                <Bar dataKey="count" fill="var(--primary)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass rounded-2xl p-5">
          <h2 className="mb-4 text-sm font-medium">By priority</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={priorityChart} dataKey="value" nameKey="name" innerRadius={40} outerRadius={80} paddingAngle={2}>
                  {priorityChart.map((_, i) => <Cell key={i} fill={priorityColors[i]} />)}
                </Pie>
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="glass mt-6 rounded-2xl p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-medium">Recent activity</h2>
          <Link to="/projects" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">View projects <ArrowRight className="size-3" /></Link>
        </div>
        <div className="divide-y divide-border">
          {bugs.slice(0, 8).map((b) => (
            <Link key={b.id} to="/bugs/$bugId" params={{ bugId: b.id }} className="flex items-center justify-between py-2.5 text-sm hover:text-primary">
              <div className="flex min-w-0 items-center gap-3">
                <span className="font-mono text-xs text-muted-foreground">{b.code}</span>
                <span className="truncate">{b.title}</span>
              </div>
              <span className="text-xs text-muted-foreground">{new Date(b.updated_at).toLocaleDateString()}</span>
            </Link>
          ))}
          {bugs.length === 0 && (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No bugs yet. <Link to="/projects" className="text-primary hover:underline">Create a project</Link> and report your first bug.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}