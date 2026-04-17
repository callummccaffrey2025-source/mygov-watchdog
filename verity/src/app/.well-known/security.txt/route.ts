export const runtime = "edge";
export async function GET() {
  const body = [
    "Contact: mailto:security@verity.run",
    "Contact: https://verity.run/contact",
    "Policy: https://verity.run/trust",
    "Preferred-Languages: en",
  ].join("\n") + "\n";
  return new Response(body, { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=86400" } });
}
