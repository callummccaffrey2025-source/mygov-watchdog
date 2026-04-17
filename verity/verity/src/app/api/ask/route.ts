export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as { q?: unknown };
    const q = typeof body.q === "string" ? body.q.trim() : "";
    const answer = q
      ? `Stub: I would search bills and sections for "${q}".`
      : "Stub: Ask about a bill, MP, or topic.";
    return Response.json({ answer });
  } catch (err) {
    console.error("ask endpoint error", err);
    return new Response("Search error.", { status: 500 });
  }
}
