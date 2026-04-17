"use client";
export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto max-w-xl px-6 py-24 text-center">
      <h1 className="text-3xl font-semibold">Something went wrong</h1>
      <p className="mt-2 text-neutral-400">{error.message}</p>
      <button className="btn-ghost mt-6" onClick={() => reset()}>Try again</button>
    </main>
  );
}
