import { NextResponse } from "next/server";
export async function POST(req: Request) {
  const {type, meta} = await req.json().catch(()=>({}));
  // TODO: write to KV / Postgres; do not store IP/UserAgent persistently
  return NextResponse.json({ ok: true });
}
