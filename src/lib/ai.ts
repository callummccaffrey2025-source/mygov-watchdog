import OpenAI from 'openai'
import Anthropic from '@anthropic-ai/sdk'

const hasOpenAI = !!process.env.OPENAI_API_KEY
const hasAnthropic = !!process.env.ANTHROPIC_API_KEY

const openai = hasOpenAI ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null
const anthropic = hasAnthropic ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }) : null

export async function summarise(text: string): Promise<{ summary: string; confidence: number }> {
  const prompt = `Summarise this Australian bill neutrally in 4 bullets:
1) What it does. 2) Who it affects. 3) Fiscal/regulatory impact. 4) Controversies/risks (if any).
Avoid spin. Text:

${text}`

  if (openai) {
    const r = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'system', content: 'You are a neutral legislative analyst.' }, { role: 'user', content: prompt }],
      temperature: 0.2
    })
    return { summary: r.choices[0]?.message?.content || '', confidence: 0.9 }
  }
  if (anthropic) {
    const r: any = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20240620',
      max_tokens: 800,
      messages: [{ role: 'user', content: prompt }]
    })
    return { summary: r.content?.[0]?.text || '', confidence: 0.85 }
  }
  return { summary: text.slice(0, 600), confidence: 0.5 }
}

