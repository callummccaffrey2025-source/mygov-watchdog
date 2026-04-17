import "server-only";
export type MP = { name: string; party?: string; electorate?: string; photoUrl?: string; lastUpdated?: string };
export async function fetch_mp_bySlug(slug: string): Promise<MP|null> {
  const url = process.env.NEXT_PUBLIC_API ? `${process.env.NEXT_PUBLIC_API}/api/mps/${slug}` : "";
  if (url) {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    const d = await res.json();
    return { name: d.name, party: d.party, electorate: d.electorate, photoUrl: d.photoUrl ?? d.photo, lastUpdated: d.updated_at ?? d.lastUpdated };
  }
  return { name: slug.replace(/-/g," ").toUpperCase(), party: "Liberal", electorate: "Bradfield", photoUrl: "", lastUpdated: new Date().toISOString() };
}
