import fmt from "@/lib/format";
const { formatStage, formatIsoDate, fmtDate, formatDateAU } = fmt;
"use client";
import { formatDateAU } from "@/lib/format";
import type { MPNewsItem } from "@/types/mp";

export default function MPNewsList({ items, limit = 6 }: { items: MPNewsItem[]; limit?: number }) {
  if (!items?.length) return <p className="text-white/60">No recent news found.</p>;

  const slice = items.slice(0, limit);

  return (
    <div className="space-y-3">
      <ul className="space-y-3">
        {slice.map((n) => (
          <li key={n.id} className="rounded-lg border border-white/10 p-3">
            <a href={n.url} target="_blank" rel="noopener noreferrer" className="block">
              <div className="flex items-center justify-between gap-3">
                <h4 className="line-clamp-2 text-sm font-medium">{n.title}</h4>
                <span className="shrink-0 text-xs text-white/60">{formatDateAU(n.published_at)}</span>
              </div>
              {!!n.source && <p className="mt-1 text-xs text-white/50">{n.source}</p>}
            </a>
          </li>
        ))}
      </ul>

      {/* view-all link */}
      <div className="text-right">
        <a
          href="./news"
          className="text-sm underline decoration-white/20 underline-offset-2 hover:decoration-white"
        >
          View all news
        </a>
      </div>
    </div>
  );
}
