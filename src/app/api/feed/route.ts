import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { supaAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const jurisdiction = searchParams.get('jurisdiction') || 'AU';
  const limit = Number(searchParams.get('limit') || '20');

  // TODO: When auth is wired, derive user_id from session & load profile/preferences here.
  const { data, error } = await supaAdmin
    .from('document')
    .select('id,title,url,jurisdiction,created_at')
    .eq('jurisdiction', jurisdiction)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Minimal map into cards. You can enrich with model scores later.
  const items = (data || []).map(d => ({
    id: d.id,
    title: d.title,
    url: d.url,
    jurisdiction: d.jurisdiction,
    created_at: d.created_at,
  }));

  return NextResponse.json({ items });
}
