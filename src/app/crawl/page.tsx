'use client';
import { useState } from 'react';

export default function Crawl() {
  const [url,setUrl]=useState(''); 
  const [name,setName]=useState(''); 
  const [jur,setJur]=useState('AU'); 
  const [msg,setMsg]=useState<string|null>(null);
  const [busy,setBusy]=useState(false);

  async function go(){
    setBusy(true); setMsg(null);
    try{
      const r = await fetch('/api/crawl', {
        method:'POST',
        headers:{'content-type':'application/json'},
        body: JSON.stringify({ url, name, jurisdiction: jur })
      });
      const j = await r.json();
      if(!r.ok) throw new Error(j.error || 'crawl failed');
      setMsg('Saved ✓');
    }catch(e:any){ setMsg(`Error: ${e.message||e}`); }
    setBusy(false);
  }

  return (
    <main className="max-w-xl mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Add Source</h1>
      <input className="border rounded-lg px-3 py-2 w-full" placeholder="Source Name (e.g., Parliament of Australia)" value={name} onChange={e=>setName(e.target.value)} />
      <input className="border rounded-lg px-3 py-2 w-full" placeholder="URL to crawl (https://…)" value={url} onChange={e=>setUrl(e.target.value)} />
      <input className="border rounded-lg px-3 py-2 w-full" placeholder="Jurisdiction (AU, NSW, FED…)" value={jur} onChange={e=>setJur(e.target.value)} />
      <button onClick={go} disabled={busy} className="px-4 py-2 bg-blue-600 text-white rounded-lg">{busy?'Crawling…':'Crawl'}</button>
      {msg && <div className="text-sm text-slate-600">{msg}</div>}
    </main>
  );
}
