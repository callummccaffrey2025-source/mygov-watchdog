export const metadata = { title: "Receipts Timeline — Verity", description: "Visual timelines of what was said and done — speeches, votes, donations, and coverage." };
import Methodology from "@/components/Methodology";
import LegalNote from "@/components/LegalNote";

export default function Page(){
  return (
    <main className="p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-2">Receipts Timeline</h1>
      <p className="text-neutral-300 mb-6">Visual timelines of what was said and done — speeches, votes, donations, and coverage.</p>

      <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-6">Coming soon.</div>

      <Methodology
        items={[
          { label: "Sources", value: `Hansard; AEC; press releases; reputable media` },
          { label: "Method", value: `Event normalization and dedupe; per-entity timelines` },
          { label: "Display", value: `Chronological cards with filters and export` },
          { label: "Receipts", value: `Each event links to primary source` }
        ]}
        limitations={[
          `Media summaries reflect the outlet’s framing.`,
          `Historic gaps may exist if source archives are incomplete.`
        ]}
        updated="Weekly"
      />

      <LegalNote />
    </main>
  );
}
