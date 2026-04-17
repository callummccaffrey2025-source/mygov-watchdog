import { z } from "zod";
export const MPHighlightsSchema = z.object({
  slug: z.string(),
  updated_at: z.string(),
  items: z.array(z.object({ text: z.string(), kind: z.enum(["good","warn","info"]).default("info") })).min(1),
});
export type MPHighlights = z.infer<typeof MPHighlightsSchema>;
