'use client';
export default function GlobalError({ error }:{ error: Error & { digest?: string } }) {
  console.error(error);
  return (
    <html>
      <body>
        <main className="mx-auto max-w-3xl px-4 py-16">
          <h1 className="text-2xl font-semibold">App failed to start</h1>
          <p className="mt-2 text-sm text-zinc-400">Please refresh. {error?.digest ? `Error ID: ${error.digest}` : ''}</p>
        </main>
      </body>
    </html>
  );
}
