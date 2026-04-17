import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { email, region } = await req.json();
    if (!email || typeof email !== "string") {
      return NextResponse.json({ ok: false, error: "invalid-email" }, { status: 400 });
    }
    console.log("[join] new lead:", { email, region, at: new Date().toISOString() });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
