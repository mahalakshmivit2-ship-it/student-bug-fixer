import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bug, LayoutDashboard, FolderKanban, FileText, User, LogOut, Menu, X } from "lucide-react";
import { toast } from "sonner";

const nav = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/projects", label: "Projects", icon: FolderKanban },
  { to: "/reports", label: "Reports", icon: FileText },
  { to: "/profile", label: "Profile", icon: User },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);

  const { data: profile } = useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return null;
      const { data } = await supabase.from("profiles").select("*").eq("id", u.user.id).maybeSingle();
      return { user: u.user, profile: data };
    },
  });

  useEffect(() => { setOpen(false); }, [pathname]);

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    toast.success("Signed out");
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile top bar */}
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-background/80 px-4 py-3 backdrop-blur md:hidden">
        <Link to="/dashboard" className="flex items-center gap-2">
          <div className="flex size-7 items-center justify-center rounded-md bg-primary/15 ring-1 ring-primary/30"><Bug className="size-4 text-primary" /></div>
          <span className="font-semibold">BugTrack Pro</span>
        </Link>
        <button onClick={() => setOpen((v) => !v)} className="rounded-md border border-border bg-surface p-2">
          {open ? <X className="size-4" /> : <Menu className="size-4" />}
        </button>
      </div>

      <div className="md:flex">
        <aside className={`${open ? "block" : "hidden"} border-b border-border bg-sidebar md:sticky md:top-0 md:block md:h-screen md:w-64 md:border-b-0 md:border-r`}>
          <div className="hidden items-center gap-2 px-6 pt-6 md:flex">
            <div className="flex size-8 items-center justify-center rounded-md bg-primary/15 ring-1 ring-primary/30"><Bug className="size-4 text-primary" /></div>
            <span className="font-semibold tracking-tight">BugTrack Pro</span>
          </div>
          <nav className="mt-6 space-y-1 px-3">
            {nav.map((item) => {
              const active = pathname === item.to || pathname.startsWith(item.to + "/");
              return (
                <Link key={item.to} to={item.to} className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition ${active ? "bg-primary/15 text-primary ring-1 ring-primary/30" : "text-sidebar-foreground hover:bg-sidebar-accent"}`}>
                  <item.icon className="size-4" /> {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="mt-8 border-t border-border p-3 md:absolute md:bottom-0 md:w-64">
            <div className="rounded-md bg-surface p-3">
              <div className="truncate text-sm font-medium">{profile?.profile?.full_name ?? "User"}</div>
              <div className="truncate text-xs text-muted-foreground">{profile?.user?.email}</div>
              <div className="mt-2 inline-flex rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-primary ring-1 ring-primary/30">
                {profile?.profile?.primary_role?.replace("_", " ") ?? "student"}
              </div>
              <button onClick={signOut} className="mt-3 flex w-full items-center justify-center gap-2 rounded-md border border-border bg-background py-1.5 text-xs hover:bg-surface-2">
                <LogOut className="size-3.5" /> Sign out
              </button>
            </div>
          </div>
        </aside>

        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}