export const metadata = { title: "Civic GPT Assistant — Verity", description: "Ask plain-English questions about bills, votes, and process — with receipts." };
import Methodology from "@/components/Methodology";
import LegalNote from "@/components/LegalNote";

export default function Page(){
  return (
    <main className="p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-2">Civic GPT Assistant</h1>
      <p className="text-neutral-300 mb-6">Ask plain-English questions about bills, votes, and process — with receipts.</p>

      <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-6">Coming soon.</div>

      <Methodology
        items={[
          { label: "Sources", value: `Bills; Hansard; official datasets; reputable fact-checkers` },
          { label: "Method", value: `Retrieval-augmented answers with citation stacking` },
          { label: "Safety", value: `Inline sources; no answers without receipts; AI response labels` },
          { label: "Receipts", value: `Citations under each answer` }
        ]}
        limitations={[
          `May miss the latest changes until data refresh.`,
          `Summaries can omit nuance; always read the source.`
        ]}
        updated="Multiple times per week"
      />

      <LegalNote />
    </main>
  );
}
