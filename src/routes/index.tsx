import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { motion } from "framer-motion";
import confetti from "canvas-confetti";
import {
  Flag,
  CheckCircle2,
  Lock,
  Radio,
  Trophy,
  Users,
  Zap,
  Activity,
  Medal,
  ArrowRight,
  Shield,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { joinAsPlayer, submitFlag, getActiveChallenge, getMyProgress } from "@/lib/player.functions";
import { usePlayer } from "@/hooks/usePlayer";
import { useRealtimeInvalidate } from "@/hooks/useRealtimeInvalidate";
import { Nav } from "@/components/ctf/Nav";
import { StatCard } from "@/components/ctf/StatCard";
import { Countdown } from "@/components/ctf/Countdown";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";

export const Route = createFileRoute("/")({
  component: Home,
});

type LeaderRow = {
  id: string;
  name_display: string;
  points: number;
  flags_solved: number;
  challenges_completed: number;
  first_completed_at: string | null;
};

function Home() {
  const { player, hydrated, savePlayer } = usePlayer();
  const [name, setName] = useState("");
  const qc = useQueryClient();
  const join = useServerFn(joinAsPlayer);
  const submit = useServerFn(submitFlag);
  const fetchChallenge = useServerFn(getActiveChallenge);
  const fetchProgress = useServerFn(getMyProgress);

  const stateQ = useQuery({
    queryKey: ["comp", "state"],
    queryFn: async () => {
      const { data } = await supabase.from("competition_state").select("*").eq("id", 1).single();
      return data;
    },
  });

  const challengeQ = useQuery({
    queryKey: ["active-challenge"],
    queryFn: () => fetchChallenge(),
  });

  const leaderboardQ = useQuery({
    queryKey: ["leaderboard"],
    queryFn: async () => {
      const { data } = await supabase
        .from("players")
        .select("id, name_display, points, flags_solved, challenges_completed, first_completed_at")
        .order("points", { ascending: false })
        .order("flags_solved", { ascending: false })
        .order("first_completed_at", { ascending: true, nullsFirst: false });
      return (data ?? []) as LeaderRow[];
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

  const challenge = challengeQ.data?.challenge ?? null;

  const progressQ = useQuery({
    queryKey: ["my-progress", player?.id, challenge?.id],
    enabled: !!player && !!challenge,
    queryFn: () =>
      fetchProgress({ data: { playerId: player!.id, challengeId: challenge!.id } }),
  });

  useRealtimeInvalidate(
    ["players", "player_challenge_progress", "activity_log", "competition_state", "challenges", "challenge_flags"],
    [
      ["leaderboard"],
      ["activity"],
      ["comp", "state"],
      ["active-challenge"],
      ["my-progress", player?.id ?? "", challenge?.id ?? ""],
    ],
  );

  useEffect(() => {
    if (player) {
      supabase
        .from("players")
        .update({ last_seen_at: new Date().toISOString() })
        .eq("id", player.id)
        .then(() => {});
    }
  }, [player]);

  const joinMut = useMutation({
    mutationFn: (n: string) => join({ data: { name: n } }),
    onSuccess: ({ player: p }) => {
      savePlayer({ id: p.id, name: p.name_display });
      qc.invalidateQueries();
      toast.success(`Welcome, ${p.name_display}`);
    },
    onError: (e: Error) => toast.error(e.message || "Failed to join"),
  });

  const submitMut = useMutation({
    mutationFn: (flag: string) =>
      submit({ data: { playerId: player!.id, challengeId: challenge!.id, flag } }),
    onSuccess: (res) => {
      qc.invalidateQueries();
      if (res.status === "correct") {
        toast.success(res.message);
        if (res.completed) {
          confetti({
            particleCount: 180,
            spread: 90,
            origin: { y: 0.6 },
            colors: ["#7c3aed", "#22d3ee", "#a78bfa", "#84cc16"],
          });
        }
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

  const leaderboard = leaderboardQ.data ?? [];
  const podium = leaderboard.slice(0, 3);
  const totalPlayers = leaderboard.length;
  const totalFlagsSolved = leaderboard.reduce((s, r) => s + r.flags_solved, 0);
  const livePlayers = useMemo(() => {
    // Approximation: players updated in last 5 min. We don't have last_seen_at
    // in this query, keep parity with previous behavior by re-using count only.
    return totalPlayers;
  }, [totalPlayers]);

  // Tick every second while an end time is set so the UI locks/unlocks in real
  // time when the countdown expires or is extended.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!stateQ.data?.ends_at) return;
    const i = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(i);
  }, [stateQ.data?.ends_at]);
  const expired = stateQ.data?.ends_at
    ? new Date(stateQ.data.ends_at).getTime() <= now
    : false;
  const rawStatus = (stateQ.data?.status ?? "upcoming") as string;
  const isLive = rawStatus === "live" && !expired;

  const solvedOrders = new Set(progressQ.data?.solvedOrders ?? []);
  const completed = !!progressQ.data?.completedAt;
  const nextOrder = (progressQ.data?.solvedOrders?.length ?? 0) + 1;

  return (
    <div className="min-h-screen grid-bg">
      <Nav />
      <main className="mx-auto max-w-7xl px-4 py-8 space-y-10">
        {/* Hero + status */}
        <section className="grid gap-8 lg:grid-cols-[1.35fr_1fr] items-start">
          <div>
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="inline-flex items-center gap-2 glass rounded-full px-3 py-1 mb-6"
            >
              <Radio className="h-3.5 w-3.5 text-cyber-lime animate-pulse" />
              <span className="text-xs font-mono tracking-widest text-muted-foreground">
                {(stateQ.data?.status ?? "live").toString().toUpperCase()} · {totalPlayers} players
              </span>
            </motion.div>
            <h1 className="text-4xl md:text-5xl font-bold leading-tight tracking-tight">
              {challenge ? challenge.title : "Capture the Flags"}
              <br />
              <span className="text-gradient">
                {challenge ? challenge.category : "Own the leaderboard."}
              </span>
            </h1>
            {challenge ? (
              challenge.description ? (
                <p className="mt-4 max-w-2xl text-muted-foreground whitespace-pre-line">
                  {challenge.description}
                </p>
              ) : null
            ) : (
              <p className="mt-4 max-w-2xl text-muted-foreground">
                Waiting for the admin to launch the active challenge. Sit tight — this page will
                update automatically.
              </p>
            )}
            {challenge ? (
              <div className="mt-6">
                <Countdown
                  endsAt={stateQ.data?.ends_at ?? null}
                  status={stateQ.data?.status ?? "upcoming"}
                />
              </div>
            ) : null}
          </div>

          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            className="grid grid-cols-2 gap-4"
          >
            <StatCard label="Players" value={totalPlayers} icon={Users} accent="cyan" />
            <StatCard label="Flags Solved" value={totalFlagsSolved} icon={Flag} accent="violet" />
            <StatCard
              label="Points (you)"
              value={progressQ.data?.points ?? 0}
              icon={Zap}
              accent="lime"
            />
            <StatCard label="Live now" value={livePlayers} icon={Radio} accent="magenta" />
          </motion.div>
        </section>

        {/* Player identity + Flag submission */}
        <section className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
          <div className="glass rounded-2xl p-6">
            <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
              <Shield className="h-4 w-4 text-cyber-cyan" /> Player
            </h2>
            {hydrated && player ? (
              <div className="mt-4">
                <div className="text-xs text-muted-foreground">Signed in as</div>
                <div className="font-mono text-2xl font-bold text-gradient">{player.name}</div>
                <div className="mt-4 grid grid-cols-3 gap-3">
                  <MiniStat label="Points" value={progressQ.data?.points ?? 0} />
                  <MiniStat
                    label="Flags"
                    value={progressQ.data?.solvedOrders?.length ?? 0}
                  />
                  <MiniStat label={completed ? "Done" : "Playing"} value={completed ? 1 : 0} />
                </div>
              </div>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (name.trim().length < 2) return toast.error("Enter your display name");
                  joinMut.mutate(name.trim());
                }}
                className="mt-4 space-y-3"
              >
                <label className="text-xs uppercase tracking-widest text-muted-foreground">
                  Display name
                </label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. BlueFox"
                  className="font-mono h-12"
                  maxLength={32}
                  autoComplete="off"
                />
                <Button
                  type="submit"
                  disabled={joinMut.isPending}
                  className="w-full h-12 bg-primary text-primary-foreground glow-primary"
                >
                  {joinMut.isPending ? "Joining…" : "Join the arena"}
                  <ArrowRight className="ml-1.5 h-4 w-4" />
                </Button>
                <p className="text-[11px] text-muted-foreground font-mono">
                  Same name later = resume progress. Case-insensitive unique.
                </p>
              </form>
            )}
          </div>

          <div className="glass rounded-2xl p-6">
            <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
              <Flag className="h-4 w-4 text-cyber-cyan" /> Flag submission
            </h2>
            {!challenge ? (
              <div className="mt-6 text-sm text-muted-foreground">
                No active challenge yet.
              </div>
            ) : !player ? (
              <div className="mt-6 text-sm text-muted-foreground">
                Enter your player name first to submit flags.
              </div>
            ) : completed ? (
              <div className="mt-6 glass rounded-lg p-6 text-center">
                <CheckCircle2 className="mx-auto h-10 w-10 text-cyber-lime" />
                <p className="mt-2 font-bold">Challenge complete</p>
                <p className="text-sm text-muted-foreground">
                  All flags captured. Enjoy the top of the board.
                </p>
              </div>
            ) : (
              <div className="mt-4 space-y-4">
                {!isLive ? (
                  <div className="glass rounded-lg p-3 text-xs font-mono text-yellow-400 border border-yellow-400/30">
                    Submissions are {rawStatus === "paused"
                      ? "paused"
                      : rawStatus === "finished" || expired
                        ? "closed — competition finished"
                        : "not open yet — waiting for admin to start"}.
                  </div>
                ) : null}
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Progress</span>
                  <span className="font-mono">
                    {progressQ.data?.solvedOrders?.length ?? 0} / {challenge.required_flags}
                  </span>
                </div>
                <Progress
                  value={
                    ((progressQ.data?.solvedOrders?.length ?? 0) / challenge.required_flags) * 100
                  }
                  className="h-1.5"
                />
                <div className="space-y-3">
                  {challenge.fields.map((field) => (
                    <FieldRow
                      key={field.order}
                      order={field.order}
                      label={field.label}
                      solved={solvedOrders.has(field.order)}
                      unlocked={field.order === nextOrder && isLive}
                      onSubmit={(v) => submitMut.mutate(v)}
                      submitting={submitMut.isPending}
                    />
                  ))}
                </div>
                <p className="text-[11px] text-muted-foreground font-mono">
                  Flags must be submitted in order. Validation runs server-side; raw flags and
                  hashes are never exposed.
                </p>
              </div>
            )}
          </div>
        </section>

        {/* Top 3 podium */}
        <section>
          <div className="flex items-end justify-between mb-4">
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <Trophy className="h-6 w-6 text-cyber-cyan" /> Top 3
            </h2>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {[0, 1, 2].map((i) => {
              const p = podium[i];
              const medals = ["🥇", "🥈", "🥉"];
              const accents = [
                "from-yellow-400/40 to-yellow-500/10",
                "from-slate-300/40 to-slate-400/10",
                "from-amber-700/40 to-amber-800/10",
              ];
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0, transition: { delay: i * 0.08 } }}
                  className={`glass rounded-2xl p-6 relative overflow-hidden bg-gradient-to-br ${accents[i]}`}
                >
                  <div className="text-4xl mb-2">{medals[i]}</div>
                  <div className="font-mono text-lg font-bold truncate">
                    {p ? p.name_display : "—"}
                  </div>
                  <div className="mt-3 flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Points</span>
                    <span className="font-mono text-cyber-cyan font-bold">{p?.points ?? 0}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Flags</span>
                    <span className="font-mono">{p?.flags_solved ?? 0}</span>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </section>

        {/* Leaderboard + Activity */}
        <section className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
          <div className="glass rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-glass-border flex items-center justify-between">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <Trophy className="h-5 w-5 text-cyber-cyan" /> Live leaderboard
              </h2>
              <span className="text-xs text-muted-foreground font-mono">
                {leaderboard.length} players
              </span>
            </div>
            <div className="max-h-[520px] overflow-auto">
              <table className="w-full text-sm">
                <thead className="bg-background/40 text-xs uppercase tracking-widest text-muted-foreground sticky top-0">
                  <tr>
                    <th className="text-left px-4 py-3">#</th>
                    <th className="text-left px-4 py-3">Player</th>
                    <th className="text-right px-4 py-3">Flags</th>
                    <th className="text-right px-4 py-3">Points</th>
                  </tr>
                </thead>
                <tbody>
                  {leaderboard.map((r, idx) => {
                    const rank = idx + 1;
                    const isMe = player?.id === r.id;
                    return (
                      <tr
                        key={r.id}
                        className={`border-t border-glass-border ${isMe ? "bg-primary/10" : ""}`}
                      >
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
                        <td className="px-4 py-3 font-mono">
                          {r.name_display}
                          {isMe ? (
                            <span className="ml-2 text-[10px] text-cyber-cyan">YOU</span>
                          ) : null}
                        </td>
                        <td className="px-4 py-3 text-right font-mono">{r.flags_solved}</td>
                        <td className="px-4 py-3 text-right font-mono text-cyber-cyan">
                          {r.points}
                        </td>
                      </tr>
                    );
                  })}
                  {leaderboard.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-10 text-center text-muted-foreground">
                        No players yet.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>

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
        </section>
      </main>
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

function FieldRow({
  order,
  label,
  solved,
  unlocked,
  onSubmit,
  submitting,
}: {
  order: number;
  label: string;
  solved: boolean;
  unlocked: boolean;
  onSubmit: (v: string) => void;
  submitting: boolean;
}) {
  const [v, setV] = useState("");
  const disabled = solved || !unlocked;

  return (
    <div>
      <label className="text-xs font-mono uppercase tracking-widest text-muted-foreground flex items-center gap-1">
        {solved ? (
          <CheckCircle2 className="h-3 w-3 text-cyber-lime" />
        ) : unlocked ? (
          <Flag className="h-3 w-3 text-cyber-cyan" />
        ) : (
          <Lock className="h-3 w-3" />
        )}
        <span>
          {order}. {label}
        </span>
        {solved ? (
          <span className="ml-auto text-cyber-lime">CAPTURED</span>
        ) : !unlocked ? (
          <span className="ml-auto">LOCKED</span>
        ) : null}
      </label>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!v.trim() || disabled) return;
          onSubmit(v.trim());
          setV("");
        }}
        className="mt-1 flex gap-2"
      >
        <Input
          value={solved ? "•••• captured ••••" : v}
          onChange={(e) => setV(e.target.value)}
          placeholder={disabled ? "" : "FLAG{...}"}
          disabled={disabled}
          className="font-mono h-11"
          maxLength={256}
          autoComplete="off"
          spellCheck={false}
        />
        <Button
          type="submit"
          disabled={disabled || submitting || !v.trim()}
          className="h-11"
        >
          Submit
        </Button>
      </form>
    </div>
  );
}
