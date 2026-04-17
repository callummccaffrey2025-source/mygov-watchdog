/**
 * Minimal stub to satisfy imports without shipping Supabase auth.
 * Returns null; callers should guard if they exist.
 */
export function getSupabaseBrowser() {
  return null as unknown as { auth?: unknown };
}
export default getSupabaseBrowser;
