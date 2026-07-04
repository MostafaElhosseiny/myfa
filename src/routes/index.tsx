import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { motion } from "framer-motion";
import { Flag, Users, Trophy, Zap, ArrowRight, Radio } from "lucide-react";
import { toast } from "sonner";
import { joinAsPlayer } from "@/lib/player.functions";
import { getStats } from "@/lib/public.functions";
import { supabase } from "@/integrations/supabase/client";
import { usePlayer } from "@/hooks/usePlayer";
import { useRealtimeInvalidate } from "@/hooks/useRealtimeInvalidate";
import { Nav } from "@/components/ctf/Nav";
import { StatCard } from "@/components/ctf/StatCard";
import { Countdown } from "@/components/ctf/Countdown";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  return (
    <div className="min-h-screen grid-bg">
      <Nav />
      <main className="mx-auto max-w-7xl px-4 py-10 space-y-16">
        <Hero />
        <TopThree />
      </main>
      <Footer />
    </div>
  );
}

function Hero() {
  const [name, setName] = useState("");
  const { player, savePlayer } = usePlayer();
  const navigate = useNavigate();
  const join = useServerFn(joinAsPlayer);
  const qc = useQueryClient();

  const statsQ = useQuery({
    queryKey: ["public", "stats"],
    queryFn: () => getStats(),
    refetchInterval: 15_000,
  });

  useRealtimeInvalidate(
    ["players", "player_challenge_progress", "competition_state"],
    [["public", "stats"], ["top3"]],
  );

  const mut = useMutation({
    mutationFn: (n: string) => join({ data: { name: n } }),
    onSuccess: ({ player }) => {
      savePlayer({ id: player.id, name: player.name_display });
      qc.invalidateQueries();
      toast.success(`Welcome, ${player.name_display}`);
      navigate({ to: "/play" });
    },
    onError: (e: Error) => toast.error(e.message || "Failed to join"),
  });

  useEffect(() => {
    // keep last-seen fresh
    if (player) {
      supabase.from("players").update({ last_seen_at: new Date().toISOString() }).eq("id", player.id).then(() => {});
    }
  }, [player]);

  return (
    <section className="relative">
      <div className="absolute inset-0 -z-10 opacity-60" style={{ background: "var(--gradient-hero)" }} />
      <div className="grid gap-10 lg:grid-cols-[1.2fr_1fr] items-center">
        <div>
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 glass rounded-full px-3 py-1 mb-6"
          >
            <Radio className="h-3.5 w-3.5 text-cyber-lime animate-pulse" />
            <span className="text-xs font-mono tracking-widest text-muted-foreground">
              LIVE COMPETITION · {statsQ.data?.livePlayers ?? 0} active
            </span>
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0, transition: { delay: 0.05 } }}
            className="text-4xl md:text-6xl font-bold leading-tight tracking-tight"
          >
            Capture the flags.<br />
            <span className="text-gradient">Own the leaderboard.</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0, transition: { delay: 0.1 } }}
            className="mt-4 max-w-xl text-muted-foreground"
          >
            Enter your handle to join the on-site CTF. Submit flags as you discover them and
            watch the leaderboard update in real time.
          </motion.p>

          <motion.form
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0, transition: { delay: 0.15 } }}
            onSubmit={(e) => {
              e.preventDefault();
              if (player) return navigate({ to: "/play" });
              if (name.trim().length < 2) return toast.error("Enter your display name");
              mut.mutate(name.trim());
            }}
            className="mt-8 flex flex-col sm:flex-row gap-3 max-w-md"
          >
            <Input
              value={player ? player.name : name}
              onChange={(e) => setName(e.target.value)}
              placeholder={player ? player.name : "Your display name (e.g. BlueFox)"}
              disabled={!!player}
              className="font-mono h-12"
              maxLength={32}
            />
            <Button
              type="submit"
              size="lg"
              disabled={mut.isPending}
              className="h-12 bg-primary text-primary-foreground glow-primary hover:opacity-90"
            >
              {player ? "Enter arena" : mut.isPending ? "Joining…" : "Join"}
              <ArrowRight className="ml-1.5 h-4 w-4" />
            </Button>
          </motion.form>
          <p className="mt-3 text-xs text-muted-foreground font-mono">
            No signup. Same name later = resume progress.
          </p>

          <div className="mt-8">
            <Countdown endsAt={statsQ.data?.endsAt ?? null} status={statsQ.data?.status ?? "live"} />
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          className="grid grid-cols-2 gap-4"
        >
          <StatCard label="Players" value={statsQ.data?.totalPlayers ?? 0} icon={Users} accent="cyan" />
          <StatCard label="Flags Solved" value={statsQ.data?.flagsSolved ?? 0} icon={Flag} accent="violet" />
          <StatCard label="Challenges" value={statsQ.data?.totalChallenges ?? 0} icon={Zap} accent="lime" />
          <StatCard label="Live now" value={statsQ.data?.livePlayers ?? 0} icon={Radio} accent="magenta" />
        </motion.div>
      </div>
    </section>
  );
}

function TopThree() {
  const q = useQuery({
    queryKey: ["top3"],
    queryFn: async () => {
      const { data } = await supabase
        .from("players")
        .select("id, name_display, points, flags_solved, challenges_completed, first_completed_at")
        .order("points", { ascending: false })
        .order("first_completed_at", { ascending: true, nullsFirst: false })
        .limit(3);
      return data ?? [];
    },
  });

  const medals = ["🥇", "🥈", "🥉"];
  const accents = ["from-yellow-400/40 to-yellow-500/10", "from-slate-300/40 to-slate-400/10", "from-amber-700/40 to-amber-800/10"];

  return (
    <section>
      <div className="flex items-end justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Trophy className="h-6 w-6 text-cyber-cyan" /> Top 3
          </h2>
          <p className="text-sm text-muted-foreground">The podium updates live.</p>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {[0, 1, 2].map((i) => {
          const p = q.data?.[i];
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
  );
}

function Footer() {
  return (
    <footer className="border-t border-glass-border mt-16">
      <div className="mx-auto max-w-7xl px-4 py-6 flex items-center justify-between text-xs text-muted-foreground font-mono">
        <span>CTF/CORE · secured with SHA-256 flag hashing</span>
        <span>{new Date().getFullYear()}</span>
      </div>
    </footer>
  );
}
