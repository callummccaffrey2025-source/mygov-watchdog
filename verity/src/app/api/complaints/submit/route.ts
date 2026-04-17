export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  if (!body?.title || !body?.description) {
    return new Response(JSON.stringify({ error: "title and description required" }), { status: 400 });
  }
  return new Response(JSON.stringify({ ok: true, id: "demo-id" }), { headers: { "Content-Type": "application/json" }});
}
