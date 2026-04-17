import { NextResponse } from "next/server";
import { MPS } from "@/app/_mock/mps";
export const dynamic = "force-dynamic";
export async function GET(_req: Request, ctx: { params: { id: string } }){
  const item = MPS.find(m => m.id === ctx.params.id);
  return item ? NextResponse.json({ item }) : NextResponse.json({ error:"Not found" }, { status:404 });
}
