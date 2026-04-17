export default function NotFound() {
  return (
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="text-2xl font-semibold text-neutral-100">Page not found</h1>
      <p className="mt-2 text-neutral-400">The page you’re after isn’t here.</p>
      <div className="mt-5 flex gap-3">
        <a href="/" className="rounded-lg border border-neutral-800 bg-neutral-950 px-4 py-2 text-neutral-200 hover:bg-neutral-900">Home</a>
        <a href="/bills" className="rounded-lg border border-neutral-800 bg-neutral-950 px-4 py-2 text-neutral-200 hover:bg-neutral-900">Browse bills</a>
        <a href="/signup" className="rounded-lg border border-neutral-700 bg-neutral-100 px-4 py-2 text-neutral-900 hover:bg-white">Start free</a>
      </div>
    </main>
  );
}
