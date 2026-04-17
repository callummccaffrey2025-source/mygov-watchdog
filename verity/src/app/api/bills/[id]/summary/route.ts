import { NextResponse } from "next/server";
import { VoteExplainerSchema } from "@/types/vote-explainer.schema";
export const revalidate = 3600;

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const demo = {
    bill_id: params.id,
    bullets: [
      { text: "Introduces a binding timeline for key privacy reforms.", sources: [{ label: "EM", url: "https://www.aph.gov.au/" }] },
      { text: "Raises penalties and funds OAIC enforcement.", sources: [{ label: "Bill Text", url: "https://www.aph.gov.au/" }] },
      { text: "Small businesses under $3m revenue mostly exempt in this tranche.", sources: [{ label: "AGD FAQ", url: "https://www.ag.gov.au/" }] },
    ],
    confidence: "medium",
    updated_at: new Date().toISOString(),
  };
  const parsed = VoteExplainerSchema.safeParse(demo);
  if (!parsed.success) return NextResponse.json({ error: "Invalid summary" }, { status: 500 });
  return NextResponse.json(parsed.data, { headers: { "Cache-Control": "public, s-maxage=3600" } });
}
