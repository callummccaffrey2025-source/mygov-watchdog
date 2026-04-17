export const runtime = "edge";
export function GET() {
  const txt = [
    "Contact: mailto:security@verity.run",
    "Expires: 2030-01-01T00:00:00.000Z",
    "Preferred-Languages: en",
  ].join("\n");
  return new Response(txt, { headers: { "content-type": "text/plain" } });
}
