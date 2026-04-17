import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const mp = db.mps().find((mp: { id: string }) => mp.id === params.id);
  if (!mp) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const votes = mp.votes.map((v: { billId: any; }) => ({ ...v, bill: db.bills ? db.bills(v.billId) : undefined }));
  return NextResponse.json({ mp: { ...mp, votes } }, { headers: { "Cache-Control": "s-maxage=60" } });
}
