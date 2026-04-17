export const runtime = "edge";
type Event = { name: string; props?: Record<string, unknown>; ts?: number };

export async function POST(req: Request) {
  const { name, props, ts } = await req.json().catch(() => ({})) as Event;
  if (!name) return new Response("bad_request", { status: 400 });
  // In prod: write to durable store/log. Here we just log.
  console.log("[ANALYTICS]", name, ts || Date.now(), props || {});
  return new Response(null, { status: 204, headers: { "cache-control": "no-store" } });
}
