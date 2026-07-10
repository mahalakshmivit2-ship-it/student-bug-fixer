import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

export const Route = createFileRoute("/_authenticated/profile")({
  component: ProfilePage,
});

const schema = z.object({ full_name: z.string().trim().min(2).max(80) });

function ProfilePage() {
  const qc = useQueryClient();
  const [fullName, setFullName] = useState("");

  const { data } = useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return null;
      const { data: p } = await supabase.from("profiles").select("*").eq("id", u.user.id).maybeSingle();
      return { user: u.user, profile: p };
    },
  });

  useEffect(() => { if (data?.profile?.full_name) setFullName(data.profile.full_name); }, [data]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const p = schema.safeParse({ full_name: fullName });
    if (!p.success) return toast.error(p.error.issues[0]?.message ?? "Invalid");
    const { error } = await supabase.from("profiles").update({ full_name: p.data.full_name }).eq("id", data!.user.id);
    if (error) return toast.error(error.message);
    toast.success("Saved");
    qc.invalidateQueries({ queryKey: ["me"] });
  }

  return (
    <div className="mx-auto max-w-2xl p-6">
      <h1 className="text-2xl font-semibold tracking-tight">Profile</h1>
      <p className="text-sm text-muted-foreground">Manage your account details.</p>

      <form onSubmit={save} className="glass mt-6 space-y-4 rounded-2xl p-6">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Email</label>
          <input value={data?.user.email ?? ""} readOnly className="w-full rounded-md border border-input bg-surface-2 px-3 py-2 text-sm text-muted-foreground" />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Full name</label>
          <input value={fullName} onChange={(e) => setFullName(e.target.value)} maxLength={80} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Role</label>
          <div className="inline-flex rounded-full bg-primary/15 px-2 py-1 text-xs font-medium uppercase tracking-wide text-primary ring-1 ring-primary/30">
            {data?.profile?.primary_role?.replace("_", " ") ?? "student"}
          </div>
        </div>
        <button className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">Save changes</button>
      </form>
    </div>
  );
}