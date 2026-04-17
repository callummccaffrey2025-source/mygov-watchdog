export const dynamic = "force-static";
export const metadata = { title: "System Status • Verity" };
export default function StatusPage(){
  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-3xl font-semibold mb-2">System Status</h1>
      <p className="text-sm text-neutral-400 mb-6">Everything operational (mock status).</p>
      <div className="rounded-xl border border-white/10 p-4">
        <div className="font-medium">Core Services</div>
        <ul className="mt-2 text-sm text-neutral-300 space-y-1">
          <li>• Web app — <span className="text-emerald-400">OK</span></li>
          <li>• API — <span className="text-emerald-400">OK</span></li>
          <li>• Ingestion — <span className="text-emerald-400">OK</span></li>
          <li>• Email — <span className="text-emerald-400">OK</span></li>
        </ul>
      </div>
    </main>
  );
}
