"use client";
import { track } from "@/lib/analytics";

export default function PrintButton() {
  return (
    <button
      onClick={() => { try { track?.("print_mp"); } catch {} window.print(); }}
      className="rounded-lg bg-white/10 px-3 py-2 text-sm hover:bg-white/15"
    >
      Print
    </button>
  );
}
