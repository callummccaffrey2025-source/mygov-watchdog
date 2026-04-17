"use client";
import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";

export default function PostcodeLookup() {
  const [pc, setPc] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  function isValidPostcode(v: string) {
    return /^[0-9]{4}$/.test(v.trim());
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!isValidPostcode(pc)) return;
    setLoading(true);
    router.push(`/mps?postcode=${encodeURIComponent(pc.trim())}`);
  }

  const disabled = !isValidPostcode(pc) || loading;

  return (
    <form onSubmit={onSubmit} className="flex items-center gap-2">
      <input
        value={pc}
        onChange={(e) => setPc(e.target.value)}
        inputMode="numeric"
        pattern="[0-9]*"
        maxLength={4}
        placeholder="Postcode"
        aria-label="Find your MP by postcode"
        className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-500 focus:border-zinc-700 focus:outline-none focus:ring-2 focus:ring-emerald-400/30"
      />
      <button
        type="submit"
        disabled={disabled}
        className={`rounded-xl px-4 py-2 text-sm ring-1 transition ${
          disabled
            ? "cursor-not-allowed text-zinc-600 ring-zinc-800"
            : "text-emerald-300 ring-emerald-700 hover:ring-emerald-600/40"
        }`}
        aria-label="Find your MP"
      >
        Find your MP
      </button>
    </form>
  );
}
