"use client";
export default function ClientPrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="rounded-lg bg-white/10 px-3 py-2 text-sm hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500"
    >
      Print
    </button>
  );
}
