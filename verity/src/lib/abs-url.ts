export function absUrl(path: string) {
  const base = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/+$/,"");
  return new URL(path, base).toString();
}
