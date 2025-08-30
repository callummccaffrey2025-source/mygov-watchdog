export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
export const runtime = "nodejs";
export async function GET() { return NextResponse.json({ ok: true, done: 0, errors: 0 }); }
