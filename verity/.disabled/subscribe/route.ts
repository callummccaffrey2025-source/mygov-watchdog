import { NextResponse } from "next/server";
import { addSubscriber } from "@/lib/queries";

export async function POST(req: Request){
  try{
    const { email } = await req.json();
    if(!email) return NextResponse.json({ error:"Email required" },{ status:400 });
    await addSubscriber(email);
    return NextResponse.json({ ok:true });
  }catch(e:any){
    const msg = e?.code === "P2002" ? "Already subscribed" : e?.message || "Failed";
    return NextResponse.json({ error: msg },{ status:400 });
  }
}
