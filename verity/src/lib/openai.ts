import OpenAI from "openai";
let _oa: OpenAI | null = null;
export function getOpenAI() {
  if (_oa) return _oa;
  const key = process.env.OPENAI_API_KEY as string | undefined;
  if (!key) throw new Error("OPENAI_API_KEY missing");
  _oa = new OpenAI({ apiKey: key });
  return _oa;
}
