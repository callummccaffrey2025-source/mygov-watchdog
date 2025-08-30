import { NextRequest, NextResponse } from "next/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  // TODO: verify signature with STRIPE_WEBHOOK_SECRET and update subscription table
  return NextResponse.json({ ok: true });
}
