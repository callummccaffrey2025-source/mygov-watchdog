"use client";

import { useMemo, useState } from "react";

type SectionSummary = {
  id: string;
  heading: string | null;
  text: string | null;
};

type BillSectionSearchProps = {
  sections: SectionSummary[];
};

export function BillSectionSearch({ sections }: BillSectionSearchProps) {
  const [query, setQuery] = useState("");

  const filteredCount = useMemo(() => {
    if (!query.trim()) {
      return sections.length;
    }
    const q = query.toLowerCase();
    return sections.filter((section) => {
      const heading = section.heading?.toLowerCase() ?? "";
      const text = section.text?.toLowerCase() ?? "";
      return heading.includes(q) || text.includes(q);
    }).length;
  }, [query, sections]);

  const helperText = query.trim().length
    ? filteredCount > 0
      ? `Showing ${filteredCount} matching section${filteredCount === 1 ? "" : "s"}`
      : "No matches"
    : `Filtering ${sections.length} section${sections.length === 1 ? "" : "s"}`;

  return (
    <section className="space-y-2">
      <input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search this bill…"
        className="w-full max-w-md rounded border border-zinc-700 bg-black px-3 py-2 text-sm text-white outline-none transition focus:border-emerald-400"
        aria-describedby="bill-search-helper"
      />
      <p id="bill-search-helper" className="text-xs text-zinc-500">
        {helperText}
      </p>
    </section>
  );
}
