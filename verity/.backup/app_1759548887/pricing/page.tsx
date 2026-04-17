export const revalidate = 60;
export default function Pricing() {
  return (
    <main className="min-h-screen bg-black text-zinc-200">
      <div className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="text-emerald-300 text-3xl font-semibold">Pricing</h1>
        <p className="mt-2 text-zinc-400">Start free. Pro adds alerts & bulk tracking.</p>
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-zinc-800 p-6">
            <h2 className="text-xl text-zinc-100">Free</h2>
            <p className="mt-1 text-sm text-zinc-400">Browse bills & MPs</p>
            <div className="mt-4 text-2xl text-emerald-300">$0</div>
          </div>
          <div className="rounded-2xl border border-emerald-900 p-6 ring-1 ring-emerald-800/40">
            <h2 className="text-xl text-zinc-100">Pro</h2>
            <p className="mt-1 text-sm text-zinc-400">Alerts, saved lists, exports</p>
            <div className="mt-4 text-2xl text-emerald-300">$9<span className="text-base text-zinc-400">/mo</span></div>
          </div>
        </div>
      </div>
    </main>
  );
}
