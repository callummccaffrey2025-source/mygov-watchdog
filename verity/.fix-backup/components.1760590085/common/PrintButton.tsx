"use client";

export default function PrintButton() {
  return (
    <div className="flex justify-end">
      <button
        type="button"
        onClick={() => window.print()}
        className="rounded-lg bg-white/10 px-3 py-2 text-sm hover:bg-white/15"
      >
        Print
      </button>
    </div>
  );
}
