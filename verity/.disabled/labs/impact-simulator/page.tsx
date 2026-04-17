export const metadata = { title: "Legislation Impact Simulator — Verity", description: "Personalised “what it means for me” scenarios for major bills." };
import Methodology from "@/components/Methodology";
import LegalNote from "@/components/LegalNote";

export default function Page(){
  return (
    <main className="p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-2">Legislation Impact Simulator</h1>
      <p className="text-neutral-300 mb-6">Personalised “what it means for me” scenarios for major bills.</p>

      <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-6">Coming soon.</div>

      <Methodology
        items={[
          { label: "Sources", value: `Bill text; Explanatory Memoranda; Treasury/Dept reports; Parliamentary Library` },
          { label: "Method", value: `Rule-based mapping of provisions to household/business cohorts with narrative summaries` },
          { label: "Outputs", value: `Income, compliance, freedoms, sector impacts; scenario ranges, not predictions` },
          { label: "Receipts", value: `Inline citations to bill clauses and official reports` }
        ]}
        limitations={[
          `Assumes typical cases; edge cases may vary.`,
          `Not financial or legal advice.`
        ]}
        updated="Weekly"
      />

      <LegalNote />
    </main>
  );
}
