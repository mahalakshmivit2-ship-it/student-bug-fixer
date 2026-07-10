import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import {
  BUG_STATUSES, BUG_PRIORITIES, BUG_SEVERITIES,
  STATUS_LABELS, STATUS_COLORS, PRIORITY_COLORS,
  type BugStatus, type BugPriority, type BugSeverity,
} from "@/lib/bug-types";
import { ArrowLeft, MessageSquare, Calendar, User as UserIcon } from "lucide-react";

export const Route = createFileRoute("/_authenticated/bugs/$bugId")({
  component: BugDetail,
});

const commentSchema = z.string().trim().min(1).max(2000);

function BugDetail() {
  const { bugId } = useParams({ from: "/_authenticated/bugs/$bugId" });
  const qc = useQueryClient();
  const [comment, setComment] = useState("");

  const { data: bug } = useQuery({
    queryKey: ["bug", bugId],
    queryFn: async () => {
      const { data, error } = await supabase.from("bugs").select("*").eq("id", bugId).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: participants } = useQuery({
    queryKey: ["bug-participants", bug?.reporter_id, bug?.assignee_id, bug?.project_id],
    enabled: !!bug,
    queryFn: async () => {
      const ids = [bug!.reporter_id, bug!.assignee_id].filter(Boolean) as string[];
      if (!ids.length) return { profiles: [], members: [] };
      const { data: profiles } = await supabase.from("profiles").select("id, full_name, primary_role").in("id", ids);
      const { data: members } = await supabase.from("project_members").select("user_id, profiles:profiles!inner(id, full_name)").eq("project_id", bug!.project_id);
      return { profiles: profiles ?? [], members: members ?? [] };
    },
  });

  const { data: comments } = useQuery({
    queryKey: ["comments", bugId],
    queryFn: async () => {
      const { data } = await supabase.from("comments").select("*").eq("bug_id", bugId).order("created_at");
      const ids = Array.from(new Set((data ?? []).map((c) => c.author_id)));
      const { data: profs } = ids.length ? await supabase.from("profiles").select("id, full_name").in("id", ids) : { data: [] };
      return (data ?? []).map((c) => ({ ...c, author: profs?.find((p) => p.id === c.author_id) }));
    },
  });

  async function updateField(patch: Record<string, unknown>) {
    const { error } = await supabase.from("bugs").update(patch).eq("id", bugId);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["bug", bugId] });
  }

  async function postComment(e: React.FormEvent) {
    e.preventDefault();
    const p = commentSchema.safeParse(comment);
    if (!p.success) return toast.error("Comment can't be empty or too long");
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { error } = await supabase.from("comments").insert({ bug_id: bugId, author_id: u.user.id, body: p.data });
    if (error) return toast.error(error.message);
    setComment("");
    qc.invalidateQueries({ queryKey: ["comments", bugId] });
  }

  if (!bug) return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;

  const reporter = participants?.profiles.find((p) => p.id === bug.reporter_id);
  const assignee = participants?.profiles.find((p) => p.id === bug.assignee_id);

  return (
    <div className="mx-auto max-w-5xl p-6">
      <Link to="/projects/$projectId" params={{ projectId: bug.project_id }} className="mb-4 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-3" /> Back to project
      </Link>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="flex items-center gap-2 text-xs">
            <span className="font-mono text-muted-foreground">{bug.code}</span>
            <span className={`rounded-full px-2 py-0.5 font-semibold uppercase ring-1 ${STATUS_COLORS[bug.status as BugStatus]}`}>{STATUS_LABELS[bug.status as BugStatus]}</span>
            <span className={`font-semibold uppercase ${PRIORITY_COLORS[bug.priority as BugPriority]}`}>{bug.priority}</span>
          </div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">{bug.title}</h1>
          {bug.description && <p className="mt-3 whitespace-pre-wrap text-sm text-muted-foreground">{bug.description}</p>}

          {bug.screenshot_url && (
            <div className="glass mt-4 rounded-2xl p-3">
              <div className="mb-2 text-xs font-medium text-muted-foreground">Screenshot</div>
              <img src={bug.screenshot_url} alt="Bug screenshot" className="max-h-96 w-full rounded-lg object-contain" />
            </div>
          )}

          <div className="glass mt-6 rounded-2xl p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-medium">
              <MessageSquare className="size-4" /> Comments <span className="text-xs text-muted-foreground">({comments?.length ?? 0})</span>
            </div>
            <ul className="space-y-3">
              {comments?.map((c) => (
                <li key={c.id} className="rounded-lg border border-border bg-surface p-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium">{c.author?.full_name ?? "Anonymous"}</span>
                    <span className="text-muted-foreground">{new Date(c.created_at).toLocaleString()}</span>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-sm">{c.body}</p>
                </li>
              ))}
              {comments?.length === 0 && <li className="py-4 text-center text-xs text-muted-foreground">No comments yet.</li>}
            </ul>
            <form onSubmit={postComment} className="mt-4 space-y-2">
              <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={2} placeholder="Add a comment…" maxLength={2000}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
              <button className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90">Post</button>
            </form>
          </div>
        </div>

        <aside className="glass h-max rounded-2xl p-4 text-sm">
          <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Details</h3>
          <dl className="mt-3 space-y-3">
            <div>
              <dt className="text-xs text-muted-foreground">Status</dt>
              <dd className="mt-1">
                <select value={bug.status} onChange={(e) => updateField({ status: e.target.value as BugStatus })} className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm">
                  {BUG_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                </select>
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Priority</dt>
              <dd className="mt-1">
                <select value={bug.priority} onChange={(e) => updateField({ priority: e.target.value as BugPriority })} className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm">
                  {BUG_PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Severity</dt>
              <dd className="mt-1">
                <select value={bug.severity} onChange={(e) => updateField({ severity: e.target.value as BugSeverity })} className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm">
                  {BUG_SEVERITIES.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Assignee</dt>
              <dd className="mt-1">
                <select value={bug.assignee_id ?? ""} onChange={(e) => updateField({ assignee_id: e.target.value || null })} className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm">
                  <option value="">Unassigned</option>
                  {participants?.members.map((m) => <option key={m.user_id} value={m.user_id}>{m.profiles.full_name}</option>)}
                </select>
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Due date</dt>
              <dd className="mt-1">
                <input type="date" value={bug.due_date ?? ""} onChange={(e) => updateField({ due_date: e.target.value || null })} className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm" />
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Module</dt>
              <dd className="mt-1 font-mono text-xs">{bug.module ?? "—"}</dd>
            </div>
            <div className="border-t border-border pt-3">
              <dt className="text-xs text-muted-foreground flex items-center gap-1"><UserIcon className="size-3" /> Reporter</dt>
              <dd className="mt-1">{reporter?.full_name ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground flex items-center gap-1"><UserIcon className="size-3" /> Assignee</dt>
              <dd className="mt-1">{assignee?.full_name ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground flex items-center gap-1"><Calendar className="size-3" /> Created</dt>
              <dd className="mt-1">{new Date(bug.created_at).toLocaleString()}</dd>
            </div>
          </dl>
        </aside>
      </div>
    </div>
  );
}