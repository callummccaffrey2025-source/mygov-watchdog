export async function POST(req: Request) {
  const { caseId, regulator } = await req.json().catch(() => ({}));
  if (!caseId || !regulator) return new Response(JSON.stringify({ error: "caseId & regulator required" }), { status: 400 });
  return new Response(new Uint8Array(), { headers: { "Content-Type": "application/pdf" }});
}
