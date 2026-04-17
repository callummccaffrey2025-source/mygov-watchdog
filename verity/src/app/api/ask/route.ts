import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { q } = (await req.json().catch(() => ({}))) as { q?: string };
    const query = (q ?? "").trim();
    if (!query) return NextResponse.json({ answer: "Please provide a question.", citations: [] }, { status: 400 });

    const sb = supabaseServer();
    const { data, error } = await sb
      .from("bill_sections_v1")
      .select("id,bill_id,heading,text")
      .textSearch("tsv", query, { type: "websearch" })
      .limit(6);

    if (error) {
      console.error("FTS error", error);
      return NextResponse.json({ answer: "Search error.", citations: [] }, { status: 500 });
    }

    const hits = (data ?? []) as { id: string; bill_id: string; heading: string | null; text: string | null }[];
    const context = hits.length
      ? hits.map((h, i) => {
          const head = h.heading ? `\n${h.heading}\n` : "\n";
          const body = h.text ?? "";
          return `[#${i + 1}] Bill ${h.bill_id}${head}${body}`;
        }).join("\n\n")
      : "(no context)";

    const key = process.env.OPENAI_API_KEY;
    if (!key) {
      const offline = [
        "Ask temporarily offline. Top matches:",
        ...hits.map((h, i) => `- [#${i + 1}] ${h.heading ?? "(no heading)"} (bill ${h.bill_id})`),
      ].join("\n");
      return NextResponse.json({ answer: offline, citations: hits.map((_, i) => `#${i + 1}`) });
    }

    const prompt = [
      "You are a civic Q&A assistant.",
      "Answer briefly using the provided bill sections as context.",
      "Cite snippets with [#n] where n is the index below.",
      "",
      "Context:",
      context,
      "",
      `Question: ${query}`,
      "Answer with a brief rationale and add citations like [#1][#3] at the end.",
    ].join("\n");

    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "gpt-4o-mini", temperature: 0.2, messages: [
        { role: "system", content: "You are helpful and concise." },
        { role: "user", content: prompt },
      ]}),
    });

    if (!resp.ok) {
      const msg = await resp.text().catch(() => "");
      console.error("OpenAI error", resp.status, msg);
      const offline = [
        "Ask temporarily offline. Top matches:",
        ...hits.map((h, i) => `- [#${i + 1}] ${h.heading ?? "(no heading)"} (bill ${h.bill_id})`),
      ].join("\n");
      return NextResponse.json({ answer: offline, citations: hits.map((_, i) => `#${i + 1}`) });
    }

    const json = (await resp.json()) as any;
    const answer = json?.choices?.[0]?.message?.content?.trim() || "No answer.";
    return NextResponse.json({ answer, citations: hits.map((_, i) => `#${i + 1}`) });
  } catch (e) {
    console.error("ask route error", e);
    return NextResponse.json({ answer: "Unexpected error.", citations: [] }, { status: 500 });
  }
}
