export const metadata = { title: "Trust Index™ — Verity", description: "How often an MP’s factual claims check out, paired with voting-consistency signals." };
import Methodology from "@/components/Methodology";
import LegalNote from "@/components/LegalNote";

export default function Page(){
  return (
    <main className="p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-2">Trust Index™</h1>
      <p className="text-neutral-300 mb-6">How often an MP’s factual claims check out, paired with voting-consistency signals.</p>

      <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-6">Coming soon.</div>

      <Methodology
        items={[
          { label: "Sources", value: `RMIT FactLab; ABC Fact Check; reputable fact-checkers; Hansard` },
          { label: "Weighting", value: `70% fact-checked statements; 30% voting alignment with claims` },
          { label: "Scoring", value: `Per-claim outcomes (true/mixed/false) → normalised score with confidence` },
          { label: "Receipts", value: `Direct links to fact-checks and relevant Hansard` }
        ]}
        limitations={[
          `Only claims assessed by fact-checkers are included.`,
          `Voting alignment is a proxy; context matters.`
        ]}
        updated="Weekly"
      />

      <LegalNote />
    </main>
  );
}
