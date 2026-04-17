import { z } from "zod";

export const VoteDecision = z.enum(["Aye","No","Abstain","Absent"]);

export const MPContactOffice = z.object({
  kind: z.enum(["Parliament","Electorate"]),
  address: z.string(),
  phone: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  hours: z.string().nullable().optional(),
});

export const MPProfileSchema = z.object({
  slug: z.string(),
  name: z.string(),
  party: z.string(),
  electorate: z.string(),
  state: z.string(),
  headshot_url: z.string().url().nullable().optional(),
  party_logo_url: z.string().url().nullable().optional(),
  roles: z.array(z.object({ title: z.string(), since: z.string().optional().nullable() })),
  committees: z.array(z.object({ name: z.string(), role: z.string().optional().nullable() })),
  recent_votes: z.array(z.object({
    bill_id: z.string(), bill_title: z.string(), stage: z.string(),
    date: z.string(), decision: VoteDecision
  })),
  news: z.array(z.object({
    id: z.string(), title: z.string(), published_at: z.string(), url: z.string(), source: z.string().nullable().optional()
  })),
  offices: z.array(MPContactOffice).optional(),   // <— allow offices
});
export type MPProfileZ = z.infer<typeof MPProfileSchema>;
