import { sbRest } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  const r = await sbRest(
    "bills_mv?select=id,title,chamber,stage,source_url,sections_count,updated_at&order=title.asc"
  );
  const data = await r.json();
  return Response.json(data);
}
