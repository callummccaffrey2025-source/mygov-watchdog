import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const metric = await req.json();
    console.log(JSON.stringify({ type: "web-vitals", ...metric }));
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}
