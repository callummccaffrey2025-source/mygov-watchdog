export const dynamic = "force-dynamic";
export async function GET() {
  return new Response(JSON.stringify({ ok:true, who:"static api child ✅" }), {
    headers: { "content-type": "application/json" }
  });
}
