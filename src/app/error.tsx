'use client';

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html>
      <body className="mx-auto max-w-3xl px-6 py-10">
        <h1 className="text-2xl font-semibold mb-2">Something went wrong</h1>
        <p className="text-zinc-700 mb-4">{error.message || 'Unknown error.'}</p>
        <button onClick={reset} className="px-4 py-2 rounded bg-zinc-900 text-white">Try again</button>
      </body>
    </html>
  );
}
