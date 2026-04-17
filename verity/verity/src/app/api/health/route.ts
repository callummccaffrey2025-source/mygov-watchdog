export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({
    ok: true,
    supabaseUrlConfigured: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    anonConfigured: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    timestamp: new Date().toISOString(),
  });
}
