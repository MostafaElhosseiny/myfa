import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Plus, Trash2, Save, LogOut, Download, RotateCcw, Play, Pause, Square, X, Users, ListChecks } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  createChallenge,
  updateChallenge,
  deleteChallenge,
  setCompetitionState,
  resetCompetition,
  resetPlayer,
  deletePlayer,
  getAdminChallenges,
  getAdminSubmissions,
  getAdminPlayers,
  exportLeaderboardCsv,
} from "@/lib/admin.functions";
import { Nav } from "@/components/ctf/Nav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminPage,
});

type ChallengeRow = {
  id: string;
  title: string;
  description: string;
  category: string;
  required_flags: number;
  points_per_flag: number;
  active: boolean;
  created_at: string;
};

function AdminPage() {
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    (async () => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return setIsAdmin(false);
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.user.id)
        .eq("role", "admin")
        .maybeSingle();
      setIsAdmin(!!data);
    })();
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  }

  if (isAdmin === null) {
    return (
      <div className="min-h-screen">
        <Nav />
        <div className="mx-auto max-w-4xl p-10 text-muted-foreground">Loading…</div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen">
        <Nav />
        <main className="mx-auto max-w-lg p-10">
          <div className="glass rounded-2xl p-8 text-center">
            <h1 className="text-xl font-bold">Not authorized</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              This account is signed in, but does not have the admin role.
            </p>
            <Button onClick={signOut} className="mt-6">Sign out</Button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Nav />
      <main className="mx-auto max-w-7xl px-4 py-8 space-y-6">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Admin console</h1>
            <p className="text-sm text-muted-foreground">Manage the competition.</p>
          </div>
          <Button variant="outline" onClick={signOut}>
            <LogOut className="mr-2 h-4 w-4" /> Sign out
          </Button>
        </header>

        <CompetitionControls />

        <Tabs defaultValue="challenges" className="w-full">
          <TabsList className="glass">
            <TabsTrigger value="challenges"><ListChecks className="mr-2 h-4 w-4" /> Challenges</TabsTrigger>
            <TabsTrigger value="players"><Users className="mr-2 h-4 w-4" /> Players</TabsTrigger>
            <TabsTrigger value="submissions">Submissions</TabsTrigger>
          </TabsList>
          <TabsContent value="challenges" className="mt-4"><ChallengesTab /></TabsContent>
          <TabsContent value="players" className="mt-4"><PlayersTab /></TabsContent>
          <TabsContent value="submissions" className="mt-4"><SubmissionsTab /></TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

function CompetitionControls() {
  const stateQ = useQuery({
    queryKey: ["comp", "state"],
    queryFn: async () => {
      const { data } = await supabase.from("competition_state").select("*").eq("id", 1).single();
      return data;
    },
  });
  const setState = useServerFn(setCompetitionState);
  const reset = useServerFn(resetCompetition);
  const exportCsv = useServerFn(exportLeaderboardCsv);
  const qc = useQueryClient();

  async function change(status: "live" | "paused" | "finished") {
    try {
      await setState({ data: { status } });
      qc.invalidateQueries();
      toast.success(`Competition ${status}`);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function setEnd(mins: number) {
    const ends = new Date(Date.now() + mins * 60_000).toISOString();
    await setState({ data: { status: "live", ends_at: ends } });
    qc.invalidateQueries();
    toast.success(`Ends in ${mins} min`);
  }

  async function doReset() {
    if (!confirm("Reset ALL player progress, submissions and activity? Challenges stay.")) return;
    await reset();
    qc.invalidateQueries();
    toast.success("Competition reset");
  }

  async function doExport() {
    const { csv } = await exportCsv();
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `leaderboard-${new Date().toISOString()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const s = stateQ.data;
  return (
    <div className="glass rounded-2xl p-5 flex flex-wrap items-center gap-3">
      <div>
        <div className="text-xs uppercase tracking-widest text-muted-foreground">Status</div>
        <div className="font-mono text-lg font-bold">{s?.status?.toUpperCase() ?? "…"}</div>
      </div>
      <div className="ml-auto flex flex-wrap gap-2">
        <Button size="sm" onClick={() => change("live")} className="bg-cyber-lime/20 text-cyber-lime hover:bg-cyber-lime/30"><Play className="mr-1 h-4 w-4" />Live</Button>
        <Button size="sm" onClick={() => change("paused")} variant="outline"><Pause className="mr-1 h-4 w-4" />Pause</Button>
        <Button size="sm" onClick={() => change("finished")} variant="outline"><Square className="mr-1 h-4 w-4" />Finish</Button>
        <Button size="sm" variant="outline" onClick={() => setEnd(60)}>+60m</Button>
        <Button size="sm" variant="outline" onClick={() => setEnd(180)}>+3h</Button>
        <Button size="sm" variant="outline" onClick={doExport}><Download className="mr-1 h-4 w-4" />CSV</Button>
        <Button size="sm" variant="destructive" onClick={doReset}><RotateCcw className="mr-1 h-4 w-4" />Reset all</Button>
      </div>
    </div>
  );
}

function ChallengesTab() {
  const list = useServerFn(getAdminChallenges);
  const del = useServerFn(deleteChallenge);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["admin", "challenges"], queryFn: () => list() });
  const [editing, setEditing] = useState<ChallengeRow | null>(null);
  const [creating, setCreating] = useState(false);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Challenges ({q.data?.length ?? 0})</h2>
        <Button onClick={() => setCreating(true)}><Plus className="mr-1 h-4 w-4" /> New challenge</Button>
      </div>
      <div className="grid gap-3">
        {(q.data ?? []).map((c) => (
          <div key={c.id} className="glass rounded-xl p-4 flex items-center justify-between gap-3">
            <div>
              <div className="text-xs font-mono text-cyber-cyan uppercase">{c.category}</div>
              <div className="font-bold">{c.title}</div>
              <div className="text-xs text-muted-foreground">
                {c.required_flags} flags · {c.points_per_flag} pts each · {c.active ? "active" : "inactive"}
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setEditing(c as ChallengeRow)}>Edit</Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={async () => {
                  if (!confirm(`Delete "${c.title}"?`)) return;
                  await del({ data: { id: c.id } });
                  qc.invalidateQueries();
                  toast.success("Deleted");
                }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      {creating ? <ChallengeForm onClose={() => setCreating(false)} /> : null}
      {editing ? <ChallengeForm existing={editing} onClose={() => setEditing(null)} /> : null}
    </div>
  );
}

function ChallengeForm({ existing, onClose }: { existing?: ChallengeRow; onClose: () => void }) {
  const create = useServerFn(createChallenge);
  const update = useServerFn(updateChallenge);
  const qc = useQueryClient();
  const [title, setTitle] = useState(existing?.title ?? "");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [category, setCategory] = useState(existing?.category ?? "Misc");
  const [pointsPerFlag, setPointsPerFlag] = useState(existing?.points_per_flag ?? 100);
  const [active, setActive] = useState(existing?.active ?? true);
  const [flags, setFlags] = useState<string[]>(existing ? [] : [""]);
  const [replaceFlags, setReplaceFlags] = useState(!existing);

  const requiredFlags = existing && !replaceFlags ? existing.required_flags : flags.length;

  const mut = useMutation({
    mutationFn: async () => {
      const payload = {
        title,
        description,
        category,
        required_flags: requiredFlags,
        points_per_flag: pointsPerFlag,
        active,
        flags: flags.map((f) => f.trim()).filter(Boolean),
      };
      if (existing) {
        return update({ data: { ...payload, id: existing.id, replaceFlags } });
      }
      return create({ data: payload });
    },
    onSuccess: () => {
      qc.invalidateQueries();
      toast.success(existing ? "Challenge updated" : "Challenge created");
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="glass border-glass-border sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{existing ? "Edit challenge" : "New challenge"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-xs uppercase tracking-widest text-muted-foreground">Title</label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1 font-mono" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs uppercase tracking-widest text-muted-foreground">Category</label>
              <Input value={category} onChange={(e) => setCategory(e.target.value)} className="mt-1 font-mono" />
            </div>
            <div>
              <label className="text-xs uppercase tracking-widest text-muted-foreground">Points / flag</label>
              <Input type="number" value={pointsPerFlag} onChange={(e) => setPointsPerFlag(Number(e.target.value))} className="mt-1 font-mono" />
            </div>
          </div>
          <div>
            <label className="text-xs uppercase tracking-widest text-muted-foreground">Description</label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} className="mt-1" rows={3} />
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={active} onCheckedChange={setActive} id="active" />
            <label htmlFor="active" className="text-sm">Active (visible to players)</label>
          </div>

          {existing ? (
            <div className="flex items-center gap-2">
              <Switch checked={replaceFlags} onCheckedChange={setReplaceFlags} id="replace" />
              <label htmlFor="replace" className="text-sm">Replace flags (resets progress on this challenge)</label>
            </div>
          ) : null}

          {(!existing || replaceFlags) ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs uppercase tracking-widest text-muted-foreground">Correct flags ({flags.length})</label>
                <Button size="sm" variant="outline" onClick={() => setFlags([...flags, ""])}>
                  <Plus className="mr-1 h-3 w-3" /> Add flag
                </Button>
              </div>
              {flags.map((f, i) => (
                <div key={i} className="flex gap-2">
                  <Input
                    value={f}
                    placeholder={`FLAG{...}`}
                    onChange={(e) => {
                      const copy = [...flags];
                      copy[i] = e.target.value;
                      setFlags(copy);
                    }}
                    className="font-mono"
                  />
                  <Button variant="outline" size="icon" onClick={() => setFlags(flags.filter((_, j) => j !== i))}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <p className="text-[11px] text-muted-foreground">
                Flags are hashed with SHA-256 before storage. The raw text is never sent to browsers.
              </p>
            </div>
          ) : null}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={() => mut.mutate()} disabled={mut.isPending || !title || (!existing && flags.filter(Boolean).length < 1)}>
              <Save className="mr-1 h-4 w-4" /> {existing ? "Save" : "Create"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PlayersTab() {
  const list = useServerFn(getAdminPlayers);
  const reset = useServerFn(resetPlayer);
  const del = useServerFn(deletePlayer);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["admin", "players"], queryFn: () => list() });
  const [search, setSearch] = useState("");

  const filtered = useMemo(
    () =>
      (q.data ?? []).filter((p) =>
        p.name_display.toLowerCase().includes(search.toLowerCase()),
      ),
    [q.data, search],
  );

  return (
    <div className="space-y-3">
      <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search players…" className="max-w-sm" />
      <div className="glass rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="text-xs uppercase text-muted-foreground">
            <tr>
              <th className="text-left px-4 py-3">Name</th>
              <th className="text-right px-4 py-3">Points</th>
              <th className="text-right px-4 py-3">Flags</th>
              <th className="text-right px-4 py-3">Completed</th>
              <th className="text-right px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <tr key={p.id} className="border-t border-glass-border">
                <td className="px-4 py-3 font-mono">{p.name_display}</td>
                <td className="px-4 py-3 text-right font-mono">{p.points}</td>
                <td className="px-4 py-3 text-right font-mono">{p.flags_solved}</td>
                <td className="px-4 py-3 text-right font-mono">{p.challenges_completed}</td>
                <td className="px-4 py-3 text-right space-x-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      if (!confirm(`Reset progress for ${p.name_display}?`)) return;
                      await reset({ data: { id: p.id } });
                      qc.invalidateQueries();
                      toast.success("Player reset");
                    }}
                  >
                    Reset
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={async () => {
                      if (!confirm(`Delete ${p.name_display}?`)) return;
                      await del({ data: { id: p.id } });
                      qc.invalidateQueries();
                      toast.success("Player deleted");
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">No players.</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SubmissionsTab() {
  const list = useServerFn(getAdminSubmissions);
  const q = useQuery({ queryKey: ["admin", "submissions"], queryFn: () => list() });
  return (
    <div className="glass rounded-2xl overflow-hidden">
      <table className="w-full text-sm">
        <thead className="text-xs uppercase text-muted-foreground">
          <tr>
            <th className="text-left px-4 py-3">Time</th>
            <th className="text-left px-4 py-3">Player</th>
            <th className="text-left px-4 py-3">Challenge</th>
            <th className="text-right px-4 py-3">Result</th>
          </tr>
        </thead>
        <tbody>
          {(q.data ?? []).map((s) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const anyS = s as any;
            return (
              <tr key={s.id} className="border-t border-glass-border">
                <td className="px-4 py-3 font-mono text-xs">{new Date(s.submitted_at).toLocaleString()}</td>
                <td className="px-4 py-3 font-mono">{anyS.players?.name_display ?? "—"}</td>
                <td className="px-4 py-3">{anyS.challenges?.title ?? "—"}</td>
                <td className={`px-4 py-3 text-right font-mono ${s.correct ? "text-cyber-lime" : "text-destructive"}`}>
                  {s.correct ? "CORRECT" : "wrong"}
                </td>
              </tr>
            );
          })}
          {q.data && q.data.length === 0 ? (
            <tr><td colSpan={4} className="px-4 py-10 text-center text-muted-foreground">No submissions yet.</td></tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
