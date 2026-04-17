import { z } from "zod";
export const Source = z.object({ label: z.string(), url: z.string().url() });
export const VoteExplainerSchema = z.object({
  bill_id: z.string(),
  bullets: z.array(z.object({ text: z.string(), sources: z.array(Source).min(1) })).min(1),
  confidence: z.enum(["low","medium","high"]).default("medium"),
  updated_at: z.string(),
});
export type VoteExplainer = z.infer<typeof VoteExplainerSchema>;
