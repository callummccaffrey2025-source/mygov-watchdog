import type { NewsItem } from "@/types";
export default function NewsCard({ item }:{ item: NewsItem }) {
  return (
    <a className="block rounded-xl border border-white/10 p-4 hover:border-emerald-400/40" href={item.url ?? "#"} target="_blank" rel="noreferrer">
      <div className="font-medium">{item.title}</div>
      {!!item.date && <div className="text-xs text-neutral-400">{item.date}</div>}
    </a>
  );
}
