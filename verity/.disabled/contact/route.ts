export const runtime = "edge";
import { rateLimit } from "@/lib/limiter";

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for") || "local";
  if (!rateLimit(`contact:${ip}`).ok) return new Response("rate_limited", { status: 429 });

  const { name = "", email = "", message = "", website = "" } = await req.json().catch(() => ({}));
  if (website) return new Response("ok", { status: 202 }); // honeypot
  if (name.length < 2 || !email.includes("@") || message.length < 6) {
    return new Response(JSON.stringify({ error: "invalid" }), { status: 400 });
  }
  console.log("[CONTACT]", name, email, message.slice(0, 120));
  return new Response(null, { status: 202 });
}
