'use client';
export default function StickyCTA() {
  return (
    <div className="fixed bottom-5 right-5 z-50 flex gap-2">
      <a
        href="/join"
        className="rounded-xl border border-emerald-700/40 bg-emerald-600/10 px-4 py-2 text-sm text-emerald-400 hover:bg-emerald-600/20"
      >
        Join $1
      </a>
      <a
        href="/features"
        className="rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2 text-sm text-neutral-100 hover:bg-zinc-800"
      >
        See features
      </a>
    </div>
  );
}
