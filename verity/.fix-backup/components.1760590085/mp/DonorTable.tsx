import type { MP } from "@/lib/types";

export default function DonorTable({ mp }: { mp: MP }) {
  const donors = (mp.donors ?? []) as {
    name: string;
    amount: number;
    amountAUD?: number;
    year?: number;
  }[];

  if (!donors.length) return null;

  return (
    <div className="mt-6">
      <h3 className="text-sm font-medium text-white/90">Top donors</h3>
      <table className="mt-2 w-full text-sm">
        <thead className="text-white/60">
          <tr>
            <th className="py-2 pr-4 text-left">Name</th>
            <th className="py-2 pr-4 text-right">Amount</th>
            <th className="py-2 pr-0 text-right">Year</th>
          </tr>
        </thead>
        <tbody className="text-white/90">
          {donors.map(
            (
              d: { name: string; amount: number; amountAUD?: number; year?: number },
              i: number
            ) => (
              <tr key={`${d.name}-${d.year ?? i}`} className="border-b last:border-b-0 border-white/10">
                <td className="py-2 pr-4">{d.name}</td>
                <td className="py-2 pr-4 text-right">
                  ${ (d.amountAUD ?? d.amount).toLocaleString('en-AU') }
                </td>
                <td className="py-2 pr-0 text-right">{d.year ?? '—'}</td>
              </tr>
            )
          )}
        </tbody>
      </table>
    </div>
  );
}
