export const runtime = "edge";
export async function GET() {
  const before = "The bill proposes a penalty of $2,000 for data breaches and requires annual audits.";
  const after  = "The bill proposes a penalty of $5,000 for serious data breaches and requires annual independent audits.";
  return Response.json({ before, after }, { headers: { "cache-control": "no-store" } });
}
