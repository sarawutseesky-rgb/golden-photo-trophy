import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Moderate an uploaded image with Lovable AI (Gemini vision).
 * Returns `{ safe: true }` for OK images, `{ safe: false, reason, category }` otherwise.
 * Fails open (returns safe=true) on AI errors so uploads aren't blocked by infra issues.
 */
export const moderateImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ image_url: z.string().url() }).parse(d),
  )
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) return { safe: true, reason: null, category: null, skipped: true };

    try {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            {
              role: "system",
              content:
                "You are an image moderation classifier for a public photography community. " +
                "Reject images that contain: explicit nudity or sexual content, graphic violence or gore, " +
                "hate symbols, self-harm, illegal content, or anything not appropriate for a general audience. " +
                "Artistic nudity in a clearly fine-art context is allowed but err on the side of caution. " +
                'Reply ONLY with strict JSON: {"safe": boolean, "category": string, "reason": string}. ' +
                'category must be one of: "ok", "nsfw", "violence", "hate", "self_harm", "illegal", "other".',
            },
            {
              role: "user",
              content: [
                { type: "text", text: "Classify this image." },
                { type: "image_url", image_url: { url: data.image_url } },
              ],
            },
          ],
          response_format: { type: "json_object" },
          temperature: 0,
        }),
      });

      if (res.status === 429 || res.status === 402) {
        // Rate limit / credits — fail open to avoid blocking legit uploads
        return { safe: true, reason: null, category: null, skipped: true };
      }
      if (!res.ok) {
        return { safe: true, reason: null, category: null, skipped: true };
      }
      const json = await res.json();
      const content = json?.choices?.[0]?.message?.content;
      if (!content) return { safe: true, reason: null, category: null, skipped: true };

      const parsed = JSON.parse(content);
      const safe = parsed?.safe !== false;
      return {
        safe,
        category: typeof parsed?.category === "string" ? parsed.category : null,
        reason: typeof parsed?.reason === "string" ? parsed.reason : null,
        skipped: false,
      };
    } catch {
      return { safe: true, reason: null, category: null, skipped: true };
    }
  });