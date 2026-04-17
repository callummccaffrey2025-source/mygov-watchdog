import { headers } from "next/headers";

async function fsFallback<T>(path:string):Promise<T>{
  const { readFile } = await import("fs/promises");
  const { join } = await import("path");
  const file = join(process.cwd(),"public",path.replace(/^\/+/,""));
  const raw = await readFile(file,"utf-8");
  return JSON.parse(raw) as T;
}

/**
 * Server-safe JSON loader that works in dev/prod and on Vercel.
 * - Uses full URL (via awaited headers()) on the server
 * - Falls back to reading from /public if fetch fails
 * - Uses relative fetch in the browser
 */
export async function loadJSON<T=unknown>(path:string):Promise<T>{
  if(!path) throw new Error("loadJSON: path required");
  const fetchJSON = async (url:string) => {
    const r = await fetch(url, { cache:"no-store" });
    if(!r.ok) throw new Error(`GET ${url}: ${r.status}`);
    return r.json() as Promise<T>;
  };

  if (typeof window !== "undefined") {
    // client: relative path is fine
    return fetchJSON(path);
  }

  // server: construct absolute URL via awaited headers()
  try {
    const h = await headers();
    const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
    const proto = h.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https");
    const abs = path.startsWith("/") ? `${proto}://${host}${path}` : path;
    return await fetchJSON(abs);
  } catch {
    // fallback to reading public/… directly
    return fsFallback<T>(path);
  }
}
