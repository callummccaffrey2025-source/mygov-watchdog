export const revalidate = 0;

export async function GET() {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  if (!base || !anon) {
    return Response.json({ ok: false, error: "Missing Supabase envs" }, { status: 500 });
  }
  const headers = { apikey: anon, Authorization: `Bearer ${anon}`, Prefer: "count=exact" as const };

  async function count(path: string) {
    const res = await fetch(`${base}/rest/v1/${path}?select=id&limit=1`, { headers, cache: "no-store" });
    if (!res.ok) return 0;
    const cr = res.headers.get("content-range");
    return cr && cr.includes("/") ? Number(cr.split("/")[1]) : 0;
  }

  const [bills, mps] = await Promise.all([count("bills"), count("mps")]);
  return Response.json({ ok: true, bills, mps });
}
