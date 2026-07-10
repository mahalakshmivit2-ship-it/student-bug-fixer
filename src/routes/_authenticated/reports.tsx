import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { downloadCSV, BUG_STATUSES, STATUS_LABELS } from "@/lib/bug-types";
import { Download, FileText } from "lucide-react";

export const Route = createFileRoute("/_authenticated/reports")({
  component: ReportsPage,
});

function ReportsPage() {
  const { data } = useQuery({
    queryKey: ["reports"],
    queryFn: async () => {
      const [projects, bugs] = await Promise.all([
        supabase.from("projects").select("id, name"),
        supabase.from("bugs").select("code, title, status, priority, severity, project_id, due_date, created_at, updated_at"),
      ]);
      return { projects: projects.data ?? [], bugs: bugs.data ?? [] };
    },
  });

  const bugs = data?.bugs ?? [];
  const projects = data?.projects ?? [];
  const projectMap = Object.fromEntries(projects.map((p) => [p.id, p.name]));

  const summary = projects.map((p) => {
    const pb = bugs.filter((b) => b.project_id === p.id);
    const row: Record<string, unknown> = { project: p.name, total: pb.length };
    BUG_STATUSES.forEach((s) => { row[STATUS_LABELS[s]] = pb.filter((b) => b.status === s).length; });
    return row;
  });

  return (
    <div className="mx-auto max-w-6xl p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Reports</h1>
        <p className="text-sm text-muted-foreground">Export bug data and project summaries.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <button onClick={() => downloadCSV("bug-report.csv", bugs.map((b) => ({ ...b, project: projectMap[b.project_id] ?? b.project_id })))}
          className="glass rounded-2xl p-6 text-left transition hover:border-primary/40">
          <div className="flex size-10 items-center justify-center rounded-lg bg-primary/15 text-primary ring-1 ring-primary/30">
            <Download className="size-5" />
          </div>
          <h3 className="mt-4 font-semibold">All bugs (CSV)</h3>
          <p className="mt-1 text-sm text-muted-foreground">Download every bug across every project you have access to.</p>
          <span className="mt-3 inline-block text-xs text-primary">{bugs.length} rows →</span>
        </button>

        <button onClick={() => downloadCSV("project-summary.csv", summary)}
          className="glass rounded-2xl p-6 text-left transition hover:border-primary/40">
          <div className="flex size-10 items-center justify-center rounded-lg bg-accent/15 text-accent ring-1 ring-accent/30">
            <FileText className="size-5" />
          </div>
          <h3 className="mt-4 font-semibold">Project summary (CSV)</h3>
          <p className="mt-1 text-sm text-muted-foreground">Bug counts by status for each of your projects.</p>
          <span className="mt-3 inline-block text-xs text-accent">{projects.length} projects →</span>
        </button>
      </div>

      <div className="glass mt-8 overflow-hidden rounded-2xl">
        <div className="border-b border-border p-4 text-sm font-medium">Project summary</div>
        <table className="w-full text-sm">
          <thead className="bg-surface-2 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-2 text-left">Project</th>
              <th className="px-4 py-2 text-right">Total</th>
              {BUG_STATUSES.map((s) => <th key={s} className="px-4 py-2 text-right">{STATUS_LABELS[s]}</th>)}
            </tr>
          </thead>
          <tbody>
            {summary.map((r, i) => (
              <tr key={i} className="border-t border-border">
                <td className="px-4 py-2">{String(r.project)}</td>
                <td className="px-4 py-2 text-right font-mono">{String(r.total)}</td>
                {BUG_STATUSES.map((s) => <td key={s} className="px-4 py-2 text-right font-mono">{String(r[STATUS_LABELS[s]] ?? 0)}</td>)}
              </tr>
            ))}
            {summary.length === 0 && <tr><td colSpan={9} className="px-4 py-8 text-center text-sm text-muted-foreground">No projects yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}