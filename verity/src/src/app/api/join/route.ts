import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
  const { email, consent } = await req.json().catch(() => ({}));
  if (!email || typeof email !== "string") return NextResponse.json({ ok: false, error: "Email required" }, { status: 400 });
  db.appendWaitlist(email, !!consent);
  return NextResponse.json({ ok: true });
}
