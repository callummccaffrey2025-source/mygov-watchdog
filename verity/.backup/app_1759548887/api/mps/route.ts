import { NextResponse } from "next/server";
import { MPS } from "@/app/_mock/mps";
export const dynamic = "force-dynamic";
export async function GET(){ return NextResponse.json({ items: MPS, count: MPS.length }); }
