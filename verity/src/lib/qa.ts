// src/lib/qa.ts
import OpenAI from "openai";

export type Match = {
  id: string;
  score: number;          // vector score
  metadata: Record<string, unknown>;
};

export type Reranked = {
  i: number;              // original index in matches array
  rel: number;            // 0..1 relevance
};

const CHAT_MODEL = process.env.OPENAI_MODEL ?? "gpt-4o-mini";

/** Cheap LLM re-rank: returns topN with relevance score */
export async function rerankMatches(
  q: string,
  matches: Match[],
  topN = 5
): Promise<Reranked[]> {
  if (!matches.length) return [];

  const items = matches.map((m, i) => {
    const md = (m.metadata ?? {}) as Record<string, unknown>;
    return {
      i,
      title: (md["title"] as string) ?? "",
      url: (md["url"] as string) ?? "",
      text: (md["text"] as string) ?? "",
    };
  });

  const openai = new OpenAI();

  const prompt = `
Question: ${q}

Rate each passage's relevance 0..1 (1 = directly answers). Return JSON array of {"i": <index>, "rel": <0..1>} only.

Passages:
${items
  .map(
    (x) =>
      `P${x.i}: "${(x.title || x.url || "").slice(0, 120)}" — ${x.text.slice(
        0,
        1500
      )}`
  )
  .join("\n\n")}
`.trim();

  const resp = await openai.chat.completions.create({
    model: CHAT_MODEL,
    temperature: 0.2,
    messages: [
      { role: "system", content: "Return strict JSON. No commentary." },
      { role: "user", content: prompt },
    ],
  });

  let out: Reranked[] = [];
  try {
    out = JSON.parse(resp.choices[0]?.message?.content ?? "[]") as Reranked[];
  } catch {
    // if parsing fails, fall back to vector order with trivial scores
    out = matches.map((_, i) => ({ i, rel: 0.5 }));
  }

  return out
    .filter((r) => Number.isFinite(r.rel))
    .sort((a, b) => b.rel - a.rel)
    .slice(0, topN);
}
