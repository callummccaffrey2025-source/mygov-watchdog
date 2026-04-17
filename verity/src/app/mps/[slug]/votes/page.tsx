import type { MPProfile } from "@/types/mp";

async function fetchProfile(slug: string): Promise<MPProfile> {
  const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL ?? ""}/api/mps/${slug}`, { next: { revalidate: 300 } });
  if (!res.ok) throw new Error("Failed to load MP");
  return res.json();
}

export default async function VotesPage({ params }: { params: { slug: string } }) {
  const mp = await fetchProfile(params.slug);
  return (
    <main className="mx-auto w-full max-w-4xl space-y-6 px-3 py-6">
      <h1 className="text-lg font-semibold">{mp.name} — all votes</h1>
      <div className="overflow-hidden rounded-xl border border-white/10">
        <table className="w-full text-sm">
          <thead className="bg-white/5 text-left text-white/70">
            <tr><th className="px-4 py-2">Bill</th><th className="px-4 py-2">Stage</th><th className="px-4 py-2">Date</th><th className="px-4 py-2">Vote</th></tr>
          </thead>
          <tbody>
            {mp.recent_votes.map(v => (
              <tr key={`${v.bill_id}-${v.date}`} className="border-t border-white/10">
                <td className="px-4 py-3"><a href={`/bills/${v.bill_id}`} className="underline decoration-white/20 underline-offset-2 hover:decoration-white">{v.bill_title}</a></td>
                <td className="px-4 py-3">{v.stage}</td>
                <td className="px-4 py-3">{new Intl.DateTimeFormat('en-AU',{day:'numeric',month:'short',year:'numeric'}).format(new Date(v.date))}</td>
                <td className="px-4 py-3">{v.decision}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
