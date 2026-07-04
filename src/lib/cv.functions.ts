import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { generateText, NoObjectGeneratedError, Output } from "ai";
import { createAiGatewayProvider } from "./ai-gateway.server";

const CvModelResponse = z.object({
  full_name: z.string().nullish(),
  email: z.string().nullish(),
  phone: z.string().nullish(),
  address: z.string().nullish(),
  linkedin: z.string().nullish(),
  website: z.string().nullish(),
  current_title: z.string().nullish(),
  years_experience: z.string().nullish(),
  professional_summary: z.string().nullish(),
  technical_skills: z.array(z.string()).nullish(),
  soft_skills: z.array(z.string()).nullish(),
  work_history: z
    .array(
      z.object({
        title: z.string().nullish(),
        company: z.string().nullish(),
        location: z.string().nullish(),
        duration: z.string().nullish(),
        summary: z.string().nullish(),
        bullets: z.array(z.string()).nullish(),
      })
    )
    .nullish(),
  education: z
    .array(
      z.object({
        degree: z.string().nullish(),
        institution: z.string().nullish(),
        location: z.string().nullish(),
        year: z.string().nullish(),
        details: z.string().nullish(),
      })
    )
    .nullish(),
  certifications: z.array(z.string()).nullish(),
  languages: z.array(z.string()).nullish(),
  projects: z
    .array(
      z.object({
        name: z.string().nullish(),
        description: z.string().nullish(),
        stack: z.array(z.string()).nullish(),
      }),
    )
    .nullish(),
});

const CvStructured = z.object({
  full_name: z.string().nullable(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  address: z.string().nullable(),
  linkedin: z.string().nullable(),
  website: z.string().nullable(),
  current_title: z.string().nullable(),
  years_experience: z.string().nullable(),
  professional_summary: z.string().nullable(),
  technical_skills: z.array(z.string()),
  soft_skills: z.array(z.string()),
  work_history: z.array(
    z.object({
      title: z.string(),
      company: z.string(),
      location: z.string().nullable(),
      duration: z.string().nullable(),
      summary: z.string().nullable(),
      bullets: z.array(z.string()),
    })
  ),
  education: z.array(
    z.object({
      degree: z.string(),
      institution: z.string(),
      location: z.string().nullable(),
      year: z.string().nullable(),
      details: z.string().nullable(),
    })
  ),
  certifications: z.array(z.string()),
  languages: z.array(z.string()),
  projects: z.array(
    z.object({
      name: z.string(),
      description: z.string().nullable(),
      stack: z.array(z.string()),
    }),
  ),
});

export type CvStructuredType = z.infer<typeof CvStructured>;

function cleanText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeStringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0).map((item) => item.trim())
    : [];
}

function normalizeCv(value: unknown): CvStructuredType {
  const parsed = CvModelResponse.safeParse(value);
  const cv = parsed.success ? parsed.data : {};

  return {
    full_name: cleanText(cv.full_name),
    email: cleanText(cv.email),
    phone: cleanText(cv.phone),
    address: cleanText(cv.address),
    linkedin: cleanText(cv.linkedin),
    website: cleanText(cv.website),
    current_title: cleanText(cv.current_title),
    years_experience: cleanText(cv.years_experience),
    professional_summary: cleanText(cv.professional_summary),
    technical_skills: normalizeStringList(cv.technical_skills),
    soft_skills: normalizeStringList(cv.soft_skills),
    work_history: (cv.work_history ?? [])
      .map((item) => ({
        title: cleanText(item.title) ?? "Role not specified",
        company: cleanText(item.company) ?? "Company not specified",
        location: cleanText(item.location),
        duration: cleanText(item.duration),
        summary: cleanText(item.summary),
        bullets: normalizeStringList(item.bullets),
      }))
      .filter((item) => item.title !== "Role not specified" || item.company !== "Company not specified"),
    education: (cv.education ?? [])
      .map((item) => ({
        degree: cleanText(item.degree) ?? "Degree not specified",
        institution: cleanText(item.institution) ?? "Institution not specified",
        location: cleanText(item.location),
        year: cleanText(item.year),
        details: cleanText(item.details),
      }))
      .filter((item) => item.degree !== "Degree not specified" || item.institution !== "Institution not specified"),
    certifications: normalizeStringList(cv.certifications),
    languages: normalizeStringList(cv.languages),
    projects: (cv.projects ?? [])
      .map((p) => ({
        name: cleanText(p.name) ?? "",
        description: cleanText(p.description),
        stack: normalizeStringList(p.stack),
      }))
      .filter((p) => p.name.length > 0),
  };
}

function extractJsonObject(text: string): unknown | null {
  const cleaned = text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end <= start) return null;

  try {
    return JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    return null;
  }
}

