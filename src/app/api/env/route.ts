export const dynamic = 'force-dynamic';
import { NextResponse } from "next/server";
export const runtime = "edge";
export function GET() {
  return NextResponse.json({
    NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    PINECONE_API_KEY: !!process.env.PINECONE_API_KEY,
    PINECONE_INDEX: process.env.PINECONE_INDEX || null,
    OPENAI_API_KEY: !!process.env.OPENAI_API_KEY,
  });
}