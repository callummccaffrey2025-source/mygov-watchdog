import Link from "next/link";
export default function NotFound() {
  return (
    <main className="mx-auto max-w-xl px-6 py-24 text-center">
      <h1 className="text-5xl font-extrabold">Page not found</h1>
      <p className="mt-3 text-neutral-400">We couldn’t find that page.</p>
      <div className="mt-6"><Link className="btn-primary" href="/">Back home</Link></div>
    </main>
  );
}
