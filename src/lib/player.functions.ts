import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const NameSchema = z
  .string()
  .trim()
  .min(2, "Name too short")
  .max(32, "Name too long")
  .regex(/^[\p{L}\p{N} _.\-]+$/u, "Invalid characters");

export const joinAsPlayer = createServerFn({ method: "POST" })
  .inputValidator((data: { name: string }) => ({
    name: NameSchema.parse(data.name),
  }))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const nameLower = data.name.toLowerCase();

    const { data: existing } = await supabaseAdmin
      .from("players")
      .select("id, name_display, points, flags_solved, challenges_completed")
      .eq("name_lower", nameLower)
      .maybeSingle();

    if (existing) {
      await supabaseAdmin
        .from("players")
        .update({ last_seen_at: new Date().toISOString() })
        .eq("id", existing.id);
      return { player: existing, isNew: false };
    }

    const { data: inserted, error } = await supabaseAdmin
      .from("players")
      .insert({ name_display: data.name, name_lower: nameLower })
      .select("id, name_display, points, flags_solved, challenges_completed")
      .single();
    if (error) throw new Error(error.message);

    await supabaseAdmin.from("activity_log").insert({
      player_id: inserted.id,
      kind: "join",
      message: `${inserted.name_display} joined the competition`,
    });

    return { player: inserted, isNew: true };
  });

// Returns the currently active challenge (single-challenge mode) with safe
// flag metadata: order + label only. Hashes never leave the server.
export const getActiveChallenge = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: challenge } = await supabaseAdmin
    .from("challenges")
    .select("id, title, description, category, required_flags, points_per_flag, active")
    .eq("active", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!challenge) return { challenge: null as null };
  const { data: flags } = await supabaseAdmin
    .from("challenge_flags")
    .select("flag_order, label")
    .eq("challenge_id", challenge.id)
    .order("flag_order", { ascending: true });
  return {
    challenge: {
      id: challenge.id,
      title: challenge.title,
      description: challenge.description,
      category: challenge.category,
      required_flags: challenge.required_flags,
      points_per_flag: challenge.points_per_flag,
      fields: (flags ?? []).map((f) => ({ order: f.flag_order, label: f.label })),
    },
  };
});

// Player's progress on active challenge — which flag orders are solved.
export const getMyProgress = createServerFn({ method: "POST" })
  .inputValidator((d: { playerId: string; challengeId: string }) =>
    z.object({ playerId: z.string().uuid(), challengeId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: solves } = await supabaseAdmin
      .from("player_flag_solves")
      .select("flag_hash")
      .eq("player_id", data.playerId)
      .eq("challenge_id", data.challengeId);
    // Map hashes back to their orders (server-only join)
    const hashes = (solves ?? []).map((s) => s.flag_hash);
    let solvedOrders: number[] = [];
    if (hashes.length > 0) {
      const { data: fs } = await supabaseAdmin
        .from("challenge_flags")
        .select("flag_order, flag_hash")
        .eq("challenge_id", data.challengeId)
        .in("flag_hash", hashes);
      solvedOrders = (fs ?? []).map((f) => f.flag_order).sort((a, b) => a - b);
    }
    const { data: prog } = await supabaseAdmin
      .from("player_challenge_progress")
      .select("points, completed_at")
      .eq("player_id", data.playerId)
      .eq("challenge_id", data.challengeId)
      .maybeSingle();
    return {
      solvedOrders,
      points: prog?.points ?? 0,
      completedAt: prog?.completed_at ?? null,
    };
  });

// Constant-time hex-string equality — avoids timing side-channels on hash compare.
function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

