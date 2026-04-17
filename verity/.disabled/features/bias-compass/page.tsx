export const metadata = {
  title: "Bias Compass™ — Verity",
  description: "A lens that positions coverage and statements on a transparent spectrum, based on disclosed methodology and citations.",
  robots: { index: true, follow: true }
};
import LegalNote from "@/components/LegalNote";

export default function Page() {
  return (
    <main className="mx-auto max-w-4xl p-8">
      <h1 className="text-3xl font-bold">Bias Compass™</h1>
      <p className="mt-2 text-neutral-300">A lens that positions coverage and statements on a transparent spectrum, based on disclosed methodology and citations.</p>

      <section className="mt-8 space-y-4">
        <h2 className="text-xl font-semibold">What you&rsquo;ll get</h2>
        <ul className="list-disc pl-5 text-neutral-200">
          <li>Data-first, source-backed views.</li>
          <li>Clear methods and transparent assumptions.</li>
          <li>Receipts layered on every chart/claim.</li>
        </ul>
      </section>

      <section className="mt-8">
        <div className="rounded-xl border border-neutral-800 bg-neutral-900/30 p-5">
          <p className="text-sm text-neutral-400">🚧 In active development.</p>
          <p className="mt-1 text-neutral-200">
            This page is a live stub so we can wire routing, design, and tracking now.
            Implementation details and data sources will be added incrementally.
          </p>
        </div>
      </section>

      <LegalNote />
    </main>
  );
}
