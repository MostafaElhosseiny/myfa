import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { motion } from "framer-motion";
import confetti from "canvas-confetti";
import { Flag, CheckCircle2, Lock, Search, ChevronRight, Sparkles, Activity } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { submitFlag } from "@/lib/player.functions";
import { usePlayer } from "@/hooks/usePlayer";
import { useRealtimeInvalidate } from "@/hooks/useRealtimeInvalidate";
import { Nav } from "@/components/ctf/Nav";
import { Countdown } from "@/components/ctf/Countdown";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/play")({
  head: () => ({
    meta: [
      { title: "Play — CTF/CORE" },
      { name: "description", content: "Solve challenges and submit flags in the live CTF competition." },
    ],
  }),
  component: Play,
});

type Challenge = {
  id: string;
  title: string;
  description: string;
  category: string;
  required_flags: number;
  points_per_flag: number;
  active: boolean;
};

function Play() {
  const { player, hydrated } = usePlayer();
  const navigate = useNavigate();

  useEffect(() => {
    if (hydrated && !player) navigate({ to: "/" });
  }, [hydrated, player, navigate]);

  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Challenge | null>(null);

  const stateQ = useQuery({
    queryKey: ["comp", "state"],
    queryFn: async () => {
      const { data } = await supabase.from("competition_state").select("*").eq("id", 1).single();
      return data;
    },
  });

  const challengesQ = useQuery({
    queryKey: ["challenges"],
    queryFn: async () => {
      const { data } = await supabase
        .from("challenges")
        .select("*")
        .eq("active", true)
        .order("created_at", { ascending: true });
      return (data ?? []) as Challenge[];
    },
  });

  const progressQ = useQuery({
    queryKey: ["progress", player?.id],
    enabled: !!player,
    queryFn: async () => {
      const { data } = await supabase
        .from("player_challenge_progress")
        .select("*")
        .eq("player_id", player!.id);
      return data ?? [];
    },
  });

  const activityQ = useQuery({
    queryKey: ["activity"],
    queryFn: async () => {
      const { data } = await supabase
        .from("activity_log")
        .select("id, kind, message, created_at")
        .order("created_at", { ascending: false })
        .limit(20);
      return data ?? [];
    },
  });

  useRealtimeInvalidate(
    ["challenges", "player_challenge_progress", "activity_log", "competition_state", "players"],
    [["challenges"], ["progress", player?.id ?? ""], ["activity"], ["comp", "state"], ["me"]],
  );

  const meQ = useQuery({
    queryKey: ["me", player?.id],
    enabled: !!player,
    queryFn: async () => {
      const { data } = await supabase
        .from("players")
        .select("points, flags_solved, challenges_completed")
        .eq("id", player!.id)
        .single();
      return data;
    },
  });

  const progressByChallenge = useMemo(() => {
    const m = new Map<string, { flags_solved: number; completed_at: string | null }>();
    for (const r of progressQ.data ?? []) {
      m.set(r.challenge_id, { flags_solved: r.flags_solved, completed_at: r.completed_at });
    }
    return m;
  }, [progressQ.data]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return challengesQ.data ?? [];
    return (challengesQ.data ?? []).filter(
      (c) => c.title.toLowerCase().includes(q) || c.category.toLowerCase().includes(q),
    );
  }, [challengesQ.data, query]);

  if (!hydrated || !player) return null;

  return (
    <div className="min-h-screen">
      <Nav />
      <main className="mx-auto max-w-7xl px-4 py-8 grid gap-8 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold">
                Welcome, <span className="text-gradient font-mono">{player.name}</span>
              </h1>
              <p className="text-sm text-muted-foreground">
                Pick a challenge, submit flags, dominate.
              </p>
            </div>
            <Countdown endsAt={stateQ.data?.ends_at ?? null} status={stateQ.data?.status ?? "live"} />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <MiniStat label="Points" value={meQ.data?.points ?? 0} />
            <MiniStat label="Flags" value={meQ.data?.flags_solved ?? 0} />
            <MiniStat label="Completed" value={meQ.data?.challenges_completed ?? 0} />
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter challenges by title or category…"
              className="pl-9 h-11"
            />
          </div>

          {challengesQ.data && challengesQ.data.length === 0 ? (
            <div className="glass rounded-2xl p-10 text-center">
              <Sparkles className="mx-auto h-8 w-8 text-cyber-cyan mb-3" />
              <p className="text-lg font-semibold">No challenges yet</p>
              <p className="text-muted-foreground text-sm">
                Waiting for the admin to publish challenges. Sit tight.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {filtered.map((c) => {
                const p = progressByChallenge.get(c.id);
                const solved = p?.flags_solved ?? 0;
                const completed = !!p?.completed_at;
                const pct = Math.round((solved / c.required_flags) * 100);
                return (
                  <motion.button
                    key={c.id}
                    onClick={() => setSelected(c)}
                    whileHover={{ y: -2 }}
                    className="glass rounded-2xl p-5 text-left group relative overflow-hidden"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-xs font-mono uppercase tracking-widest text-cyber-cyan">
                          {c.category}
                        </div>
                        <h3 className="mt-1 text-lg font-bold">{c.title}</h3>
                      </div>
                      {completed ? (
                        <span className="inline-flex items-center gap-1 text-xs font-mono text-cyber-lime">
                          <CheckCircle2 className="h-4 w-4" /> DONE
                        </span>
                      ) : (
                        <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
                      )}
                    </div>
                    {c.description ? (
                      <p className="mt-2 text-sm text-muted-foreground line-clamp-2">{c.description}</p>
                    ) : null}
                    <div className="mt-4 flex items-center gap-3">
                      <div className="flex-1">
                        <Progress value={pct} className="h-1.5" />
                      </div>
                      <div className="font-mono text-xs text-muted-foreground">
                        {solved}/{c.required_flags}
                      </div>
                    </div>
                    <div className="mt-2 flex items-center justify-between text-xs">
                      <span className="text-muted-foreground font-mono">
                        {c.points_per_flag} pts / flag
                      </span>
                    </div>
                  </motion.button>
                );
              })}
            </div>
          )}
        </div>

        <aside className="space-y-4">
          <div className="glass rounded-2xl p-5">
            <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
              <Activity className="h-4 w-4" /> Recent activity
            </h3>
            <ul className="mt-4 space-y-3 max-h-[520px] overflow-auto pr-2">
              {(activityQ.data ?? []).map((a) => (
                <li key={a.id} className="text-sm">
                  <span className="text-foreground">{a.message}</span>
                  <div className="text-[10px] text-muted-foreground font-mono">
                    {new Date(a.created_at).toLocaleTimeString()}
                  </div>
                </li>
              ))}
              {activityQ.data && activityQ.data.length === 0 ? (
                <li className="text-sm text-muted-foreground">No activity yet.</li>
              ) : null}
            </ul>
          </div>
          <Link
            to="/leaderboard"
            className="block glass rounded-2xl p-5 hover:glow-cyan transition-shadow"
          >
            <div className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
              Full leaderboard
            </div>
            <p className="mt-1 text-cyber-cyan font-mono">Open dashboard →</p>
          </Link>
        </aside>
      </main>

      <SubmitDialog challenge={selected} onClose={() => setSelected(null)} progress={selected ? progressByChallenge.get(selected.id) : undefined} />
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="glass rounded-xl p-3">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="font-mono text-xl font-bold">{value}</div>
    </div>
  );
}

