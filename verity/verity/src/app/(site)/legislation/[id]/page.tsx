import Link from "next/link";
import { notFound } from "next/navigation";

import { sbRest } from "@/lib/supabase";
import type { Bill, BillSection } from "@/types/bills";

import { BillSectionSearch } from "./BillSectionSearch";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: { id: string } }) {
  const id = params.id;
  const billRes = await sbRest(
    `bills_mv?id=eq.${id}&select=id,title,chamber,stage,source_url`
  );
  const bills = (await billRes.json()) as Bill[];
  if (bills.length === 0) {
    notFound();
  }
  const bill = bills[0];

  const secRes = await sbRest(
    `bill_sections_v1?bill_id=eq.${id}&select=id,ord,heading,text&order=ord.asc`
  );
  const sections = (await secRes.json()) as BillSection[];
  const hasSections = sections.length > 0;

  return (
    <main className="p-6 space-y-6">
      <Link
        href="/legislation"
        className="text-sm text-emerald-400 hover:underline"
      >
        ← Back
      </Link>
      <h1 className="text-3xl font-semibold">{bill.title ?? "Untitled bill"}</h1>
      <p className="text-zinc-400">
        {bill.chamber ?? "Unknown chamber"} • {bill.stage ?? "Unknown stage"}
      </p>
      {bill.source_url && (
        <a
          className="text-emerald-400 hover:underline"
          href={bill.source_url}
          target="_blank"
          rel="noreferrer"
        >
          Source
        </a>
      )}
      <BillSectionSearch
        sections={sections.map((section) => ({
          id: section.id,
          heading: section.heading,
          text: section.text,
        }))}
      />
      <article className="prose prose-invert max-w-none space-y-6">
        {hasSections ? (
          sections.map((section) => (
            <section key={section.id}>
              {section.heading && <h3>{section.heading}</h3>}
              {section.text && <p>{section.text}</p>}
            </section>
          ))
        ) : (
          <p className="text-zinc-400">No sections available.</p>
        )}
      </article>
    </main>
  );
}
