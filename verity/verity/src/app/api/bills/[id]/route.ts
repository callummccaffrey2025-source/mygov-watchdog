import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";

import { supabaseServer } from "@/lib/supabase/server";

const BillSchema = z.object({
  id: z.string().uuid(),
  title: z.string().nullable(),
  chamber: z.string().nullable(),
  stage: z.string().nullable(),
  source_url: z.string().nullable(),
  sections_count: z.number().int().nullable(),
});

const SectionSchema = z.object({
  id: z.string().uuid(),
  bill_id: z.string().uuid(),
  ord: z.number().int().nullable(),
  heading: z.string().nullable(),
  text: z.string().nullable(),
});

const BillDetailResponseSchema = z.object({
  bill: BillSchema,
  sections: z.array(SectionSchema),
});

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const supabase = supabaseServer();

  const [{ data: bill, error: billError }, { data: sections, error: sectionsError }] =
    await Promise.all([
      supabase
        .from("bills_mv")
        .select("id, title, chamber, stage, source_url, sections_count")
        .eq("id", id)
        .maybeSingle(),
      supabase
        .from("bill_sections_v1")
        .select("id, bill_id, ord, heading, text")
        .eq("bill_id", id)
        .order("ord", { ascending: true }),
    ]);

  if (billError) {
    console.error("Failed to load bill", billError);
    return NextResponse.json(
      { error: "Unable to load bill." },
      { status: 500 }
    );
  }

  if (!bill) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  if (sectionsError) {
    console.error("Failed to load sections", sectionsError);
    return NextResponse.json(
      { error: "Unable to load bill sections." },
      { status: 500 }
    );
  }

  const payload = BillDetailResponseSchema.parse({
    bill,
    sections: sections ?? [],
  });

  return NextResponse.json(payload);
}
