import { allKeys, createKey, revokeKey } from "@/lib/keys-store";

export async function GET() {
  return Response.json(allKeys(), { headers: { "cache-control": "no-store" } });
}

export async function POST(req: Request) {
  const { label = "" } = await req.json().catch(()=>({}));
  const k = createKey(label);
  return Response.json(k, { status: 201, headers: { "cache-control": "no-store" } });
}

export async function DELETE(req: Request) {
  const { id = "" } = await req.json().catch(()=>({}));
  if (!id) return new Response("bad_request", { status: 400 });
  revokeKey(id);
  return new Response(null, { status: 204 });
}
