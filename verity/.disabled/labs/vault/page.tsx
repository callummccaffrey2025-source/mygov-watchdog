export const metadata = { title: "Verity Vault (Research Hub) — Verity", description: "Premium data workbench for journalists, academics, and advocates." };
import Methodology from "@/components/Methodology";
import LegalNote from "@/components/LegalNote";

export default function Page(){
  return (
    <main className="p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-2">Verity Vault (Research Hub)</h1>
      <p className="text-neutral-300 mb-6">Premium data workbench for journalists, academics, and advocates.</p>

      <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-6">Coming soon.</div>

      <Methodology
        items={[
          { label: "Sources", value: `Public filings; official datasets; licensed data (where applicable)` },
          { label: "Features", value: `Advanced search, graph views, alerts, exports` },
          { label: "Governance", value: `Access controls; audit logs; retention policies` },
          { label: "Receipts", value: `Every chart/table links to its underlying data` }
        ]}
        limitations={[
          `Licensed datasets may impose usage terms.`,
          `Historic records can contain OCR or transcription errors.`
        ]}
        updated="Continuously"
      />

      <LegalNote />
    </main>
  );
}
