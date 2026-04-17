export const runtime = "edge";
export async function POST(req: Request) {
  // Accept but do nothing; you can wire a real sink later.
  await req.json().catch(() => ({}));
  return new Response(null, { status: 202 });
}
