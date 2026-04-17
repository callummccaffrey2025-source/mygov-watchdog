import { NextResponse } from "next/server";
import { runIngestBills } from "@/lib/ingest/bills";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const { url } = await req.json();
    const result = await runIngestBills(url);
    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "ingest error" }, { status: 500 });
  }
}
