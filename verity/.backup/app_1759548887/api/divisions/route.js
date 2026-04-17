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
    const billId = url.searchParams.get('billId');
    const since = url.searchParams.get('since');  // ISO

    const supa = client();
    let q = supa.from('divisions').select('*').order('occurred_at', { ascending:false }).limit(limit);
    if (billId) q = q.eq('bill_id', billId);
    if (since) q = q.gte('occurred_at', since);

    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return NextResponse.json({ items:data||[] }, { status:200 });
  } catch(e){
    return NextResponse.json({ error:e.message }, { status:500 });
  }
}
