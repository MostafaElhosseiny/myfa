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

    // Check competition state
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

    // Is it a valid flag for this challenge?
    const { data: flagRow } = await supabaseAdmin
      .from("challenge_flags")
      .select("id, flag_order")
      .eq("challenge_id", challenge.id)
      .eq("flag_hash", hash)
      .maybeSingle();

    // Log every submission
    await supabaseAdmin.from("submissions").insert({
      player_id: player.id,
      challenge_id: challenge.id,
      flag_hash: hash,
      correct: !!flagRow,
    });

    if (!flagRow) {
      return { status: "incorrect" as const, message: "Incorrect flag" };
    }

    // Duplicate?
    const { data: already } = await supabaseAdmin
      .from("player_flag_solves")
      .select("flag_hash")
      .eq("player_id", player.id)
      .eq("challenge_id", challenge.id)
      .eq("flag_hash", hash)
      .maybeSingle();
    if (already) {
      return { status: "duplicate" as const, message: "You already submitted this flag." };
    }

    // Record solve
    await supabaseAdmin.from("player_flag_solves").insert({
      player_id: player.id,
      challenge_id: challenge.id,
      flag_hash: hash,
    });

    // Recompute progress for this challenge
    const { count: solvedCount } = await supabaseAdmin
      .from("player_flag_solves")
      .select("*", { count: "exact", head: true })
      .eq("player_id", player.id)
      .eq("challenge_id", challenge.id);

    const flagsSolved = solvedCount ?? 0;
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

    // Recompute player totals
    const { data: progressRows } = await supabaseAdmin
      .from("player_challenge_progress")
      .select("flags_solved, points, completed_at")
      .eq("player_id", player.id);

    const totalFlags = (progressRows ?? []).reduce((s, r) => s + (r.flags_solved ?? 0), 0);
    const totalPoints = (progressRows ?? []).reduce((s, r) => s + (r.points ?? 0), 0);
    const totalChallengesCompleted = (progressRows ?? []).filter((r) => r.completed_at).length;
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
        challenges_completed: totalChallengesCompleted,
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
        : `${player.name_display} solved a flag on ${challenge.title}`,
    });

    return {
      status: "correct" as const,
      message: completed ? "Challenge complete!" : "Flag accepted",
      flagsSolved,
      requiredFlags: challenge.required_flags,
      points,
      completed,
    };
  });
