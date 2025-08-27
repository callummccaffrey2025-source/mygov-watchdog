import { NextRequest, NextResponse } from 'next/server'
import { admin } from '../../../lib/server_supabase'

export async function GET(req: NextRequest){
  const q = new URL(req.url).searchParams.get('q')?.trim() || ''
  const supa = admin()
  if(!q){
    const { data } = await supa.from('bill_search')
      .select('*')
      .order('introduced_on', { ascending: false })
      .limit(20)
    return NextResponse.json({ results: data || [] })
  }
  const { data } = await supa.from('bill_search')
    .select('*')
    .ilike('title', `%${q}%`)
    .limit(50)
  return NextResponse.json({ results: data || [] })
}
