import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { generateText } from "ai";
import { createAiGatewayProvider } from "./ai-gateway.server";

export const ocrPdf = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        base64: z.string().min(100).max(20_000_000),
        mime: z.string().default("application/pdf"),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const key = process.env.AI_GATEWAY_KEY;
    if (!key) throw new Error("Missing AI_GATEWAY_KEY");
    const gateway = createAiGatewayProvider(key);
    const model = gateway("google/gemini-3-flash-preview");

    try {
      const { text } = await generateText({
        model,
        temperature: 0,
        maxOutputTokens: 8192,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text:
                  "Extract ALL text from this CV/resume document. Preserve section order and line breaks. Return only the extracted text with no commentary, no markdown fences, no headings you did not read from the file.",
              },
              {
                type: "file",
                data: data.base64,
                mediaType: data.mime,
              },
            ],
          },
        ],
      });
      const cleaned = (text ?? "").trim();
      if (cleaned.replace(/\s/g, "").length < 40) {
        throw new Error(
          "OCR could not read enough text from this file. Please paste the CV text instead.",
        );
      }
      return { text: cleaned };
    } catch (err) {
      if (err instanceof Error && err.message.includes("429")) {
        throw new Error("Rate limit reached. Please wait a moment and try again.");
      }
      if (err instanceof Error && err.message.includes("402")) {
        throw new Error("AI credits exhausted. Please add credits to continue.");
      }
      throw err instanceof Error
        ? err
        : new Error("OCR failed. Please paste the CV text instead.");
    }
  });
