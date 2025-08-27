import { admin } from '../../../lib/server_supabase'
import Link from 'next/link'

export default async function BillDetail({ params }: { params: { id: string } }){
  const supa = admin()
  const { data: bill } = await supa.from('bills').select('*').eq('id', params.id).single()
  if(!bill) return <div className="p-6">Not found</div>
  return (
    <div className="space-y-4">
      <Link href="/bills" className="text-sm text-slate-400">← Back to bills</Link>
      <h1 className="h1">{bill.title}</h1>
      <div className="mono">Status: {bill.status || '—'} • Introduced: {bill.introduced_on || '—'}</div>
      <div className="card whitespace-pre-wrap">{bill.summary || 'No summary yet.'}</div>
      {bill.url && <a href={bill.url} target="_blank" className="text-blue-400 underline">Source</a>}
    </div>
  )
}

