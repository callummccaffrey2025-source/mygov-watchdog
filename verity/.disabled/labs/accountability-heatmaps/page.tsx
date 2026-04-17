export const metadata = { title: "Accountability Heatmaps — Verity", description: "Interactive engagement, alignment, and risk heatmaps across MPs and electorates." };
import Methodology from "@/components/Methodology";
import LegalNote from "@/components/LegalNote";

export default function Page(){
  return (
    <main className="p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-2">Accountability Heatmaps</h1>
      <p className="text-neutral-300 mb-6">Interactive engagement, alignment, and risk heatmaps across MPs and electorates.</p>

      <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-6">Coming soon.</div>

      <Methodology
        items={[
          { label: "Sources", value: `Hansard; division lists; committee attendance; AEC filings` },
          { label: "Method", value: `Normalised indices: engagement, alignment, donor concentration` },
          { label: "Scales", value: `Colour-coded heat scores with tooltips and filters` },
          { label: "Receipts", value: `Link-outs to attendance, votes, and filings` }
        ]}
        limitations={[
          `Attendance proxies don’t capture work outside chambers.`,
          `Donor “risk” reflects concentration, not motive.`
        ]}
        updated="Weekly"
      />

      <LegalNote />
    </main>
  );
}
