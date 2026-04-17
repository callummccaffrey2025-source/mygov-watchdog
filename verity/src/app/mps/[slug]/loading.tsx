export default function Loading() {
  return (
    <main className="mx-auto w-full max-w-4xl space-y-6 px-3 py-6">
      <section className="card p-4 animate-pulse space-y-3">
        <div className="h-6 w-48 rounded bg-white/10" />
        <div className="h-4 w-full rounded bg-white/10" />
        <div className="h-4 w-2/3 rounded bg-white/10" />
      </section>
      <div className="grid gap-4 md:grid-cols-2">
        <section className="card h-48 animate-pulse" />
        <section className="card h-48 animate-pulse" />
      </div>
    </main>
  );
}
