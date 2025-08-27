// web/app/api/crawl/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const Body = z.object({
  name: z.string().min(1, "name is required"),
  url: z.string().url("url must be a valid URL"),
  jurisdiction: z.string().min(2).max(8, "jurisdiction length invalid"),
  type: z.string().optional().default("generic"),
});

// ✅ Only allow these jurisdiction codes
const ALLOWED = new Set(["AU", "ACT", "NSW", "NT", "QLD", "SA", "TAS", "VIC", "WA"]);

export async function POST(req: Request) {
  try {
    // 1) Parse & validate with Zod
    const json = await req.json();
    const { name, url, jurisdiction, type } = Body.parse(json);

    // 2) Normalize jurisdiction (trim + uppercase)
    const j = String(jurisdiction).trim().toUpperCase();

    // 3) Enforce allowlist
    if (!ALLOWED.has(j)) {
      return NextResponse.json(
        { error: `jurisdiction must be one of: ${[...ALLOWED].join(", ")}` },
        { status: 400 }
      );
    }

    // 4) Upsert using normalized value
    const { data, error } = await supabaseAdmin
      .from("source")
      .upsert({ name, url, jurisdiction: j, type }, { onConflict: "url" })
      .select("id, name, url, jurisdiction, type")
      .single();

    if (error || !data) {
      console.error("UPSERT source failed:", error);
      return NextResponse.json(
        { error: error?.message || "Insert/Upsert failed" },
        { status: 400 }
      );
    }

    // ✅ Return the saved/updated row
    return NextResponse.json({ id: data.id, source: data });
  } catch (err: any) {
    const message =
      err?.issues?.[0]?.message ||
      err?.message ||
      "Unexpected error";
    console.error("API /api/crawl POST error:", err);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