export const submitFlag = createServerFn({ method: "POST" })
  .inputValidator((data: { playerId: string; challengeId: string; flag: string }) =>
    z
      .object({
        playerId: z.string().uuid(),
        challengeId: z.string().uuid(),
        flag: z.string().trim().min(1).max(256),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { hashFlag } = await import("@/lib/hash.server");

    // Competition state
    const { data: state } = await supabaseAdmin
      .from("competition_state")
      .select("status, ends_at")
      .eq("id", 1)
      .single();
    if (!state || state.status !== "live") {
      return { status: "closed" as const, message: "Competition is not live" };
    }
    if (state.ends_at && new Date(state.ends_at).getTime() < Date.now()) {
      return { status: "closed" as const, message: "Competition has ended" };
    }

    const { data: player } = await supabaseAdmin
      .from("players")
      .select("id, name_display")
      .eq("id", data.playerId)
      .maybeSingle();
    if (!player) return { status: "invalid" as const, message: "Unknown player" };

    const { data: challenge } = await supabaseAdmin
      .from("challenges")
      .select("id, title, required_flags, points_per_flag, active")
      .eq("id", data.challengeId)
      .maybeSingle();
    if (!challenge || !challenge.active) {
      return { status: "invalid" as const, message: "Challenge not available" };
    }

    const hash = hashFlag(data.flag);

    // Load all flags for challenge (server-only)
    const { data: allFlags } = await supabaseAdmin
      .from("challenge_flags")
      .select("flag_hash, flag_order, label")
      .eq("challenge_id", challenge.id)
      .order("flag_order", { ascending: true });
    const flags = allFlags ?? [];

    // What has the player already solved?
    const { data: prevSolves } = await supabaseAdmin
      .from("player_flag_solves")
      .select("flag_hash")
      .eq("player_id", player.id)
      .eq("challenge_id", challenge.id);
    const solvedOrders = new Set(
      (prevSolves ?? [])
        .map((s) => flags.find((f) => f.flag_hash === s.flag_hash)?.flag_order)
        .filter((v): v is number => typeof v === "number"),
    );
    const nextRequiredOrder = flags
      .map((f) => f.flag_order)
      .find((o) => !solvedOrders.has(o));

    // Match only against the currently-expected flag. This intentionally
    // supports duplicate flag values across positions while still forcing
    // sequential submission.
    const expected = nextRequiredOrder
      ? flags.find((f) => f.flag_order === nextRequiredOrder) ?? null
      : null;
    const matched = expected && timingSafeEqualHex(expected.flag_hash, hash) ? expected : null;

    // Log every attempt (audit)
    await supabaseAdmin.from("submissions").insert({
      player_id: player.id,
      challenge_id: challenge.id,
      flag_hash: hash,
      correct: !!matched,
    });

    if (!expected) {
      return { status: "duplicate" as const, message: "All flags already captured." };
    }
    if (!matched) {
      return { status: "incorrect" as const, message: "Incorrect flag" };
    }

    // Record solve
    await supabaseAdmin.from("player_flag_solves").insert({
      player_id: player.id,
      challenge_id: challenge.id,
      flag_hash: matched.flag_hash,
    });

    const flagsSolved = solvedOrders.size + 1;
    const points = flagsSolved * challenge.points_per_flag;
    const completed = flagsSolved >= challenge.required_flags;
    const completedAt = completed ? new Date().toISOString() : null;

    await supabaseAdmin.from("player_challenge_progress").upsert({
      player_id: player.id,
      challenge_id: challenge.id,
      flags_solved: flagsSolved,
      points,
      completed_at: completedAt,
      updated_at: new Date().toISOString(),
    });

    // Recompute totals
    const { data: progressRows } = await supabaseAdmin
      .from("player_challenge_progress")
      .select("flags_solved, points, completed_at")
      .eq("player_id", player.id);
    const totalFlags = (progressRows ?? []).reduce((s, r) => s + (r.flags_solved ?? 0), 0);
    const totalPoints = (progressRows ?? []).reduce((s, r) => s + (r.points ?? 0), 0);
    const totalCompleted = (progressRows ?? []).filter((r) => r.completed_at).length;
    const completedTimes = (progressRows ?? [])
      .map((r) => r.completed_at)
      .filter((v): v is string => !!v)
      .sort();
    const firstCompletedAt = completedTimes[completedTimes.length - 1] ?? null;

    await supabaseAdmin
      .from("players")
      .update({
        points: totalPoints,
        flags_solved: totalFlags,
        challenges_completed: totalCompleted,
        first_completed_at: firstCompletedAt,
        last_seen_at: new Date().toISOString(),
      })
      .eq("id", player.id);

    await supabaseAdmin.from("activity_log").insert({
      player_id: player.id,
      challenge_id: challenge.id,
      kind: completed ? "challenge_completed" : "flag_solved",
      message: completed
        ? `${player.name_display} completed ${challenge.title}`
        : `${player.name_display} captured ${matched.label} on ${challenge.title}`,
    });

    return {
      status: "correct" as const,
      message: completed ? "Challenge complete!" : `${matched.label} accepted`,
      flagsSolved,
      requiredFlags: challenge.required_flags,
      points,
      completed,
    };
  });
