import { NextResponse } from "next/server";
import { MPScorecardSchema } from "@/types/metrics.schema";

export const revalidate = 300;

export async function GET(_: Request, { params }: { params: { slug: string } }) {
  // TODO: replace demo with real metrics
  const demo = {
    slug: params.slug,
    updated_at: new Date().toISOString(),
    composite: 78,
    peers: { party_pct: 82, house_pct: 74 },
    subs: { attendance: 92, party_loyalty: 70, committees: 65, influence: 60, responsiveness: 80, integrity: 85 },
    trend: [64, 67, 72, 78],
  };
  const parsed = MPScorecardSchema.safeParse(demo);
  if (!parsed.success) return NextResponse.json({ error: "Invalid metrics" }, { status: 500 });
  return NextResponse.json(parsed.data, { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600" } });
}
