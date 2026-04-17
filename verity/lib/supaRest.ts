export async function srest(path: string, init: RequestInit = {}) {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key  = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!base || !key) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
  const url = `${base.replace(/\/+$/,"")}/rest/v1${path}`;
  const headers = { apikey: key, Authorization: `Bearer ${key}`, ...(init.headers as any) };
  return fetch(url, { ...init, headers, cache: "no-store" });
}
