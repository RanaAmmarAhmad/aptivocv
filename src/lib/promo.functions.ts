import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

const ADMIN_EMAIL = "marikhan0320@gmail.com";

function isAdmin(claims: Record<string, unknown> | undefined): boolean {
  const email = (claims as { email?: string } | undefined)?.email;
  return (email ?? "").trim().toLowerCase() === ADMIN_EMAIL;
}

async function checkAdmin(
  claims: Record<string, unknown> | undefined,
  supabase: SupabaseClient<Database>,
): Promise<boolean> {
  if (isAdmin(claims)) return true;
  const { data, error } = await supabase.rpc("is_admin_email");
  if (error) throw new Error(error.message);
  return data === true;
}

// -------- Admin: list codes --------
export const listPromoCodes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    if (!(await checkAdmin(context.claims, context.supabase))) {
      return { ok: false as const, admin: false as const };
    }
    const { data: codes, error } = await context.supabase
      .from("promo_codes")
      .select("code, credits, active, notes, created_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    // Redemption counts per code
    const { data: reds, error: redemptionsError } = await context.supabase
      .from("promo_redemptions")
      .select("code");
    if (redemptionsError) throw new Error(redemptionsError.message);
    const counts = new Map<string, number>();
    for (const r of reds ?? []) {
      counts.set(r.code, (counts.get(r.code) ?? 0) + 1);
    }
    return {
      ok: true as const,
      admin: true as const,
      codes: (codes ?? []).map((c) => ({ ...c, redemptions: counts.get(c.code) ?? 0 })),
    };
  });

// -------- Admin: create code --------
export const createPromoCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        code: z
          .string()
          .trim()
          .min(3)
          .max(40)
          .regex(/^[A-Za-z0-9_-]+$/),
        credits: z.number().int().min(1).max(10000).default(100),
        notes: z.string().max(200).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    if (!(await checkAdmin(context.claims, context.supabase))) throw new Error("Forbidden");
    const code = data.code.toUpperCase();
    const { error } = await context.supabase.from("promo_codes").insert({
      code,
      credits: data.credits,
      notes: data.notes ?? null,
      created_by: context.userId,
    });
    if (error) {
      if (error.code === "23505") throw new Error("Promo code already exists.");
      throw new Error(error.message);
    }
    return { ok: true, code };
  });

// -------- Admin: toggle active --------
export const setPromoCodeActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ code: z.string(), active: z.boolean() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    if (!(await checkAdmin(context.claims, context.supabase))) throw new Error("Forbidden");
    const { error } = await context.supabase
      .from("promo_codes")
      .update({ active: data.active })
      .eq("code", data.code.toUpperCase());
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// -------- Admin: overall promo credit stats --------
export const getPromoAdminStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    if (!(await checkAdmin(context.claims, context.supabase))) {
      return { ok: false as const, admin: false as const };
    }
    const [codesResult, redsResult, poolsResult] = await Promise.all([
      context.supabase.from("promo_codes").select("code, credits, active"),
      context.supabase.from("promo_redemptions").select("credited, user_id"),
      context.supabase.from("user_promo_credits").select("credits_remaining, credits_granted_total"),
    ]);
    if (codesResult.error) throw new Error(codesResult.error.message);
    if (redsResult.error) throw new Error(redsResult.error.message);
    if (poolsResult.error) throw new Error(poolsResult.error.message);
    const codes = codesResult.data;
    const reds = redsResult.data;
    const pools = poolsResult.data;
    const total_codes = codes?.length ?? 0;
    const active_codes = (codes ?? []).filter((c) => c.active).length;
    const total_redemptions = reds?.length ?? 0;
    const unique_redeemers = new Set((reds ?? []).map((r) => r.user_id)).size;
    const total_credits_granted = (pools ?? []).reduce(
      (s, p) => s + (p.credits_granted_total ?? 0),
      0,
    );
    const total_credits_remaining = (pools ?? []).reduce(
      (s, p) => s + (p.credits_remaining ?? 0),
      0,
    );
    const total_credits_used = total_credits_granted - total_credits_remaining;
    return {
      ok: true as const,
      admin: true as const,
      total_codes,
      active_codes,
      total_redemptions,
      unique_redeemers,
      total_credits_granted,
      total_credits_remaining,
      total_credits_used,
    };
  });

// -------- User: redeem code --------
export const redeemPromoCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ code: z.string().trim().min(3).max(40) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const code = data.code.toUpperCase();
    // One redemption per (user, code)
    const { data: prior, error: priorError } = await context.supabase
      .from("promo_redemptions")
      .select("code")
      .eq("user_id", context.userId)
      .eq("code", code)
      .maybeSingle();
    if (priorError) throw new Error(priorError.message);
    if (prior) throw new Error("You've already redeemed this code.");

    // The database trigger validates the private promo code and applies credits.
    const { data: redemption, error: rErr } = await context.supabase
      .from("promo_redemptions")
      .insert({
      user_id: context.userId,
      code,
      credited: 0,
    })
      .select("credited")
      .single();
    if (rErr) {
      if (rErr.code === "23505") throw new Error("You've already redeemed this code.");
      throw new Error(rErr.message);
    }
    return { ok: true, credits: redemption.credited };
  });