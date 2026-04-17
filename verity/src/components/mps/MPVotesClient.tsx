"use client";
import { useState } from "react";
import MPVotesTable from "./MPVotesTable";

export default function MPVotesClient({ votes }: { votes: any[] }) {
  const STEP = 10;
  const [count, setCount] = useState(Math.min(STEP, votes.length));
  const visible = votes.slice(0, count);
  return (
    <div className="space-y-3">
      <MPVotesTable votes={visible} />
      {count < votes.length ? (
        <div className="flex justify-center">
          <button
            onClick={() => setCount((c) => Math.min(c + STEP, votes.length))}
            className="rounded-lg bg-white/10 px-3 py-2 text-sm hover:bg-white/15"
          >
            Load more
          </button>
        </div>
      ) : null}
    </div>
  );
}
