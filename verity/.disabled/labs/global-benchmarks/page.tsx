export const metadata = { title: "Global Benchmarks — Verity", description: "Compare Australian policy, outcomes, and costs to peer nations." };
import Methodology from "@/components/Methodology";
import LegalNote from "@/components/LegalNote";

export default function Page(){
  return (
    <main className="p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-2">Global Benchmarks</h1>
      <p className="text-neutral-300 mb-6">Compare Australian policy, outcomes, and costs to peer nations.</p>

      <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-6">Coming soon.</div>

      <Methodology
        items={[
          { label: "Sources", value: `OECD; World Bank; UN; IMF; national stats agencies` },
          { label: "Method", value: `Apples-to-apples indicators; PPP- and population-normalised` },
          { label: "Display", value: `Comparative tables and charts with footnotes` },
          { label: "Receipts", value: `Direct links to datasets and definitions` }
        ]}
        limitations={[
          `Some datasets are lagged or revised over time.`,
          `Different countries define metrics differently.`
        ]}
        updated="Weekly"
      />

      <LegalNote />
    </main>
  );
}
