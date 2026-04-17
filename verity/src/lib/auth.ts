export const API_KEY = process.env.API_KEY || "";

export function requireKey(req: Request): boolean {
  if (!API_KEY) return true; // no key set → open
  const url = new URL(req.url);
  const key = req.headers.get("x-api-key") || url.searchParams.get("key") || "";
  return key === API_KEY;
}

export function unauthorized() {
  return new Response(JSON.stringify({ error: "unauthorized" }), {
    status: 401,
    headers: { "content-type": "application/json", "cache-control": "no-store" }
  });
}
