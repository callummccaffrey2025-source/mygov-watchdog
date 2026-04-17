import { z } from "zod";

export const Spark = z.array(z.number().min(0).max(100)).min(4);

export const MPScorecardSchema = z.object({
  slug: z.string(),
  updated_at: z.string(),
  composite: z.number().min(0).max(100),
  peers: z.object({ party_pct: z.number(), house_pct: z.number() }),
  subs: z.object({
    attendance: z.number(),
    party_loyalty: z.number(),
    committees: z.number(),
    influence: z.number(),
    responsiveness: z.number(),
    integrity: z.number(),
  }),
  trend: Spark,
});

export type MPScorecard = z.infer<typeof MPScorecardSchema>;
