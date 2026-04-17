import { NextResponse } from "next/server";
export async function POST(req:Request){ try{ const { email } = await req.json(); if(!email || typeof email!=="string" || !email.includes("@")) return NextResponse.json({ok:false,error:"invalid"}, {status:400});
  console.log("WAITLIST", { email, ts: Date.now() }); return NextResponse.json({ok:true}); }
  catch{ return NextResponse.json({ok:false,error:"bad request"},{status:400}); } }
