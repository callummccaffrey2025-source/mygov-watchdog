'use client';
import { useState } from 'react';

export default function Ask() {
  const [q,setQ]=useState('');
  const [jur,setJur]=useState('');
  const [a,setA]=useState('');
  const [L,setL]=useState(false);

  async function ask(){
    setL(true); setA('');
    const res = await fetch('/api/ask',{
      method:'POST',
      headers:{'content-type':'application/json'},
      body: JSON.stringify({ question:q, ...(jur?{jurisdiction:jur}:{}) })
    });
    const j = await res.json();
    setA(j.answer || JSON.stringify(j));
    setL(false);
  }

  return (
    <main className="max-w-2xl mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Ask Verity</h1>
      <textarea className="border rounded-lg px-3 py-2 w-full h-28" placeholder="What changed in the Safeguard Mechanism reforms?" value={q} onChange={e=>setQ(e.target.value)} />
      <input className="border rounded-lg px-3 py-2 w-60" placeholder="jurisdiction (optional)" value={jur} onChange={e=>setJur(e.target.value)} />
      <div>
        <button onClick={ask} className="px-4 py-2 bg-blue-600 text-white rounded-lg">{L?'Thinking…':'Ask'}</button>
      </div>
      {a && <div className="rounded-lg border bg-white p-4 whitespace-pre-wrap">{a}</div>}
    </main>
  );
}
