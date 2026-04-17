import { NextResponse } from "next/server";
import { z } from "zod";

import { supabaseServer } from "@/lib/supabase/server";

const QuerySchema = z.object({
  q: z.string().trim().min(1, "Query is required").max(200),
});

const SearchResultSchema = z.object({
  id: z.string().uuid(),
  bill_id: z.string().uuid(),
  heading: z.string().nullable(),
  snippet: z.string(),
});

const ResponseSchema = z.object({
  results: z.array(SearchResultSchema),
});

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parseResult = QuerySchema.safeParse({
    q: url.searchParams.get("q") ?? "",
  });

  if (!parseResult.success) {
    return NextResponse.json(
      { error: "Query parameter 'q' is required." },
      { status: 400 }
    );
  }

  const q = parseResult.data.q.trim();

  if (q.length === 0) {
    return NextResponse.json({ results: [] });
  }

  const supabase = supabaseServer();
  const { data, error } = await supabase.rpc("search_bill_sections", {
    q,
    lim: 20,
  });

  if (error) {
    console.error("Failed to run search_bill_sections", error);
    return NextResponse.json(
      { error: "Unable to perform search." },
      { status: 500 }
    );
  }

  const payload = ResponseSchema.parse({
    results: data ?? [],
  });

  return NextResponse.json(payload);
}
