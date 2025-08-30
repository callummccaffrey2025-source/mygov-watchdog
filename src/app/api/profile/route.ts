import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supaAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// TEMP: accept an "x-user-id" header until you wire real auth/session.
function getUserId(req: NextRequest): string | null {
  return req.headers.get('x-user-id');
}

const ProfileSchema = z.object({
  jurisdiction: z.string().min(2).max(8).default('AU'),
  electorate: z.string().optional().nullable(),
  interests: z.array(z.string()).default([]),
  parties: z.array(z.string()).default([]),
  email_opt_in: z.boolean().default(true),
});

export async function GET(req: NextRequest) {
  const user_id = getUserId(req);
  if (!user_id) return NextResponse.json({ error: 'Missing user' }, { status: 401 });

  const { data, error } = await supaAdmin
    .from('user_profile')
    .select('*')
    .eq('user_id', user_id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(
    data ?? { user_id, jurisdiction: 'AU', interests: [], parties: [], email_opt_in: true }
  );
}

export async function PUT(req: NextRequest) {
  const user_id = getUserId(req);
  if (!user_id) return NextResponse.json({ error: 'Missing user' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const parsed = ProfileSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const upsert = { user_id, ...parsed.data };
  const { data, error } = await supaAdmin
    .from('user_profile')
    .upsert(upsert, { onConflict: 'user_id' })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
