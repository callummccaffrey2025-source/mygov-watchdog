import Link from "next/link";

import { sbRest } from "@/lib/supabase";
import type { Bill } from "@/types/bills";

export const dynamic = "force-dynamic";

export default async function Page() {
  const res = await sbRest(
    "bills_mv?select=id,title,chamber,stage&order=title.asc"
  );
  const bills = (await res.json()) as Array<
    Pick<Bill, "id" | "title" | "chamber" | "stage">
  >;

  if (bills.length === 0) {
    return (
      <main className="p-6 space-y-6">
        <h1 className="text-3xl font-semibold">Legislation</h1>
        <p className="text-zinc-400">No bills yet.</p>
      </main>
    );
  }

  return (
    <main className="p-6 space-y-6">
      <h1 className="text-3xl font-semibold">Legislation</h1>
      <ul className="space-y-2">
        {bills.map((bill) => (
          <li key={bill.id}>
            <Link
              className="text-emerald-400 hover:underline"
              href={`/legislation/${bill.id}`}
            >
              {bill.title ?? "Untitled bill"}
            </Link>
            <span className="text-zinc-400 ml-2">
              ({bill.chamber ?? "Unknown"} • {bill.stage ?? "Unknown"})
            </span>
          </li>
        ))}
      </ul>
    </main>
  );
}
