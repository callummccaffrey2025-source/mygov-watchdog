'use client';
import * as React from 'react';

export type RelatedSearchProps = {
  query?: string;
  className?: string;
  onSelect?: (term: string) => void;
};

const SUGGESTIONS = ['cost of living', 'privacy act', 'digital id', 'housing', 'immigration'];

export default function RelatedSearch({ query = '', className = '', onSelect }: RelatedSearchProps) {
  const items = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return SUGGESTIONS.filter(s => !q || s.includes(q)).slice(0, 5);
  }, [query]);

  return (
    <div className={`rounded-xl border border-white/10 bg-neutral-900/40 p-3 ${className}`}>
      <div className="text-sm text-neutral-100 mb-2">Related searches</div>
      <div className="flex flex-wrap gap-2">
        {items.map((s) => (
          <button
            key={s}
            onClick={() => onSelect?.(s)}
            className="text-xs rounded-full border border-white/15 px-2.5 py-1 hover:bg-white/10"
            type="button"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
