import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const { q } = await req.json().catch(() => ({ q: "" }));
  const query = String(q || "").trim();

  if (!query || query.split(/\s+/).length < 3) {
    return NextResponse.json({
      type: "clarify",
      answer: "Which budget do you mean? Try one of these:",
      clarify: [
        { text: "Federal Budget 2024–25", append: " federal budget 2024–25" },
        { text: "NSW State Budget 2024–25", append: " NSW state budget 2024–25" },
        { text: "Program-specific budget (name it)", append: " program budget <program name>" }
      ]
    });
  }

  // Later: call LLM + citations. Deterministic placeholder for now.
  return NextResponse.json({
    type: "answer",
    answer: "Demo answer. Specify year/jurisdiction for precise figures.",
    citations: []
  });
}
