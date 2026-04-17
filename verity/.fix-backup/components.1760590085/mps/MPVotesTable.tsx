import BillHoverCard from "@/components/bills/BillHoverCard";
import { formatDateAU } from "@/lib/format";
import VoteExplainer from "./VoteExplainer";

type Vote = {
  bill_id: string;
  bill_title: string;
  stage: string;
  date: string;
  decision: string;
};

export default function MPVotesTable({ votes, limit = 10 }: { votes: Vote[]; limit?: number }) {
  const slice = (votes ?? []).slice(0, limit);

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <caption className="sr-only">Recent votes</caption>
          <thead>
            <tr className="border-b border-white/10 text-left">
              <th className="p-3">Bill</th>
              <th className="p-3">Stage</th>
              <th className="p-3">Date</th>
              <th className="p-3">Vote</th>
            </tr>
          </thead>
          <tbody>
            {slice.map((v, i) => (
              <tr key={`${v.bill_id}-${i}`} className="border-t border-white/10">
                <td className="p-3">
                  <a
                    className="underline decoration-white/20 underline-offset-2 hover:decoration-white"
                    href={`/bills/${v.bill_id}`}
                  >
                    {v.bill_title}
                  </a>
                </td>
                <td className="p-3">{v.stage}</td>
                <td className="p-3 whitespace-nowrap">{formatDateAU(v.date)}</td>
                <td className="p-3">{v.decision}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* render client explainer outside the table for SSR stability */}
      {slice[0] && (
        <div className="mt-2">
          <VoteExplainer billId={slice[0].bill_id} />
        </div>
      )}
    </>
  );
}
