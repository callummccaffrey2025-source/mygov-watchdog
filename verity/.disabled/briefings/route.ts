import { NextResponse } from "next/server";
import { getBriefing } from "@/lib/briefings";
export async function GET(){ 
  const data = await getBriefing(); 
  return NextResponse.json(data);
}
