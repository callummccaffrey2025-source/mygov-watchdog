import { NextResponse } from 'next/server'
import { admin } from '../../../lib/server_supabase'

export async function POST(){
  const supa = admin()
  const { data: bills } = await supa.from('bills').select('id, summary')
  return NextResponse.json({ ok: true, count: bills?.length || 0 })
}
