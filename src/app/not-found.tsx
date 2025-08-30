import Link from "next/link";

export const metadata = {
  title: "Page not found — Verity",
  description: "The page you requested does not exist.",
};

export default function NotFound() {
  return (
    <main className="mx-auto max-w-3xl p-10 text-center space-y-6">
      <h1 className="text-3xl font-bold">Page not found</h1>
      <p className="text-zinc-600">Try one of these common pages:</p>
      <div className="mt-2 flex flex-wrap justify-center gap-3">
        <Link href="/search" className="px-4 py-2 rounded bg-zinc-900 text-white">Search</Link>
        <Link href="/ask" className="px-4 py-2 rounded border">Ask AI</Link>
        <Link href="/crawl" className="px-4 py-2 rounded border">Add Sources</Link>
        <Link href="/sources" className="px-4 py-2 rounded border">Sources</Link>
        <Link href="/" className="px-4 py-2 rounded border">Home</Link>
      </div>
    </main>
  );
}
