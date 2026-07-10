import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { Plus, FolderKanban, X } from "lucide-react";

export const Route = createFileRoute("/_authenticated/projects")({
  component: ProjectsPage,
});

const projectSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(2000).optional(),
  modules: z.string().trim().max(500).optional(),
});

function ProjectsPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", modules: "" });

  const { data: projects } = useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      const { data, error } = await supabase.from("projects").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: bugCounts } = useQuery({
    queryKey: ["project-bug-counts"],
    queryFn: async () => {
      const { data } = await supabase.from("bugs").select("project_id, status");
      const map: Record<string, { total: number; open: number }> = {};
      (data ?? []).forEach((b) => {
        const p = b.project_id as string;
        map[p] ??= { total: 0, open: 0 };
        map[p].total += 1;
        if (b.status !== "closed" && b.status !== "fixed") map[p].open += 1;
      });
      return map;
    },
  });

  async function createProject(e: React.FormEvent) {
    e.preventDefault();
    const parsed = projectSchema.safeParse(form);
    if (!parsed.success) { toast.error(parsed.error.issues[0]?.message ?? "Invalid"); return; }
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const modules = (form.modules || "").split(",").map((m) => m.trim()).filter(Boolean);
    const { error } = await supabase.from("projects").insert({
      owner_id: u.user.id,
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      modules,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Project created");
    setForm({ name: "", description: "", modules: "" });
    setOpen(false);
    qc.invalidateQueries({ queryKey: ["projects"] });
  }

  return (
    <div className="mx-auto max-w-7xl p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Projects</h1>
          <p className="text-sm text-muted-foreground">Create and manage your team's projects.</p>
        </div>
        <button onClick={() => setOpen(true)} className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground shadow-lg shadow-primary/30 hover:bg-primary/90">
          <Plus className="size-4" /> New project
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {(projects ?? []).map((p) => {
          const c = bugCounts?.[p.id] ?? { total: 0, open: 0 };
          return (
            <Link key={p.id} to="/projects/$projectId" params={{ projectId: p.id }} className="glass group rounded-2xl p-5 transition hover:border-primary/40">
              <div className="flex items-start justify-between">
                <div className="flex size-10 items-center justify-center rounded-lg bg-primary/15 ring-1 ring-primary/30">
                  <FolderKanban className="size-5 text-primary" />
                </div>
                <div className="text-right text-xs">
                  <div className="text-muted-foreground">{c.total} bugs</div>
                  <div className="mt-0.5 text-amber-300">{c.open} open</div>
                </div>
              </div>
              <h3 className="mt-4 font-semibold group-hover:text-primary">{p.name}</h3>
              <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{p.description || "No description"}</p>
              {p.modules?.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1">
                  {p.modules.slice(0, 4).map((m) => (
                    <span key={m} className="rounded bg-surface-2 px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">{m}</span>
                  ))}
                </div>
              )}
            </Link>
          );
        })}
        {projects && projects.length === 0 && (
          <div className="glass col-span-full rounded-2xl p-12 text-center">
            <FolderKanban className="mx-auto size-8 text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">No projects yet.</p>
            <button onClick={() => setOpen(true)} className="mt-3 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground">Create your first project</button>
          </div>
        )}
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 p-4 backdrop-blur">
          <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">New project</h2>
              <button onClick={() => setOpen(false)}><X className="size-4" /></button>
            </div>
            <form onSubmit={createProject} className="space-y-3">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Name</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required maxLength={120}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none" />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Description</label>
                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} maxLength={2000} rows={3}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none" />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Modules (comma separated)</label>
                <input value={form.modules} onChange={(e) => setForm({ ...form, modules: e.target.value })} placeholder="Auth, Dashboard, API"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none" />
              </div>
              <button className="mt-2 w-full rounded-md bg-primary py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">Create project</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}