function fallbackCvFromRaw(rawText: string): CvStructuredType {
  const email = rawText.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] ?? null;
  const phone = rawText.match(/(?:\+?\d[\d\s().-]{7,}\d)/)?.[0]?.trim() ?? null;
  const linkedin = rawText.match(/(?:https?:\/\/)?(?:www\.)?linkedin\.com\/[^\s)]+/i)?.[0] ?? null;
  const firstMeaningfulLine = rawText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.length > 1 && !line.includes("@") && !/linkedin\.com/i.test(line));

  return normalizeCv({
    full_name: firstMeaningfulLine ?? null,
    email,
    phone,
    linkedin,
  });
}

export const parseCvText = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ raw_text: z.string().min(20).max(80000) }).parse(d)
  )
  .handler(async ({ data }) => {
    const key = process.env.AI_GATEWAY_KEY;
    if (!key) throw new Error("Missing AI_GATEWAY_KEY");
    const gateway = createAiGatewayProvider(key);
    const model = gateway("google/gemini-3-flash-preview");

    try {
      const { output } = await generateText({
        model,
        output: Output.object({
          schema: CvModelResponse,
          name: "cv_extract",
          description: "Structured information extracted from a CV/resume.",
        }),
        temperature: 0,
        maxOutputTokens: 8192,
       prompt: `You are extracting structured data from a CV/resume. Your job is total recall: never omit a role, bullet, project, cert, or contact detail that appears in the source. Do NOT invent anything. Use null for missing single fields and [] for missing lists. Preserve the wording, dates, punctuation, and casing used in the source.

Required behavior:
- full_name / email / phone / address / linkedin / website: pull from the header of the CV. Keep phone in the exact format written.
- current_title: the most recent role title.
- professional_summary: if the CV has a summary / profile / objective / about paragraph at the top, capture it verbatim (may span several sentences). Otherwise null.
- technical_skills: EVERY tool, language, framework, library, platform, database, cloud service, methodology mentioned anywhere in the CV, skills section, headers, project descriptions, experience bullets. Deduplicate case-insensitively but keep the original casing (e.g. "TypeScript", not "typescript").
- soft_skills: communication / leadership / collaboration traits if mentioned.
- work_history: EVERY role in the CV, in the order it appears. For each role:
  - title, company, location (city, country if present), duration (as written, e.g. "Jan 2022 - Present").
  - bullets: an array containing EVERY bullet or achievement line under that role, verbatim. Do not merge, summarise, or truncate them. Strip only leading "•", "-", "*" markers.
  - summary: a short one-line description of the role, ONLY if the CV itself has a description paragraph separate from the bullets. Otherwise null.
- education: EVERY entry with degree, institution, location, year (or year range), and details (GPA, honors, thesis, coursework) if present.
- projects: any standalone projects, with name, description, and the tech stack list.
- certifications: full list, verbatim (issuer + year in the same string if that is how it appears).
- languages: full list.

Return only the schema fields.

CV:
${data.raw_text}`,
      });
      return normalizeCv(output);
    } catch (error) {
      if (NoObjectGeneratedError.isInstance(error) && error.text) {
        const json = extractJsonObject(error.text);
        if (json) return normalizeCv(json);
      }

      if (error instanceof Error && error.message.includes("429")) {
        throw new Error("Rate limit reached. Please wait a moment and try again.");
      }
      if (error instanceof Error && error.message.includes("402")) {
        throw new Error("AI credits exhausted. Please add credits to continue.");
      }

      return fallbackCvFromRaw(data.raw_text);
    }
  });

