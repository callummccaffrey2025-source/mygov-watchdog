import Link from "next/link";
import LegalNote from "@/components/LegalNote";

export const metadata = {
  title: "Features — Verity",
  description: "Explore Verity’s data-first civic tools.",
};

const items = [
  ["Bias Compass™","bias-compass","A spectrum view of media framing and statements."],
  ["Legislation Impact Simulator","impact-simulator","See scenario-based effects grounded in bill text."],
  ["Accountability Heatmaps","accountability-heatmaps","Attendance, voting, and engagement—made visual."],
  ["Civic GPT Assistant","civic-assistant","Ask questions, get receipts-backed answers."],
  ["Receipts Timeline","receipts-timeline","What they said vs did, in one timeline."],
  ["Citizen Petition Engine","petitions","Turn awareness into structured action."],
  ["Global Benchmarks","global-benchmarks","International context from trusted datasets."],
  ["MP Influence Score","influence-score","Objective, transparent influence indicators."],
  ["Trust Index™","trust-index","How often claims check out over time."],
  ["Verity Vault","vault","Premium research-grade data workspace."]
] as const;

export default function Page(){
  return (
    <main className="mx-auto max-w-5xl p-8">
      <h1 className="text-3xl font-bold">Features</h1>
      <p className="mt-2 text-neutral-300">High-integrity civic tools. Every insight is traceable to a source.</p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {items.map(([title, slug, blurb]) => (
          <Link
            key={slug}
            href={`/features/${slug}`}
            className="rounded-xl border border-neutral-800 bg-neutral-900/30 p-5 transition hover:border-neutral-700"
          >
            <h2 className="text-lg font-semibold">{title}</h2>
            <p className="mt-1 text-neutral-300">{blurb}</p>
          </Link>
        ))}
      </div>

      <LegalNote />
    </main>
  );
}
