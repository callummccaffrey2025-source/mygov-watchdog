export const dynamic = 'force-dynamic';
// src/app/api/source/[id]/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// IMPORTANT: don't type the 2nd arg; Next.js 15 validates its shape.
export async function DELETE(_req: Request, context: any) {
  try {
    const id = context?.params?.id as string | undefined;
    if (!id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }

    const { error } = await supabaseAdmin.from("source").delete().eq("id", id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Unexpected error" }, { status: 500 });
  }
}
