
export default function Home(){
  return (
    <main className="mx-auto max-w-3xl p-8 space-y-6">
      <h1 className="text-4xl font-semibold tracking-tight">Verity</h1>
      <p className="text-lg opacity-80">AI-powered political watchdog for Australia. Apple-clean UI. Everything works day one.</p>
      <div className="flex gap-3">
        <a className="border rounded-lg px-4 py-2" href="/ask">Ask</a>
        <a className="border rounded-lg px-4 py-2" href="/search">Search</a>
      </div>
    </main>
  );
}
