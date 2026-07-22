import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Plus,
  Trash2,
  Save,
  LogOut,
  Download,
  RotateCcw,
  Play,
  Pause,
  Square,
  X,
  Users,
  ListChecks,
  Trophy,
  Medal,
} from "lucide-react";
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
import { finalizeIfExpired } from "@/lib/player.functions";
import { Nav } from "@/components/ctf/Nav";
import { Countdown } from "@/components/ctf/Countdown";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/_authenticated/sasa")({
  head: () => ({ meta: [{ name: "robots", content: "noindex,nofollow" }] }),
  component: AdminPage,
});

type FlagField = { flag_order: number; label: string };
type ChallengeRow = {
  id: string;
  title: string;
  description: string;
  category: string;
  required_flags: number;
  points_per_flag: number;
  active: boolean;
  created_at: string;
  fields: FlagField[];
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
            <Button onClick={signOut} className="mt-6">
              Sign out
            </Button>
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
            <TabsTrigger value="challenges">
              <ListChecks className="mr-2 h-4 w-4" /> Challenge
            </TabsTrigger>
            <TabsTrigger value="leaderboard">
              <Trophy className="mr-2 h-4 w-4" /> Leaderboard
            </TabsTrigger>
            <TabsTrigger value="players">
              <Users className="mr-2 h-4 w-4" /> Players
            </TabsTrigger>
            <TabsTrigger value="submissions">Submissions</TabsTrigger>
          </TabsList>
          <TabsContent value="challenges" className="mt-4">
            <ChallengesTab />
          </TabsContent>
          <TabsContent value="leaderboard" className="mt-4">
            <LeaderboardTab />
          </TabsContent>
          <TabsContent value="players" className="mt-4">
            <PlayersTab />
          </TabsContent>
          <TabsContent value="submissions" className="mt-4">
            <SubmissionsTab />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

function CompetitionControls() {
  const qc = useQueryClient();
  const stateQ = useQuery({
    queryKey: ["comp", "state"],
    queryFn: async () => {
      const { data } = await supabase.from("competition_state").select("*").eq("id", 1).single();
      return data;
    },
  });
  useEffect(() => {
    const ch = supabase
      .channel("admin-comp-state")
      .on(
        "postgres_changes" as never,
        { event: "*", schema: "public", table: "competition_state" },
        () => qc.invalidateQueries({ queryKey: ["comp", "state"] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [qc]);
  const setState = useServerFn(setCompetitionState);
  const reset = useServerFn(resetCompetition);
  const exportCsv = useServerFn(exportLeaderboardCsv);
  const finalize = useServerFn(finalizeIfExpired);

  const [duration, setDuration] = useState<number>(60);
  const [nowTs, setNowTs] = useState(() => Date.now());
  useEffect(() => {
    if (!stateQ.data?.ends_at) return;
    const i = setInterval(() => setNowTs(Date.now()), 1000);
    return () => clearInterval(i);
  }, [stateQ.data?.ends_at]);
  const expired = stateQ.data?.ends_at
    ? new Date(stateQ.data.ends_at).getTime() <= nowTs
    : false;
  useEffect(() => {
    if (stateQ.data?.status === "live" && expired) {
      finalize().then(() => qc.invalidateQueries({ queryKey: ["comp", "state"] })).catch(() => {});
    }
  }, [stateQ.data?.status, expired, finalize, qc]);

  async function changeStatus(status: "upcoming" | "live" | "paused" | "finished") {
    try {
      await setState({ data: { status } });
      qc.invalidateQueries();
      toast.success(`Status set to ${status}`);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function startChallenge() {
    if (!duration || duration <= 0) return toast.error("Enter a valid duration in minutes");
    const ends = new Date(Date.now() + duration * 60_000).toISOString();
    try {
      await setState({ data: { status: "live", ends_at: ends } });
      qc.invalidateQueries();
      toast.success(`Challenge started · ${duration} min`);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function extendTime() {
    if (!duration || duration <= 0) return toast.error("Enter minutes to add");
    const current = stateQ.data?.ends_at ? new Date(stateQ.data.ends_at).getTime() : Date.now();
    const base = Math.max(current, Date.now());
    const ends = new Date(base + duration * 60_000).toISOString();
    try {
      await setState({ data: { status: "live", ends_at: ends } });
      qc.invalidateQueries();
      toast.success(`Extended by ${duration} min`);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function doReset() {
    if (!confirm("Reset ALL player progress, submissions, activity AND competition state?")) return;
    await reset();
    qc.invalidateQueries();
    toast.success("Competition reset to default state");
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
  const statusLabel: Record<typeof status, string> = {
    upcoming: "Draft",
    live: "Live",
    paused: "Paused",
    finished: "Finished",
  };
  const statusColor: Record<typeof status, string> = {
    upcoming: "text-cyber-cyan border-cyber-cyan/40",
    live: "text-cyber-lime border-cyber-lime/40",
    paused: "text-yellow-400 border-yellow-400/40",
    finished: "text-destructive border-destructive/40",
  };

  return (
    <div className="glass rounded-2xl p-5 space-y-4">
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <div className="text-xs uppercase tracking-widest text-muted-foreground mb-1">Status</div>
          <div
            className={`h-10 inline-flex items-center rounded-md border px-3 font-mono text-sm bg-background/40 ${statusColor[status]}`}
          >
            <span className="h-2 w-2 rounded-full bg-current mr-2 animate-pulse" />
            {statusLabel[status]}
          </div>
        </div>

        <div>
          <div className="text-xs uppercase tracking-widest text-muted-foreground mb-1">
            Duration (minutes)
          </div>
          <Input
            type="number"
            min={1}
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
            className="h-10 w-32 font-mono"
          />
        </div>

        <div className="flex flex-wrap gap-2 ml-auto">
          <Button
            size="sm"
            onClick={startChallenge}
            className="bg-cyber-lime/20 text-cyber-lime hover:bg-cyber-lime/30"
          >
            <Play className="mr-1 h-4 w-4" />
            Start
          </Button>
          {status === "paused" ? (
            <Button
              size="sm"
              onClick={() => changeStatus("live")}
              className="bg-cyber-lime/20 text-cyber-lime hover:bg-cyber-lime/30"
            >
              <Play className="mr-1 h-4 w-4" />
              Resume
            </Button>
          ) : null}
          <Button size="sm" variant="outline" onClick={extendTime}>
            + Extend
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => changeStatus("paused")}
            disabled={status !== "live"}
          >
            <Pause className="mr-1 h-4 w-4" />
            Pause
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => changeStatus("finished")}
            disabled={status === "finished" || status === "upcoming"}
          >
            <Square className="mr-1 h-4 w-4" />
            Finish
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => changeStatus("upcoming")}
            disabled={status === "upcoming"}
          >
            Draft
          </Button>
          <Button size="sm" variant="outline" onClick={doExport}>
            <Download className="mr-1 h-4 w-4" />
            CSV
          </Button>
          <Button size="sm" variant="destructive" onClick={doReset}>
            <RotateCcw className="mr-1 h-4 w-4" />
            Reset all
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4 text-xs font-mono text-muted-foreground">
        <Countdown
          endsAt={s?.ends_at ?? null}
          status={status}
          pausedRemainingMs={(s as { paused_remaining_ms?: number | null } | undefined)?.paused_remaining_ms ?? null}
        />
        <div>
          Ends at:{" "}
          <span className="text-foreground">
            {s?.ends_at ? new Date(s.ends_at).toLocaleString() : "—"}
          </span>
        </div>
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
        <Button onClick={() => setCreating(true)}>
          <Plus className="mr-1 h-4 w-4" /> New challenge
        </Button>
      </div>
      <p className="text-xs text-muted-foreground mb-3">
        Only one challenge can be active at a time. Making a new challenge active auto-deactivates the previous one.
      </p>
      <div className="grid gap-3">
        {(q.data ?? []).map((c) => (
          <div
            key={c.id}
            className="glass rounded-xl p-4 flex items-center justify-between gap-3"
          >
            <div>
              <div className="text-xs font-mono text-cyber-cyan uppercase">{c.category}</div>
              <div className="font-bold">
                {c.title}
                {c.active ? (
                  <span className="ml-2 text-[10px] font-mono text-cyber-lime">ACTIVE</span>
                ) : null}
              </div>
              <div className="text-xs text-muted-foreground">
                {c.required_flags} flags · {c.points_per_flag} pts each
              </div>
              {c.fields && c.fields.length > 0 ? (
                <div className="mt-1 text-[11px] font-mono text-muted-foreground">
                  {c.fields.map((f) => f.label).join(" → ")}
                </div>
              ) : null}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setEditing(c as ChallengeRow)}>
                Edit
              </Button>
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
      {editing ? (
        <ChallengeForm existing={editing} onClose={() => setEditing(null)} />
      ) : null}
    </div>
  );
}

type FieldDraft = { value: string; label: string };

function ChallengeForm({
  existing,
  onClose,
}: {
  existing?: ChallengeRow;
  onClose: () => void;
}) {
  const create = useServerFn(createChallenge);
  const update = useServerFn(updateChallenge);
  const qc = useQueryClient();
  const [title, setTitle] = useState(existing?.title ?? "");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [category, setCategory] = useState(existing?.category ?? "Misc");
  const [pointsPerFlag, setPointsPerFlag] = useState(existing?.points_per_flag ?? 100);
  const [active, setActive] = useState(existing?.active ?? true);
  const [replaceFlags, setReplaceFlags] = useState(!existing);
  const [fields, setFields] = useState<FieldDraft[]>(
    existing
      ? existing.fields.map((f) => ({ value: "", label: f.label }))
      : [
          { value: "", label: "Flag 1" },
          { value: "", label: "Flag 2" },
        ],
  );

  const mut = useMutation({
    mutationFn: async () => {
      const payload = {
        title,
        description,
        category,
        points_per_flag: pointsPerFlag,
        active,
        fields: fields.map((f) => ({ value: f.value.trim(), label: f.label.trim() })),
      };
      if (existing) {
        // If labels changed but user did NOT check replaceFlags, send labelsOnly
        // so we rename without touching hashes/progress.
        const labelsOnly =
          !replaceFlags &&
          existing.fields.length === fields.length &&
          fields.some((f, i) => existing.fields[i]?.label !== f.label);
        return update({
          data: {
            ...payload,
            id: existing.id,
            replaceFlags,
            labelsOnly,
            // On labelsOnly we still need fields with labels; values may be empty
            fields: labelsOnly
              ? fields.map((f) => ({ value: f.value.trim() || "x", label: f.label.trim() }))
              : payload.fields,
          },
        });
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

  const canSave =
    title.trim().length >= 2 &&
    (existing
      ? true
      : fields.length > 0 && fields.every((f) => f.value.trim() && f.label.trim()));

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
              <label className="text-xs uppercase tracking-widest text-muted-foreground">
                Points / flag
              </label>
              <Input
                type="number"
                value={pointsPerFlag}
                onChange={(e) => setPointsPerFlag(Number(e.target.value))}
                className="mt-1 font-mono"
              />
            </div>
          </div>
          <div>
            <label className="text-xs uppercase tracking-widest text-muted-foreground">Description</label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1"
              rows={3}
            />
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={active} onCheckedChange={setActive} id="active" />
            <label htmlFor="active" className="text-sm">
              Active (visible to players; deactivates any other active challenge)
            </label>
          </div>

          {existing ? (
            <div className="flex items-center gap-2">
              <Switch checked={replaceFlags} onCheckedChange={setReplaceFlags} id="replace" />
              <label htmlFor="replace" className="text-sm">
                Replace flag values (resets progress on this challenge)
              </label>
            </div>
          ) : null}

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs uppercase tracking-widest text-muted-foreground">
                Flag fields ({fields.length})
              </label>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  setFields([...fields, { value: "", label: `Flag ${fields.length + 1}` }])
                }
              >
                <Plus className="mr-1 h-3 w-3" /> Add field
              </Button>
            </div>
            {fields.map((f, i) => (
              <div key={i} className="grid grid-cols-[130px_1fr_auto] gap-2 items-center">
                <Input
                  value={f.label}
                  placeholder="Label"
                  onChange={(e) => {
                    const copy = [...fields];
                    copy[i] = { ...copy[i], label: e.target.value };
                    setFields(copy);
                  }}
                  maxLength={60}
                />
                <Input
                  value={f.value}
                  placeholder={
                    existing && !replaceFlags ? "•••••••• (unchanged)" : "FLAG{...}"
                  }
                  disabled={!!existing && !replaceFlags}
                  onChange={(e) => {
                    const copy = [...fields];
                    copy[i] = { ...copy[i], value: e.target.value };
                    setFields(copy);
                  }}
                  className="font-mono"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setFields(fields.filter((_, j) => j !== i))}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <p className="text-[11px] text-muted-foreground">
              Flag values are hashed with SHA-256 before storage and never sent to browsers. Players must submit
              flags in the order listed here.
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={() => mut.mutate()} disabled={mut.isPending || !canSave}>
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

  return (
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
          {(q.data ?? []).map((p) => (
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
          {(!q.data || q.data.length === 0) ? (
            <tr>
              <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                No players.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
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
          {(q.data ?? []).map((r: any) => (
            <tr key={r.id} className="border-t border-glass-border">
              <td className="px-4 py-3 font-mono text-xs">
                {new Date(r.submitted_at).toLocaleString()}
              </td>
              <td className="px-4 py-3 font-mono">{r.players?.name_display ?? "—"}</td>
              <td className="px-4 py-3">{r.challenges?.title ?? "—"}</td>
              <td className="px-4 py-3 text-right">
                {r.correct ? (
                  <span className="text-cyber-lime font-mono text-xs">ACCEPTED</span>
                ) : (
                  <span className="text-destructive font-mono text-xs">REJECTED</span>
                )}
              </td>
            </tr>
          ))}
          {(!q.data || q.data.length === 0) ? (
            <tr>
              <td colSpan={4} className="px-4 py-10 text-center text-muted-foreground">
                No submissions.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

function LeaderboardTab() {
  const q = useQuery({
    queryKey: ["admin", "leaderboard"],
    queryFn: async () => {
      const { data } = await supabase
        .from("players")
        .select("id, name_display, points, flags_solved, challenges_completed, first_completed_at")
        .order("points", { ascending: false })
        .order("flags_solved", { ascending: false })
        .order("first_completed_at", { ascending: true, nullsFirst: false });
      return data ?? [];
    },
    refetchInterval: 5000,
  });

  // Realtime — invalidate when player rows change.
  useEffect(() => {
    const ch = supabase
      .channel("admin-leaderboard")
      .on(
        "postgres_changes" as never,
        { event: "*", schema: "public", table: "players" },
        () => q.refetch(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rows = q.data ?? [];
  return (
    <div className="glass rounded-2xl overflow-hidden">
      <div className="px-5 py-4 border-b border-glass-border flex items-center justify-between">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <Trophy className="h-5 w-5 text-cyber-cyan" /> Live leaderboard
        </h2>
        <span className="text-xs text-muted-foreground font-mono">{rows.length} players</span>
      </div>
      <table className="w-full text-sm">
        <thead className="text-xs uppercase text-muted-foreground">
          <tr>
            <th className="text-left px-4 py-3">#</th>
            <th className="text-left px-4 py-3">Player</th>
            <th className="text-right px-4 py-3">Flags</th>
            <th className="text-right px-4 py-3">Completed</th>
            <th className="text-right px-4 py-3">Points</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const rank = i + 1;
            return (
              <tr key={r.id} className="border-t border-glass-border">
                <td className="px-4 py-3 font-mono">
                  {rank <= 3 ? (
                    <span className="inline-flex items-center gap-1">
                      <Medal
                        className={`h-4 w-4 ${
                          rank === 1
                            ? "text-yellow-400"
                            : rank === 2
                              ? "text-slate-300"
                              : "text-amber-600"
                        }`}
                      />
                      {rank}
                    </span>
                  ) : (
                    rank
                  )}
                </td>
                <td className="px-4 py-3 font-mono">{r.name_display}</td>
                <td className="px-4 py-3 text-right font-mono">{r.flags_solved}</td>
                <td className="px-4 py-3 text-right font-mono">{r.challenges_completed}</td>
                <td className="px-4 py-3 text-right font-mono text-cyber-cyan">{r.points}</td>
              </tr>
            );
          })}
          {rows.length === 0 ? (
            <tr>
              <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                No players yet.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
