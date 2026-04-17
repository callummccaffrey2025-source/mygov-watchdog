export const metadata = { title: "MP Influence Score — Verity", description: "A transparent index of legislative traction, visibility, and engagement." };
import Methodology from "@/components/Methodology";
import LegalNote from "@/components/LegalNote";

export default function Page(){
  return (
    <main className="p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-2">MP Influence Score</h1>
      <p className="text-neutral-300 mb-6">A transparent index of legislative traction, visibility, and engagement.</p>

      <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-6">Coming soon.</div>

      <Methodology
        items={[
          { label: "Inputs", value: `Bills sponsored/passed; committee roles; Hansard mentions; media references; electorate engagement` },
          { label: "Formula", value: `Weighted composite (e.g., 0.4 bills, 0.3 engagement, 0.2 media, 0.1 roles)` },
          { label: "Normalisation", value: `Per-session scaling; role-adjusted baselines` },
          { label: "Receipts", value: `Links to bills, Hansard, and media records` }
        ]}
        limitations={[
          `Media quantity ≠ quality; we score presence, not merit.`,
          `Backbench/ministerial role differences are normalised but imperfect.`
        ]}
        updated="Weekly"
      />

      <LegalNote />
    </main>
  );
}
