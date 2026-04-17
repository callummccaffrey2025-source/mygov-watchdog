export const metadata = { title: "Bias Compass™ — Verity", description: "See how outlets and statements align across the political spectrum with a transparent, source-backed lens." };
import Methodology from "@/components/Methodology";
import LegalNote from "@/components/LegalNote";

export default function Page(){
  return (
    <main className="p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-2">Bias Compass™</h1>
      <p className="text-neutral-300 mb-6">See how outlets and statements align across the political spectrum with a transparent, source-backed lens.</p>

      <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-6">Coming soon.</div>

      <Methodology
        items={[
          { label: "Sources", value: `Academic media-bias studies; public datasets; outlet self-disclosures; content analysis` },
          { label: "Method", value: `Relative positioning using topic framing & language cues; calibrated to neutral baselines` },
          { label: "Display", value: `Bias lens toggle; per-story/source positioning; confidence bands` },
          { label: "Receipts", value: `Links to articles, transcripts, and datasets` }
        ]}
        limitations={[
          `Positions reflect comparative analysis, not absolute truth.`,
          `Nuance/tone may not be fully captured.`
        ]}
        updated="Weekly"
      />

      <LegalNote />
    </main>
  );
}
