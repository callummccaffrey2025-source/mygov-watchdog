import { NextResponse } from "next/server";
export async function POST(req: Request) {
  try {
    const { email } = await req.json();
    // TODO: wire to Supabase/mail provider; for now just 200
    if (!email || typeof email !== "string") {
      return NextResponse.json({ ok: false, error: "Invalid email" }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}
