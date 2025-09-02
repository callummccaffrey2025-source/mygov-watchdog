export default function Page() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-20">
      <h1 className="text-4xl md:text-6xl font-semibold tracking-tight">AI-powered political watchdog for Australia.</h1>
      <p className="mt-6 text-lg md:text-xl opacity-80">Apple-clean UI. Everything works day one.</p>
      <div className="mt-8 flex gap-3">
        <a className="rounded-lg border px-4 py-2" href="/open">Open App</a>
        <a className="underline" href="/join">Join waitlist</a>
      </div>
      <div className="mt-16 grid md:grid-cols-3 gap-6">
        <div className="rounded-2xl border p-6"><div className="font-medium">Ask</div><p className="opacity-80 mt-2">Ask any political question about Australia; get sources.</p></div>
        <div className="rounded-2xl border p-6"><div className="font-medium">Search</div><p className="opacity-80 mt-2">Semantic search across bills, votes, speeches.</p></div>
        <div className="rounded-2xl border p-6"><div className="font-medium">Track</div><p className="opacity-80 mt-2">Follow politicians, bills, and receive updates.</p></div>
      </div>
    </section>
  );
}
