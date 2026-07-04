import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Search, Trophy, Medal } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useRealtimeInvalidate } from "@/hooks/useRealtimeInvalidate";
import { Nav } from "@/components/ctf/Nav";
import { Countdown } from "@/components/ctf/Countdown";
import { Input } from "@/components/ui/input";
import { usePlayer } from "@/hooks/usePlayer";

export const Route = createFileRoute("/leaderboard")({
  head: () => ({
    meta: [
      { title: "Leaderboard — CTF/CORE" },
      { name: "description", content: "Live CTF leaderboard, ranked by flags, points, and completion time." },
    ],
  }),
  component: LeaderboardPage,
});

type Row = {
  id: string;
  name_display: string;
  points: number;
  flags_solved: number;
  challenges_completed: number;
  first_completed_at: string | null;
  created_at: string;
};

function LeaderboardPage() {
  const [q, setQ] = useState("");
  const { player } = usePlayer();

  const stateQ = useQuery({
    queryKey: ["comp", "state"],
    queryFn: async () => {
      const { data } = await supabase.from("competition_state").select("*").eq("id", 1).single();
      return data;
    },
  });

  const rowsQ = useQuery({
    queryKey: ["leaderboard"],
    queryFn: async () => {
      const { data } = await supabase
        .from("players")
        .select("id, name_display, points, flags_solved, challenges_completed, first_completed_at, created_at")
        .order("points", { ascending: false })
        .order("flags_solved", { ascending: false })
        .order("first_completed_at", { ascending: true, nullsFirst: false });
      return (data ?? []) as Row[];
    },
  });

  useRealtimeInvalidate(
    ["players", "player_challenge_progress", "competition_state"],
    [["leaderboard"], ["comp", "state"]],
  );

  const rows = rowsQ.data ?? [];
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((r) => r.name_display.toLowerCase().includes(s));
  }, [rows, q]);

  const podium = rows.slice(0, 3);

  return (
    <div className="min-h-screen">
      <Nav />
      <main className="mx-auto max-w-6xl px-4 py-8 space-y-8">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold flex items-center gap-2">
              <Trophy className="h-8 w-8 text-cyber-cyan" /> Leaderboard
            </h1>
            <p className="text-sm text-muted-foreground">Live standings update automatically.</p>
          </div>
          <Countdown endsAt={stateQ.data?.ends_at ?? null} status={stateQ.data?.status ?? "live"} />
        </header>

        <div className="grid gap-4 md:grid-cols-3">
          {[0, 1, 2].map((i) => {
            const p = podium[i];
            const medals = ["🥇", "🥈", "🥉"];
            const bg = [
              "from-yellow-400/40 to-transparent",
              "from-slate-300/30 to-transparent",
              "from-amber-700/40 to-transparent",
            ];
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0, transition: { delay: i * 0.08 } }}
                className={`glass rounded-2xl p-5 bg-gradient-to-br ${bg[i]}`}
              >
                <div className="text-3xl">{medals[i]}</div>
                <div className="mt-2 font-mono text-lg font-bold truncate">
                  {p?.name_display ?? "—"}
                </div>
                <div className="flex justify-between text-sm text-muted-foreground mt-2">
                  <span>{p?.points ?? 0} pts</span>
                  <span>{p?.flags_solved ?? 0} flags</span>
                </div>
              </motion.div>
            );
          })}
        </div>

        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search players…" className="pl-9" />
        </div>

        <div className="glass rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-background/40 text-xs uppercase tracking-widest text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-3">Rank</th>
                <th className="text-left px-4 py-3">Player</th>
                <th className="text-right px-4 py-3">Flags</th>
                <th className="text-right px-4 py-3">Points</th>
                <th className="text-right px-4 py-3 hidden md:table-cell">Challenges</th>
                <th className="text-right px-4 py-3 hidden md:table-cell">Finished</th>
                <th className="text-right px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const rank = rows.findIndex((x) => x.id === r.id) + 1;
                const isMe = player?.id === r.id;
                const status =
                  rank === 1 && r.challenges_completed > 0
                    ? "🥇 Winner"
                    : rank === 2 && r.challenges_completed > 0
                      ? "🥈 Winner"
                      : rank === 3 && r.challenges_completed > 0
                        ? "🥉 Winner"
                        : r.first_completed_at
                          ? "Finished"
                          : "Playing";
                return (
                  <tr
                    key={r.id}
                    className={`border-t border-glass-border ${isMe ? "bg-primary/10" : ""}`}
                  >
                    <td className="px-4 py-3 font-mono">
                      {rank <= 3 ? (
                        <span className="inline-flex items-center gap-1">
                          <Medal className={`h-4 w-4 ${rank === 1 ? "text-yellow-400" : rank === 2 ? "text-slate-300" : "text-amber-600"}`} />
                          {rank}
                        </span>
                      ) : (
                        rank
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono">
                      {r.name_display}
                      {isMe ? <span className="ml-2 text-[10px] text-cyber-cyan">YOU</span> : null}
                    </td>
                    <td className="px-4 py-3 text-right font-mono">{r.flags_solved}</td>
                    <td className="px-4 py-3 text-right font-mono text-cyber-cyan">{r.points}</td>
                    <td className="px-4 py-3 text-right font-mono hidden md:table-cell">{r.challenges_completed}</td>
                    <td className="px-4 py-3 text-right font-mono hidden md:table-cell text-xs text-muted-foreground">
                      {r.first_completed_at ? new Date(r.first_completed_at).toLocaleTimeString() : "—"}
                    </td>
                    <td className="px-4 py-3 text-right">{status}</td>
                  </tr>
                );
              })}
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                    No players yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
