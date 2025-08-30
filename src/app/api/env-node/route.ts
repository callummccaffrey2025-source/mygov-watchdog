export const dynamic = 'force-dynamic';
import { NextResponse } from "next/server";
export const runtime = "nodejs";
export function GET() {
  const allow = process.env.VERITY_ALLOWED_HOSTS || "";
  return NextResponse.json({
    NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    PINECONE_API_KEY: !!process.env.PINECONE_API_KEY,
    PINECONE_INDEX: process.env.PINECONE_INDEX || null,
    OPENAI_API_KEY: !!process.env.OPENAI_API_KEY,
    VERITY_ALLOWED_HOSTS: allow,
    VERITY_ALLOWED_HOSTS_SIZE: allow.split(",").map(s=>s.trim()).filter(Boolean).length,
  });
}