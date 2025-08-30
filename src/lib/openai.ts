import OpenAI from "openai";

const KEY = process.env.OPENAI_API_KEY?.trim();
if (!KEY) throw new Error("Missing OPENAI_API_KEY");

export const openai = new OpenAI({ apiKey: KEY });
