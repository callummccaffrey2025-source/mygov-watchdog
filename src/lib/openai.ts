import OpenAI from "openai";
const key = process.env.OPENAI_API_KEY;
if (!key) throw new Error("Missing OPENAI_API_KEY");
export const openai = new OpenAI({ apiKey: key });
