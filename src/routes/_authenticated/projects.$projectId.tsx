import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import {
  BUG_STATUSES, BUG_PRIORITIES, BUG_SEVERITIES, STATUS_LABELS, STATUS_COLORS, PRIORITY_COLORS, NEXT_STATUS, downloadCSV,
  type BugStatus, type BugPriority, type BugSeverity,
} from "@/lib/bug-types";
import { Plus, X, UserPlus, Download, Filter, ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/_authenticated/projects/$projectId")({
  component: ProjectDetail,
});

const bugSchema = z.object({
  title: z.string().trim().min(3).max(200),
  description: z.string().trim().max(5000).optional(),
  module: z.string().trim().max(80).optional(),
  priority: z.enum(BUG_PRIORITIES),
  severity: z.enum(BUG_SEVERITIES),
  due_date: z.string().optional(),
  assignee_id: z.string().uuid().optional().or(z.literal("")),
});

function StatusBadge({ status }: { status: BugStatus }) {
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium uppercase ring-1 ${STATUS_COLORS[status]}`}>{STATUS_LABELS[status]}</span>;
}

function ProjectDetail() {
  const { projectId } = useParams({ from: "/_authenticated/projects/$projectId" });
  const qc = useQueryClient();
  const [tab, setTab] = useState<"kanban" | "list" | "team">("kanban");
  const [showNewBug, setShowNewBug] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);
  const [filter, setFilter] = useState({ priority: "", assignee: "", search: "" });

  const { data: project } = useQuery({
    queryKey: ["project", projectId],
    queryFn: async () => {
      const { data, error } = await supabase.from("projects").select("*").eq("id", projectId).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: members } = useQuery({
    queryKey: ["members", projectId],
    queryFn: async () => {
      const { data } = await supabase.from("project_members").select("user_id, role").eq("project_id", projectId);
      const ids = (data ?? []).map((m) => m.user_id);
      if (!ids.length) return [];
      const { data: profs } = await supabase.from("profiles").select("id, full_name, avatar_url, primary_role").in("id", ids);
      return (data ?? []).map((m) => ({ ...m, profile: profs?.find((p) => p.id === m.user_id) }));
    },
  });

  const { data: bugs } = useQuery({
    queryKey: ["bugs", projectId],
    queryFn: async () => {
      const { data, error } = await supabase.from("bugs").select("*").eq("project_id", projectId).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const filtered = useMemo(() => {
    return (bugs ?? []).filter((b) => {
      if (filter.priority && b.priority !== filter.priority) return false;
      if (filter.assignee && b.assignee_id !== filter.assignee) return false;
      if (filter.search && !`${b.title} ${b.code} ${b.module ?? ""}`.toLowerCase().includes(filter.search.toLowerCase())) return false;
      return true;
    });
  }, [bugs, filter]);

  async function updateStatus(bugId: string, status: BugStatus) {
    const { error } = await supabase.from("bugs").update({ status }).eq("id", bugId);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["bugs", projectId] });
  }

  function exportCsv() {
    if (!filtered.length) return toast.error("No bugs to export");
    downloadCSV(`${project?.name ?? "bugs"}-report.csv`, filtered.map((b) => ({
      code: b.code, title: b.title, module: b.module ?? "", priority: b.priority, severity: b.severity,
      status: b.status, due_date: b.due_date ?? "", created_at: b.created_at,
    })));
  }

  return (
    <div className="mx-auto max-w-7xl p-6">
      <Link to="/projects" className="mb-4 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-3" /> Projects
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{project?.name ?? "…"}</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{project?.description || "No description"}</p>
          {project?.modules?.length ? (
            <div className="mt-2 flex flex-wrap gap-1">
              {project.modules.map((m: string) => (
                <span key={m} className="rounded bg-surface-2 px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">{m}</span>
              ))}
            </div>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={exportCsv} className="inline-flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 text-sm hover:bg-surface-2"><Download className="size-4" /> Export CSV</button>
          <button onClick={() => setShowAddMember(true)} className="inline-flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 text-sm hover:bg-surface-2"><UserPlus className="size-4" /> Add member</button>
          <button onClick={() => setShowNewBug(true)} className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground shadow-lg shadow-primary/30 hover:bg-primary/90"><Plus className="size-4" /> Report bug</button>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-2 border-b border-border">
        {(["kanban", "list", "team"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`px-3 py-2 text-sm capitalize ${tab === t ? "border-b-2 border-primary text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
            {t}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="glass mt-4 flex flex-wrap items-center gap-2 rounded-xl p-3 text-xs">
        <Filter className="size-3.5 text-muted-foreground" />
        <input value={filter.search} onChange={(e) => setFilter({ ...filter, search: e.target.value })} placeholder="Search bugs…" className="min-w-40 flex-1 rounded-md border border-input bg-background px-2 py-1.5 text-xs" />
        <select value={filter.priority} onChange={(e) => setFilter({ ...filter, priority: e.target.value })} className="rounded-md border border-input bg-background px-2 py-1.5 text-xs">
          <option value="">All priorities</option>
          {BUG_PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <select value={filter.assignee} onChange={(e) => setFilter({ ...filter, assignee: e.target.value })} className="rounded-md border border-input bg-background px-2 py-1.5 text-xs">
          <option value="">All members</option>
          {members?.map((m) => <option key={m.user_id} value={m.user_id}>{m.profile?.full_name ?? m.user_id.slice(0, 8)}</option>)}
        </select>
        {(filter.priority || filter.assignee || filter.search) && (
          <button onClick={() => setFilter({ priority: "", assignee: "", search: "" })} className="text-muted-foreground hover:text-foreground">clear</button>
        )}
      </div>

      {tab === "kanban" && (
        <div className="mt-4 flex gap-3 overflow-x-auto pb-4">
          {BUG_STATUSES.filter((s) => s !== "reopened").map((s) => {
            const col = filtered.filter((b) => b.status === s);
            return (
              <div key={s} className="glass w-72 shrink-0 rounded-2xl p-3">
                <div className="mb-3 flex items-center justify-between">
                  <StatusBadge status={s} />
                  <span className="text-xs text-muted-foreground">{col.length}</span>
                </div>
                <div className="space-y-2">
                  {col.map((b) => (
                    <div key={b.id} className="rounded-lg border border-border bg-surface p-3 transition hover:border-primary/40">
                      <Link to="/bugs/$bugId" params={{ bugId: b.id }} className="block">
                        <div className="flex items-center justify-between text-[10px]">
                          <span className="font-mono text-muted-foreground">{b.code}</span>
                          <span className={`font-semibold uppercase ${PRIORITY_COLORS[b.priority as BugPriority]}`}>{b.priority}</span>
                        </div>
                        <div className="mt-1 line-clamp-2 text-sm">{b.title}</div>
                        {b.module && <div className="mt-2 inline-flex rounded bg-surface-2 px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">{b.module}</div>}
                      </Link>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {NEXT_STATUS[b.status as BugStatus].map((ns) => (
                          <button key={ns} onClick={() => updateStatus(b.id, ns)} className="rounded bg-surface-2 px-1.5 py-0.5 text-[10px] hover:bg-primary hover:text-primary-foreground">
                            → {STATUS_LABELS[ns]}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                  {col.length === 0 && <div className="rounded-lg border border-dashed border-border py-8 text-center text-xs text-muted-foreground">Empty</div>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {tab === "list" && (
        <div className="glass mt-4 overflow-hidden rounded-2xl">
          <table className="w-full text-sm">
            <thead className="bg-surface-2 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-2 text-left">Code</th>
                <th className="px-4 py-2 text-left">Title</th>
                <th className="px-4 py-2 text-left">Module</th>
                <th className="px-4 py-2 text-left">Priority</th>
                <th className="px-4 py-2 text-left">Status</th>
                <th className="px-4 py-2 text-left">Due</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((b) => (
                <tr key={b.id} className="border-t border-border hover:bg-surface-2">
                  <td className="px-4 py-2 font-mono text-xs">{b.code}</td>
                  <td className="px-4 py-2"><Link to="/bugs/$bugId" params={{ bugId: b.id }} className="hover:text-primary">{b.title}</Link></td>
                  <td className="px-4 py-2 text-muted-foreground">{b.module ?? "—"}</td>
                  <td className={`px-4 py-2 font-medium ${PRIORITY_COLORS[b.priority as BugPriority]}`}>{b.priority}</td>
                  <td className="px-4 py-2"><StatusBadge status={b.status as BugStatus} /></td>
                  <td className="px-4 py-2 text-muted-foreground">{b.due_date ?? "—"}</td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-muted-foreground">No bugs match filters.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {tab === "team" && (
        <div className="glass mt-4 rounded-2xl p-4">
          <h3 className="mb-3 text-sm font-medium">Team members</h3>
          <ul className="divide-y divide-border">
            {(members ?? []).map((m) => (
              <li key={m.user_id} className="flex items-center justify-between py-3 text-sm">
                <div>
                  <div className="font-medium">{m.profile?.full_name ?? m.user_id.slice(0, 8)}</div>
                  <div className="text-xs text-muted-foreground capitalize">{m.role.replace("_", " ")}</div>
                </div>
              </li>
            ))}
            {members?.length === 0 && <li className="py-8 text-center text-sm text-muted-foreground">Just you for now. Add a member by their email.</li>}
          </ul>
        </div>
      )}

      {showNewBug && <NewBugModal projectId={projectId} members={members ?? []} onClose={() => setShowNewBug(false)} />}
      {showAddMember && <AddMemberModal projectId={projectId} onClose={() => setShowAddMember(false)} />}
    </div>
  );
}

function NewBugModal({ projectId, members, onClose }: { projectId: string; members: { user_id: string; profile?: { full_name?: string | null } | undefined }[]; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    title: "", description: "", module: "",
    priority: "medium" as BugPriority, severity: "major" as BugSeverity,
    due_date: "", assignee_id: "",
  });
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = bugSchema.safeParse(form);
    if (!parsed.success) return toast.error(parsed.error.issues[0]?.message ?? "Invalid input");
    setUploading(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not signed in");

      let screenshot_url: string | null = null;
      if (file) {
        const path = `${u.user.id}/${crypto.randomUUID()}-${file.name}`;
        const up = await supabase.storage.from("bug-screenshots").upload(path, file);
        if (up.error) throw up.error;
        const signed = await supabase.storage.from("bug-screenshots").createSignedUrl(path, 60 * 60 * 24 * 365);
        screenshot_url = signed.data?.signedUrl ?? null;
      }

      const { error } = await supabase.from("bugs").insert({
        project_id: projectId,
        reporter_id: u.user.id,
        assignee_id: form.assignee_id || null,
        title: parsed.data.title,
        description: parsed.data.description ?? null,
        module: parsed.data.module || null,
        priority: parsed.data.priority,
        severity: parsed.data.severity,
        due_date: form.due_date || null,
        status: form.assignee_id ? "assigned" : "new",
        screenshot_url,
      });
      if (error) throw error;
      toast.success("Bug reported");
      qc.invalidateQueries({ queryKey: ["bugs", projectId] });
      onClose();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to create bug");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 p-4 backdrop-blur">
      <div className="w-full max-w-lg rounded-2xl border border-border bg-surface p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Report a bug</h2>
          <button onClick={onClose}><X className="size-4" /></button>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required maxLength={200} placeholder="Title" className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
          <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} maxLength={5000} rows={4} placeholder="Steps to reproduce, expected vs actual…" className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
          <div className="grid grid-cols-2 gap-3">
            <input value={form.module} onChange={(e) => setForm({ ...form, module: e.target.value })} maxLength={80} placeholder="Module (e.g. Auth)" className="rounded-md border border-input bg-background px-3 py-2 text-sm" />
            <input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} className="rounded-md border border-input bg-background px-3 py-2 text-sm" />
            <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value as BugPriority })} className="rounded-md border border-input bg-background px-3 py-2 text-sm">
              {BUG_PRIORITIES.map((p) => <option key={p} value={p}>Priority: {p}</option>)}
            </select>
            <select value={form.severity} onChange={(e) => setForm({ ...form, severity: e.target.value as BugSeverity })} className="rounded-md border border-input bg-background px-3 py-2 text-sm">
              {BUG_SEVERITIES.map((p) => <option key={p} value={p}>Severity: {p}</option>)}
            </select>
            <select value={form.assignee_id} onChange={(e) => setForm({ ...form, assignee_id: e.target.value })} className="col-span-2 rounded-md border border-input bg-background px-3 py-2 text-sm">
              <option value="">Unassigned</option>
              {members.map((m) => <option key={m.user_id} value={m.user_id}>{m.profile?.full_name ?? m.user_id.slice(0, 8)}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Screenshot (optional)</label>
            <input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="w-full text-xs" />
          </div>
          <button disabled={uploading} className="w-full rounded-md bg-primary py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
            {uploading ? "Saving…" : "Report bug"}
          </button>
        </form>
      </div>
    </div>
  );
}

function AddMemberModal({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"student" | "team_leader">("student");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const { data: prof, error } = await supabase.from("profiles").select("id").ilike("full_name", email.trim()).limit(1).maybeSingle();
      // Fallback: search by email using auth via id lookup is not available; instructor should use full name match.
      if (error) throw error;
      if (!prof) throw new Error("Member not found. Enter their full name exactly as on their profile.");
      const { error: insErr } = await supabase.from("project_members").insert({ project_id: projectId, user_id: prof.id, role });
      if (insErr) throw insErr;
      toast.success("Member added");
      qc.invalidateQueries({ queryKey: ["members", projectId] });
      onClose();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 p-4 backdrop-blur">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-surface p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Add member</h2>
          <button onClick={onClose}><X className="size-4" /></button>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Full name (as on their profile)</label>
            <input value={email} onChange={(e) => setEmail(e.target.value)} required className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
          </div>
          <select value={role} onChange={(e) => setRole(e.target.value as typeof role)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
            <option value="student">Student</option>
            <option value="team_leader">Team Leader</option>
          </select>
          <button disabled={loading} className="w-full rounded-md bg-primary py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">Add</button>
        </form>
      </div>
    </div>
  );
}