"use client";
export default function GlobalError({ error }: { error: Error }) {
  console.error(error);
  return (
    <main className="min-h-screen bg-black text-zinc-200">
      <div className="mx-auto max-w-3xl px-6 py-24 text-center">
        <h1 className="text-3xl font-semibold text-emerald-300">Something went wrong</h1>
        <p className="mt-2 text-zinc-400">Please try again.</p>
      </div>
    </main>
  );
}
