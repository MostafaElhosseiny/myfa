import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", context.userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error || !data) throw new Error("Forbidden: admin only");
}

const FlagFieldInput = z.object({
  value: z.string().trim().min(1).max(256),
  label: z.string().trim().min(1).max(60),
});

const ChallengeInput = z.object({
  title: z.string().trim().min(2).max(120),
  description: z.string().trim().max(2000).default(""),
  category: z.string().trim().min(1).max(40).default("Misc"),
  points_per_flag: z.number().int().min(1).max(10000),
  active: z.boolean().default(true),
  fields: z.array(FlagFieldInput).min(1).max(20),
});

export const createChallenge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => ChallengeInput.parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { hashFlag } = await import("@/lib/hash.server");

    // Single-active-challenge mode: deactivate anything currently active if this is active.
    if (data.active) {
      await supabaseAdmin.from("challenges").update({ active: false }).eq("active", true);
    }

    const { data: ch, error } = await supabaseAdmin
      .from("challenges")
      .insert({
        title: data.title,
        description: data.description,
        category: data.category,
        required_flags: data.fields.length,
        points_per_flag: data.points_per_flag,
        active: data.active,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    const flagRows = data.fields.map((f, i) => ({
      challenge_id: ch.id,
      flag_hash: hashFlag(f.value),
      flag_order: i + 1,
      label: f.label,
    }));
    const { error: fErr } = await supabaseAdmin.from("challenge_flags").insert(flagRows);
    if (fErr) throw new Error(fErr.message);

    return { id: ch.id };
  });

export const updateChallenge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    ChallengeInput.extend({
      id: z.string().uuid(),
      fields: z.array(FlagFieldInput).min(0).max(20),
      replaceFlags: z.boolean().default(false),
      labelsOnly: z.boolean().default(false),
    }).parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { hashFlag } = await import("@/lib/hash.server");

    if (data.active) {
      await supabaseAdmin
        .from("challenges")
        .update({ active: false })
        .eq("active", true)
        .neq("id", data.id);
    }

    const required = data.replaceFlags ? data.fields.length : undefined;

    const patch: Record<string, unknown> = {
      title: data.title,
      description: data.description,
      category: data.category,
      points_per_flag: data.points_per_flag,
      active: data.active,
    };
    if (required !== undefined) patch.required_flags = required;

    const { error } = await supabaseAdmin.from("challenges").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);

    if (data.replaceFlags && data.fields.length > 0) {
      await supabaseAdmin.from("challenge_flags").delete().eq("challenge_id", data.id);
      await supabaseAdmin.from("challenge_flags").insert(
        data.fields.map((f, i) => ({
          challenge_id: data.id,
          flag_hash: hashFlag(f.value),
          flag_order: i + 1,
          label: f.label,
        })),
      );
      await supabaseAdmin.from("player_flag_solves").delete().eq("challenge_id", data.id);
      await supabaseAdmin.from("player_challenge_progress").delete().eq("challenge_id", data.id);
    } else if (data.labelsOnly && data.fields.length > 0) {
      // Rename labels without touching hashes/progress.
      for (let i = 0; i < data.fields.length; i++) {
        await supabaseAdmin
          .from("challenge_flags")
          .update({ label: data.fields[i].label })
          .eq("challenge_id", data.id)
          .eq("flag_order", i + 1);
      }
    }
    return { ok: true };
  });

export const deleteChallenge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("challenges").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setCompetitionState = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        status: z.enum(["upcoming", "live", "paused", "finished"]),
        ends_at: z.string().datetime().nullable().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const patch: { status: typeof data.status; updated_at: string; ends_at?: string | null } = {
      status: data.status,
      updated_at: new Date().toISOString(),
    };
    if (data.ends_at !== undefined) patch.ends_at = data.ends_at;
    const { error } = await supabaseAdmin.from("competition_state").update(patch).eq("id", 1);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const resetCompetition = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("activity_log").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabaseAdmin.from("submissions").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabaseAdmin.from("player_flag_solves").delete().neq("player_id", "00000000-0000-0000-0000-000000000000");
    await supabaseAdmin.from("player_challenge_progress").delete().neq("player_id", "00000000-0000-0000-0000-000000000000");
    await supabaseAdmin
      .from("players")
      .update({ points: 0, flags_solved: 0, challenges_completed: 0, first_completed_at: null })
      .neq("id", "00000000-0000-0000-0000-000000000000");
    return { ok: true };
  });

export const resetPlayer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("player_flag_solves").delete().eq("player_id", data.id);
    await supabaseAdmin.from("player_challenge_progress").delete().eq("player_id", data.id);
    await supabaseAdmin.from("submissions").delete().eq("player_id", data.id);
    await supabaseAdmin
      .from("players")
      .update({ points: 0, flags_solved: 0, challenges_completed: 0, first_completed_at: null })
      .eq("id", data.id);
    return { ok: true };
  });

export const deletePlayer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("players").delete().eq("id", data.id);
    return { ok: true };
  });

export const getAdminChallenges = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: challenges } = await supabaseAdmin
      .from("challenges")
      .select("*")
      .order("created_at", { ascending: false });
    const rows = challenges ?? [];
    const ids = rows.map((r) => r.id);
    let labelsByChallenge = new Map<string, { flag_order: number; label: string }[]>();
    if (ids.length > 0) {
      const { data: flags } = await supabaseAdmin
        .from("challenge_flags")
        .select("challenge_id, flag_order, label")
        .in("challenge_id", ids)
        .order("flag_order", { ascending: true });
      for (const f of flags ?? []) {
        const arr = labelsByChallenge.get(f.challenge_id) ?? [];
        arr.push({ flag_order: f.flag_order, label: f.label });
        labelsByChallenge.set(f.challenge_id, arr);
      }
    }
    return rows.map((r) => ({ ...r, fields: labelsByChallenge.get(r.id) ?? [] }));
  });

export const getAdminSubmissions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("submissions")
      .select("id, correct, submitted_at, player_id, challenge_id, players(name_display), challenges(title)")
      .order("submitted_at", { ascending: false })
      .limit(200);
    return data ?? [];
  });

export const getAdminPlayers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("players")
      .select("*")
      .order("points", { ascending: false });
    return data ?? [];
  });

export const exportLeaderboardCsv = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("players")
      .select("name_display, points, flags_solved, challenges_completed, first_completed_at, created_at")
      .order("points", { ascending: false })
      .order("first_completed_at", { ascending: true, nullsFirst: false });
    const rows = data ?? [];
    const header = "rank,name,points,flags_solved,challenges_completed,first_completed_at,joined_at";
    const csv = [header]
      .concat(
        rows.map((r, i) =>
          [
            i + 1,
            JSON.stringify(r.name_display),
            r.points,
            r.flags_solved,
            r.challenges_completed,
            r.first_completed_at ?? "",
            r.created_at ?? "",
          ].join(","),
        ),
      )
      .join("\n");
    return { csv };
  });
