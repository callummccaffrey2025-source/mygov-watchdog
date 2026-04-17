import { NextResponse } from "next/server";
export async function POST(req:Request){
  const { persona } = await req.json().catch(()=>({}));
  if(!["citizen","power","journalist"].includes(persona)) return NextResponse.json({ok:false,error:"invalid persona"},{status:400});
  const res=NextResponse.json({ok:true,persona}); res.cookies.set("v_persona",persona,{path:"/",httpOnly:false,sameSite:"lax",maxAge:60*60*24*365}); return res;
}
