import { admin } from '../../lib/server_supabase'

export default async function Bills(){
  const supa = admin()
  const { data } = await supa.from('bill_search').select('*').order('introduced_on', { ascending: false }).limit(100)
  return (
    <div>
      <h1 className="h1 mb-4">Bills</h1>
      <div className="grid md:grid-cols-2 gap-4">
        {(data || []).map((b:any)=>(
          <a key={b.id} href={`/bills/${b.id}`} className="card">
            <div className="h2 mb-1">{b.title}</div>
            <div className="text-slate-300 text-sm line-clamp-3">{b.summary}</div>
            <div className="mono mt-2">{b.status} • {b.introduced_on || '—'}</div>
          </a>
        ))}
      </div>
    </div>
  )
}

