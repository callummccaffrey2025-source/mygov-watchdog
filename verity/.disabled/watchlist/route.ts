export const runtime = "edge";
import { rateLimit } from "@/lib/limiter";
let MEMORY: { topic: string }[] = [];

export async function GET() {
  return Response.json(MEMORY, { headers: { "cache-control": "no-store" } });
}

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for") || "local";
  if (!rateLimit(`watch:${ip}`).ok) return new Response("rate_limited", { status: 429 });
  const { topic = "", website = "" } = await req.json().catch(() => ({}));
  if (website) return new Response("ok", { status: 202 });
  if (topic.length < 2) return new Response(JSON.stringify({ error: "invalid" }), { status: 400 });
  if (!MEMORY.find(t => t.topic === topic)) MEMORY.push({ topic });
  return new Response(null, { status: 202 });
}

export async function DELETE(req: Request) {
  const { topic = "" } = await req.json().catch(() => ({}));
  MEMORY = MEMORY.filter(t => t.topic !== topic);
  return new Response(null, { status: 202 });
}
