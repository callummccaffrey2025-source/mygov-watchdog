import { getSupabase } from '@/lib/supabase';
export async function GET() {
  try {
    const sb = getSupabase();
    if (!sb) return Response.json({ items: [], note: 'no-supabase-env' });
    const { data, error } = await sb.from('bills')
      .select('id,title,status,updated_at')
      .order('updated_at', { ascending:false })
      .limit(200);
    if (error) return Response.json({ items: [], error: error.message });
    return Response.json({ items: data ?? [] });
  } catch (e:any) {
    return Response.json({ items: [], error: String(e?.message||e) });
  }
}
