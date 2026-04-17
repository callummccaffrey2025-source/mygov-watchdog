import { NextResponse } from "next/server";
import { MPHighlightsSchema } from "@/types/highlights.schema";
export const revalidate = 300;

export async function GET(_: Request, { params }: { params: { slug: string } }) {
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? "";
  const [mpRes, metRes] = await Promise.allSettled([
    fetch(`${base}/api/mps/${params.slug}`, { next: { revalidate: 300 } }),
    fetch(`${base}/api/mps/${params.slug}/metrics`, { next: { revalidate: 300 } }),
  ]);

  let items: { text: string; kind: "good"|"warn"|"info" }[] = [];
  try {
    const mp = mpRes.status==="fulfilled" && mpRes.value.ok ? await mpRes.value.json() : null;
    const m  = metRes.status==="fulfilled" && metRes.value.ok ? await metRes.value.json() : null;
    if (m?.composite != null) {
      if (m.composite >= 80) items.push({ text: "Top-tier accountability score.", kind: "good" });
      else if (m.composite <= 50) items.push({ text: "Below-average accountability score — room to improve.", kind: "warn" });
      else items.push({ text: "Solid accountability score.", kind: "info" });
    }
    if (m?.subs?.attendance != null) {
      if (m.subs.attendance >= 90) items.push({ text: "Excellent voting attendance.", kind: "good" });
      if (m.subs.attendance < 70) items.push({ text: "Attendance notably low recently.", kind: "warn" });
    }
    if (mp?.committees?.length) items.push({ text: `Sits on ${mp.committees.length} committee${mp.committees.length>1?"s":""}.`, kind: "info" });
    if (!items.length) items.push({ text: "Tracking activity and committees as data refreshes.", kind: "info" });
  } catch {
    items = [{ text: "Highlights will appear as data loads.", kind: "info" }];
  }

  const payload = { slug: params.slug, updated_at: new Date().toISOString(), items };
  const parsed = MPHighlightsSchema.safeParse(payload);
  if (!parsed.success) return NextResponse.json({ error: "Invalid highlights" }, { status: 500 });
  return NextResponse.json(parsed.data, { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600" }});
}
