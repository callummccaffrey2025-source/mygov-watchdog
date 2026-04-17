import { db, Source } from "./db";

const tokenize = (q: string) =>
  q.toLowerCase().split(/\W+/).filter(Boolean);

const scoreText = (text: string, terms: string[]) => {
  const t = text.toLowerCase();
  return terms.reduce((s, term) => s + (t.match(new RegExp(`\\b${term}\\b`, "g"))?.length ?? 0), 0);
};

const makeSnippet = (text: string, term: string) => {
  if (!term) return (text ?? "").slice(0, 160) + "…";
  const i = text.toLowerCase().indexOf(term.toLowerCase());
  const start = Math.max(0, i - 80);
  const end = Math.min(text.length, i + 120);
  return (start ? "…" : "") + text.slice(start, end) + "…";
};

export type Hit = {
  sourceId: string;
  title: string;
  url: string;
  date: string;
  snippet: string;
  score: number;
};

export function search(q: string): Hit[] {
  const terms = tokenize(q);
  if (!terms.length) return [];
  const items = db.sources().map((s: Source) => {
    const score = scoreText(s.title, terms) * 4 + scoreText(s.text, terms);
    return {
      sourceId: s.id,
      title: s.title,
      url: s.url,
      date: s.date,
      snippet: makeSnippet(s.text, terms[0]),
      score
    };
  });
  return items.filter((h: { score: number; }) => h.score > 0).sort((a: { score: number; }, b: { score: number; }) => b.score - a.score).slice(0, 20);
}

export function citationsFor(q: string, n = 3) {
  return search(q).slice(0, n).map((h, i) => ({
    n: i + 1,
    sourceId: h.sourceId,
    url: h.url,
    title: h.title,
    snippet: h.snippet
  }));
}
