import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const revalidate = 60;
export const runtime = 'nodejs';

function client(){
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE, { auth:{ persistSession:false }});
}

export async function GET(req){
  try{
    const url = new URL(req.url);
    const limit = Math.min(parseInt(url.searchParams.get('limit')||'20',10), 100);
    const cursor = url.searchParams.get('cursor');
    const chamber = url.searchParams.get('chamber');
    const status = url.searchParams.get('status');

    const supa = client();
    let q = supa.from('bills').select('*').order('last_movement_at', { ascending:false }).limit(limit);
    if (cursor) q = q.lt('last_movement_at', cursor);
    if (chamber) q = q.eq('chamber', chamber);
    if (status) q = q.ilike('status', `%${status}%`);

    const { data, error } = await q;
    if (error) throw new Error(error.message);

    const nextCursor = data?.length ? data[data.length-1].last_movement_at : null;
    return NextResponse.json({ items:data||[], nextCursor }, { status:200 });
  } catch(e){
    return NextResponse.json({ error: e.message }, { status:500 });
  }
}