function SubmitDialog({
  challenge,
  onClose,
  progress,
}: {
  challenge: Challenge | null;
  onClose: () => void;
  progress?: { flags_solved: number; completed_at: string | null };
}) {
  const { player } = usePlayer();
  const [flag, setFlag] = useState("");
  const submit = useServerFn(submitFlag);
  const qc = useQueryClient();

  useEffect(() => setFlag(""), [challenge?.id]);

  const mut = useMutation({
    mutationFn: (f: string) =>
      submit({ data: { playerId: player!.id, challengeId: challenge!.id, flag: f } }),
    onSuccess: (res) => {
      qc.invalidateQueries();
      if (res.status === "correct") {
        toast.success(res.message);
        if (res.completed) {
          confetti({ particleCount: 160, spread: 90, origin: { y: 0.6 }, colors: ["#7c3aed", "#22d3ee", "#a78bfa"] });
          onClose();
        }
        setFlag("");
      } else if (res.status === "duplicate") {
        toast.info(res.message);
      } else if (res.status === "closed") {
        toast.warning(res.message);
      } else {
        toast.error(res.message);
      }
    },
    onError: (e: Error) => toast.error(e.message || "Submission failed"),
  });

  if (!challenge) return null;
  const solved = progress?.flags_solved ?? 0;
  const completed = !!progress?.completed_at;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="glass border-glass-border sm:max-w-lg">
        <DialogHeader>
          <div className="text-xs font-mono uppercase tracking-widest text-cyber-cyan">
            {challenge.category}
          </div>
          <DialogTitle className="text-2xl">{challenge.title}</DialogTitle>
          <DialogDescription>{challenge.description || "Submit each flag as you find it."}</DialogDescription>
        </DialogHeader>
        <div className="flex items-center justify-between text-sm mt-2">
          <span className="text-muted-foreground">Progress</span>
          <span className="font-mono">{solved} / {challenge.required_flags}</span>
        </div>
        <Progress value={(solved / challenge.required_flags) * 100} className="h-1.5" />

        {completed ? (
          <div className="mt-6 glass rounded-lg p-6 text-center">
            <CheckCircle2 className="mx-auto h-8 w-8 text-cyber-lime" />
            <p className="mt-2 font-bold">Challenge complete</p>
            <p className="text-sm text-muted-foreground">Move on to the next one.</p>
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!flag.trim()) return;
              mut.mutate(flag.trim());
            }}
            className="mt-4 space-y-3"
          >
            <label className="text-xs font-mono uppercase tracking-widest text-muted-foreground flex items-center gap-1">
              <Lock className="h-3 w-3" /> Flag
            </label>
            <Input
              autoFocus
              value={flag}
              onChange={(e) => setFlag(e.target.value)}
              placeholder="FLAG{...}"
              className="font-mono h-12"
              maxLength={256}
            />
            <Button
              type="submit"
              disabled={mut.isPending}
              className="w-full h-11 bg-primary text-primary-foreground glow-primary"
            >
              <Flag className="mr-2 h-4 w-4" />
              {mut.isPending ? "Submitting…" : "Submit flag"}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
