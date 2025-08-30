export const dynamic = 'force-dynamic';
import { NextResponse } from "next/server";
import OpenAI from "openai";
import { supabaseAdmin as db } from "@/lib/supabaseAdmin";
const oai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

export async function POST(req: Request){
  const { question, jurisdiction } = await req.json();
  if(!question) return NextResponse.json({ error:"question required" }, { status:400 });

  // Fallback: simple text search while Pinecone wiring is finished
  const { data: hits } = await db.rpc("websearch", { q: question, lim: 5 }).catch(async() => {
    return await db.from("document")
      .select("id,title,url,content,published_at")
      .ilike("content", `%${question.split(" ").slice(0,3).join("%")}%`)
      .limit(5);
  });

  const context = (hits||[]).map((h:any)=>`- ${h.title} (${h.url})`).join("\n");
  const resp = await oai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role:"system", content:"Answer with facts using the provided context."},
               { role:"user", content:`Q: ${question}\nContext:\n${context}`}],
  });
  return NextResponse.json({ ok:true, answer: resp.choices[0].message?.content, sources: hits });
}
