import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { email, redirectTo="/" } = await req.json();
    if (!email || typeof email !== "string") {
      return NextResponse.json({ ok:false, error:"email required" }, { status: 400 });
    }
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    if (!url || !anon) {
      return NextResponse.json({ ok:false, error:"Supabase env missing" }, { status: 500 });
    }
    const resp = await fetch(`${url}/auth/v1/magiclink`, {
      method: "POST",
      headers: {
        "apikey": anon,
        "Authorization": `Bearer ${anon}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, redirect_to: redirectTo }),
      cache: "no-store",
    });
    if (!resp.ok) {
      const t = await resp.text().catch(()=> "error");
      return NextResponse.json({ ok:false, error:t || "auth error" }, { status: 500 });
    }
    return NextResponse.json({ ok:true });
  } catch (e:any) {
    return NextResponse.json({ ok:false, error:"server error" }, { status: 500 });
  }
}
