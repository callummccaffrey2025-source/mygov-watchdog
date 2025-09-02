import { NextResponse } from "next/server";
import OpenAI from "openai";

export async function POST(req: Request) {
  try {
    const { q } = await req.json();
    if (!q || typeof q !== "string" || !q.trim()) {
      return NextResponse.json({ error: "Provide q:string" }, { status: 400 });
    }
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
    const r = await client.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.3,
      messages: [
        { role: "system", content: "You are Verity, an Australian political watchdog. Be concise and neutral. If unsure, say so." },
        { role: "user", content: q }
      ],
      max_tokens: 320
    });
    const answer = r.choices?.[0]?.message?.content?.trim() ?? "";
    return NextResponse.json({ answer });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Ask failed" }, { status: 500 });
  }
}
