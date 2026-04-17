export const runtime = "edge";
import { rateLimit } from "@/lib/limiter";

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for") || "local";
  if (!rateLimit(`diffsub:${ip}`).ok) return new Response("rate_limited", { status: 429 });
  const { email = "", topic = "", website = "" } = await req.json().catch(() => ({}));
  if (website) return new Response("ok", { status: 202 }); // honeypot
  if (!email.includes("@") || topic.length < 2) return new Response(JSON.stringify({ error: "invalid" }), { status: 400 });
  console.log("[DIFF_SUB]", email, topic);
  return new Response(null, { status: 202 });
}
