import { getSupabase } from '@/lib/supabase';
export async function GET() {
  try {
    const sb = getSupabase();
    if (!sb) return Response.json({ items: [], note: 'no-supabase-env' });
    const { data, error } = await sb.from('mps')
      .select('id,name,party,electorate')
      .order('name')
      .limit(2000);
    if (error) return Response.json({ items: [], error: error.message });
    return Response.json({ items: data ?? [] });
  } catch (e:any) {
    return Response.json({ items: [], error: String(e?.message||e) });
  }
}
