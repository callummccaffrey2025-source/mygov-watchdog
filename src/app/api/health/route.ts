export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
export function GET() {
  return NextResponse.json({ ok: true, at: "/api/health", time: new Date().toISOString() });
}
