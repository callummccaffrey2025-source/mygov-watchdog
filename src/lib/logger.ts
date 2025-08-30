import { supabaseAdmin } from "./supabaseAdmin";
type Level = "debug"|"info"|"warn"|"error";

export async function log(level: Level, message: string, meta?: any) {
  try {
    await supabaseAdmin.from("app_log").insert({ level, message, meta });
  } catch (e) {
    // swallow to avoid log loops
  }
  const line = `[${level.toUpperCase()}] ${message}`;
  if (level === "error") console.error(line, meta);
  else console.log(line, meta);
}
