import { NextResponse } from "next/server";
import { db } from "@/lib/db";
export async function GET(_req: Request, ctx: any){
  const id = ctx?.params?.id;
  if (!id) return new NextResponse("Bad Request", { status: 400 });
  // Decide which model based on path segment (bills or mps)
  if (typeof id !== "string") return new NextResponse("Bad Request", { status: 400 });
  try{
    if (__filename.includes("/bills/")) {
      const bill = await db.bill.findUnique({ where:{ id } });
      return bill ? NextResponse.json(bill) : new NextResponse("Not found", { status:404 });
    } else {
      const mp = await db.mP.findUnique({ where:{ id } });
      return mp ? NextResponse.json(mp) : new NextResponse("Not found", { status:404 });
    }
  }catch(e:any){
    return new NextResponse(e?.message||"error",{ status:500 });
  }
}
