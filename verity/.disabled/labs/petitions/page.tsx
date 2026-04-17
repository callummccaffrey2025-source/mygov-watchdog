export const metadata = { title: "Citizen Petition Engine — Verity", description: "Launch, sign, and route petitions to MPs from inside Verity." };
import Methodology from "@/components/Methodology";
import LegalNote from "@/components/LegalNote";

export default function Page(){
  return (
    <main className="p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-2">Citizen Petition Engine</h1>
      <p className="text-neutral-300 mb-6">Launch, sign, and route petitions to MPs from inside Verity.</p>

      <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-6">Coming soon.</div>

      <Methodology
        items={[
          { label: "Sources", value: `User-submitted petition text; electorate routing data` },
          { label: "Method", value: `Identity checks; per-electorate delivery; signature tracking` },
          { label: "Moderation", value: `Community guidelines; Takedown for TOS breaches` },
          { label: "Receipts", value: `Delivery confirmations and public signature counts` }
        ]}
        limitations={[
          `Petition content is user-generated.`,
          `Delivery times can vary by MP office processes.`
        ]}
        updated="Weekly"
      />

      <LegalNote />
    </main>
  );
}
