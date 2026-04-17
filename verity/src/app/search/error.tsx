'use client';
import { useEffect } from 'react';

export default function ErrorBoundary({ error, reset }:{ error: unknown; reset: ()=>void }){
  useEffect(()=>{ console.error(error); },[error]);
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Something went wrong</h1>
      <p className="mt-2 text-sm text-zinc-400">If this keeps happening, please try again later.</p>
      <div className="mt-4 flex gap-2">
        <button onClick={()=>reset()} className="rounded-2xl border border-zinc-800 px-3 py-1.5 hover:border-zinc-700">Try again</button>
        <a href="/" className="rounded-2xl border border-zinc-800 px-3 py-1.5 hover:border-zinc-700">Go home</a>
      </div>
    </main>
  );
}
