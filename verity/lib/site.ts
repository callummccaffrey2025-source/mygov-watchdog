export function siteUrl(): URL {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  try {
    return new URL(raw || 'http://localhost:3000');
  } catch {
    return new URL('http://localhost:3000');
  }
}
