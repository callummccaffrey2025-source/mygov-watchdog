export function absUrl(path: string) {
  const base =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "") ||
    "http://localhost:3000";
  return new URL(path, base).toString();
}
