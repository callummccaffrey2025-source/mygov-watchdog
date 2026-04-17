"use client";

import { useEffect } from "react";

export default function BillError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("bill page error", error);
  }, [error]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-2xl font-semibold text-red-400">Unable to load bill</h1>
      <p className="max-w-md text-sm text-zinc-400">
        Something went wrong while fetching this bill. Please retry.
      </p>
      <button
        onClick={() => reset()}
        className="rounded bg-emerald-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-400"
        type="button"
      >
        Try again
      </button>
    </main>
  );
}
