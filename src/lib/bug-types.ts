export const BUG_STATUSES = ["new", "assigned", "in_progress", "testing", "fixed", "closed", "reopened"] as const;
export type BugStatus = (typeof BUG_STATUSES)[number];

export const BUG_PRIORITIES = ["low", "medium", "high", "critical"] as const;
export type BugPriority = (typeof BUG_PRIORITIES)[number];

export const BUG_SEVERITIES = ["minor", "major", "blocker"] as const;
export type BugSeverity = (typeof BUG_SEVERITIES)[number];

export const STATUS_LABELS: Record<BugStatus, string> = {
  new: "New",
  assigned: "Assigned",
  in_progress: "In Progress",
  testing: "Testing",
  fixed: "Fixed",
  closed: "Closed",
  reopened: "Reopened",
};

export const STATUS_COLORS: Record<BugStatus, string> = {
  new: "bg-sky-500/15 text-sky-300 ring-sky-500/30",
  assigned: "bg-violet-500/15 text-violet-300 ring-violet-500/30",
  in_progress: "bg-amber-500/15 text-amber-300 ring-amber-500/30",
  testing: "bg-fuchsia-500/15 text-fuchsia-300 ring-fuchsia-500/30",
  fixed: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30",
  closed: "bg-zinc-500/15 text-zinc-300 ring-zinc-500/30",
  reopened: "bg-rose-500/15 text-rose-300 ring-rose-500/30",
};

export const PRIORITY_COLORS: Record<BugPriority, string> = {
  low: "text-emerald-300",
  medium: "text-amber-300",
  high: "text-orange-300",
  critical: "text-rose-300",
};

export const NEXT_STATUS: Record<BugStatus, BugStatus[]> = {
  new: ["assigned", "in_progress", "closed"],
  assigned: ["in_progress", "closed", "reopened"],
  in_progress: ["testing", "fixed", "assigned"],
  testing: ["fixed", "in_progress", "reopened"],
  fixed: ["closed", "reopened"],
  closed: ["reopened"],
  reopened: ["assigned", "in_progress"],
};

export function downloadCSV(filename: string, rows: Record<string, unknown>[]) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const escape = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [headers.join(","), ...rows.map((r) => headers.map((h) => escape(r[h])).join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}