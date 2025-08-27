import { NextRequest, NextResponse } from 'next/server'
import { admin } from '../../../lib/server_supabase'
import { summarise } from '../../../lib/ai'

// Sample loader (replace with real adapters later)
async function fetchSample(){
  const base = (process.env.APP_BASE_URL || 'http://localhost:3000').replace(/\/$/, '')
  const r = await fetch(`${base}/sample/bills_sample.json`)
  return (await r.json()) as any[]
}

export async function GET(_req: NextRequest){
  const supa = admin()
  const items = await fetchSample()

  for (const it of items){
    const { data: existing } = await supa
      .from('bills')
      .select('id')
      .eq('external_id', it.external_id)
      .maybeSingle()

    const { summary } = await summarise(it.full_text || it.title)

    if (!existing){
      const { error } = await supa.from('bills').insert({
        source: 'sample',
        external_id: it.external_id,
        title: it.title,
        url: it.url,
        status: it.status,
        introduced_on: it.introduced_on,
        summary
      })
      if (error) throw error
    } else {
      await supa.from('bills').update({ summary }).eq('id', existing.id)
      await supa.from('change_log').insert({
        bill_id: existing.id,
        change_summary: 'Auto re-summary on ingest'
      })
    }
  }

  return NextResponse.json({ ok: true, count: items.length })
}

