export const runtime = "edge";

type Payload = { email: string; name?: string };

function validEmail(e: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Payload;
  if (!body?.email || !validEmail(body.email)) {
    return new Response(JSON.stringify({ ok: false, error: "invalid_email" }), { status: 400 });
  }

  // Optional: send to Slack if env is set
  const hook = process.env.SLACK_WEBHOOK_URL;
  if (hook) {
    await fetch(hook, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        text: `📝 Verity waitlist: ${body.email}${body.name ? ` (${body.name})` : ""}`,
      }),
    }).catch(() => {});
  }

  // TODO later: persist in DB/CRM (Vercel KV/Postgres, Loops/Mailchimp, etc.)
  return Response.json({ ok: true });
}
