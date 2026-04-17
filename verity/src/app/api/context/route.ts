import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

export async function POST(req: NextRequest){
  const { text } = await req.json();
  if(!text) return NextResponse.json({ error:'missing text' }, { status:400 });

  const OPENAI_API_KEY: string = process.env.OPENAI_API_KEY ?? "";
  if(!OPENAI_API_KEY) return NextResponse.json({ error:'missing OPENAI_API_KEY' }, { status:500 });

  // minimal call (streaming omitted for brevity)
  const r = await fetch('https://api.openai.com/v1/chat/completions',{
    method:'POST',
    headers:{ 'Authorization':`Bearer ${OPENAI_API_KEY}`,'Content-Type':'application/json' },
    body: JSON.stringify({
      model:'gpt-4o-mini',
      messages:[
        { role:'system', content:'Summarize Australian politics content plainly in <=3 sentences. Neutral, specific.' },
        { role:'user', content:String(text).slice(0,4000) }
      ],
      temperature:0.2
    })
  });
  const j = await r.json();
  const content = j?.choices?.[0]?.message?.content ?? 'No summary.';
  return NextResponse.json({ summary: content });
}