export const saveCv = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        thread_id: z.string().uuid(),
        raw_text: z.string().min(20).max(80000),
        structured: CvStructured,
      })
      .parse(d)
  )
  .handler(async ({ data, context }) => {
    // Enforce monthly CV quota. A "CV" = a thread that has cv_raw_text set,
    // updated within this calendar month for this user.
    const monthStart = new Date();
    monthStart.setUTCDate(1);
    monthStart.setUTCHours(0, 0, 0, 0);
    const { data: used } = await context.supabase
      .from("threads")
      .select("id, cv_raw_text, updated_at")
      .eq("user_id", context.userId)
      .not("cv_raw_text", "is", null)
      .gte("updated_at", monthStart.toISOString());
    const usedIds = new Set((used ?? []).map((r) => r.id as string));
    // Don't count this thread if it already had a CV this month.
    const isNewThisMonth = !usedIds.has(data.thread_id);
    if (isNewThisMonth && usedIds.size >= CV_QUOTA_PER_MONTH) {
      // Monthly free tier exhausted, try to consume from promo bonus pool.
      const { supabaseAdmin } = await import(
        "@/integrations/supabase/client.server"
      );
      const { data: pool } = await supabaseAdmin
        .from("user_promo_credits")
        .select("credits_remaining")
        .eq("user_id", context.userId)
        .maybeSingle();
      const bonus = pool?.credits_remaining ?? 0;
      if (bonus <= 0) {
        throw new Error(
          `Monthly CV limit reached (${CV_QUOTA_PER_MONTH}/${CV_QUOTA_PER_MONTH}). Redeem a promo code or delete an existing chat to free a slot.`,
        );
      }
      const { error: dErr } = await supabaseAdmin
        .from("user_promo_credits")
        .update({
          credits_remaining: bonus - 1,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", context.userId);
      if (dErr) throw new Error(dErr.message);
    }
    const title = data.structured.full_name
      ? `${data.structured.full_name}'s CV`
      : "New chat";
    const { error } = await context.supabase
      .from("threads")
      .update({
        cv_raw_text: data.raw_text,
        cv_structured: data.structured,
        title,
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.thread_id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const CV_QUOTA_PER_MONTH = 10;

export const getCvQuota = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const monthStart = new Date();
    monthStart.setUTCDate(1);
    monthStart.setUTCHours(0, 0, 0, 0);
    const { data, error } = await context.supabase
      .from("threads")
      .select("id")
      .eq("user_id", context.userId)
      .not("cv_raw_text", "is", null)
      .gte("updated_at", monthStart.toISOString());
    if (error) throw new Error(error.message);
    const used = (data ?? []).length;
    const limit = CV_QUOTA_PER_MONTH;
    const nextReset = new Date(monthStart);
    nextReset.setUTCMonth(nextReset.getUTCMonth() + 1);
    // Bonus (promo) pool, own-user read is allowed by RLS
    const { data: pool } = await context.supabase
      .from("user_promo_credits")
      .select("credits_remaining, credits_granted_total")
      .eq("user_id", context.userId)
      .maybeSingle();
    const bonus_remaining = pool?.credits_remaining ?? 0;
    const bonus_granted_total = pool?.credits_granted_total ?? 0;
    const monthly_remaining = Math.max(0, limit - used);
    const tokenEmail = (context.claims as { email?: string } | undefined)?.email ?? null;
    const { data: profile } = await context.supabase
      .from("profiles")
      .select("email")
      .eq("id", context.userId)
      .maybeSingle();
    const email = tokenEmail ?? profile?.email ?? null;
    const isAdminByEmail =
      (email ?? "").trim().toLowerCase() === "marikhan0320@gmail.com";
    const { data: isAdminByPolicy } = await context.supabase.rpc("is_admin_email");
    return {
      used,
      limit,
      remaining: monthly_remaining + bonus_remaining,
      monthly_remaining,
      bonus_remaining,
      bonus_granted_total,
      total_available: limit + bonus_remaining,
      resets_at: nextReset.toISOString(),
      email,
      is_admin: isAdminByEmail || isAdminByPolicy === true,
    };
  });

export const createThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        clone_from_thread_id: z.string().uuid().optional(),
        title: z.string().max(120).optional(),
      })
      .optional()
      .parse(d)
  )
  .handler(async ({ data, context }) => {
    let cv_raw_text: string | null = null;
    let cv_structured: CvStructuredType | null = null;
    if (data?.clone_from_thread_id) {
      const { data: src } = await context.supabase
        .from("threads")
        .select("cv_raw_text, cv_structured")
        .eq("id", data.clone_from_thread_id)
        .eq("user_id", context.userId)
        .maybeSingle();
      if (src?.cv_raw_text && src.cv_structured) {
        cv_raw_text = src.cv_raw_text as string;
        cv_structured = src.cv_structured as CvStructuredType;
      }
    }
    const { data: row, error } = await context.supabase
      .from("threads")
      .insert({
        user_id: context.userId,
        title: data?.title ?? "New chat",
        cv_raw_text,
        cv_structured: cv_structured ?? undefined,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id as string };
  });

export const listThreads = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("threads")
      .select("id, title, created_at, cv_structured")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const getThread = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ thread_id: z.string().uuid() }).parse(d)
  )
  .handler(async ({ data, context }) => {
    const { data: thread, error } = await context.supabase
      .from("threads")
      .select("*")
      .eq("id", data.thread_id)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!thread) throw new Error("Thread not found");

    const { data: messages, error: mErr } = await context.supabase
      .from("messages")
      .select("*")
      .eq("thread_id", data.thread_id)
      .order("created_at", { ascending: true });
    if (mErr) throw new Error(mErr.message);

    return { thread, messages: messages ?? [] };
  });

export const deleteThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ thread_id: z.string().uuid() }).parse(d)
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("threads")
      .delete()
      .eq("id", data.thread_id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
