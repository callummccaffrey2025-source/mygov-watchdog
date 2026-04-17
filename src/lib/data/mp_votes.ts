export type VoteRow = { bill: string; position: string; date: string };
export async function fetch_mp_votes(slug: string): Promise<VoteRow[]|null> {
  const url = process.env.NEXT_PUBLIC_API ? `${process.env.NEXT_PUBLIC_API}/api/mps/${slug}/votes` : "";
  if (url) {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    return await res.json();
  }
  return [
    { bill: "Budget Appropriation Bill 2025", position: "Aye", date: new Date().toISOString() },
    { bill: "Electoral Integrity Amendment", position: "No", date: new Date(Date.now()-864e5).toISOString() }
  ];
}
