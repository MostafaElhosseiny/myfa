import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";

function createPublicClient() {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
}

export const getStats = createServerFn({ method: "GET" }).handler(async () => {
  const supa = createPublicClient();
  const [players, flagsSolved, challenges, activePlayers, state] = await Promise.all([
    supa.from("players").select("*", { count: "exact", head: true }),
    supa.from("player_flag_solves").select("*", { count: "exact", head: true }),
    supa.from("challenges").select("*", { count: "exact", head: true }),
    supa
      .from("players")
      .select("*", { count: "exact", head: true })
      .gte("last_seen_at", new Date(Date.now() - 5 * 60_000).toISOString()),
    supa.from("competition_state").select("status, ends_at").eq("id", 1).maybeSingle(),
  ]);
  return {
    totalPlayers: players.count ?? 0,
    flagsSolved: flagsSolved.count ?? 0,
    totalChallenges: challenges.count ?? 0,
    livePlayers: activePlayers.count ?? 0,
    status: (state.data?.status ?? "live") as string,
    endsAt: state.data?.ends_at ?? null,
  };
});
