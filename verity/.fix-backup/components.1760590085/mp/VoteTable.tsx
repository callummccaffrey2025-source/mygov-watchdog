import Link from 'next/link';
import type { MP } from "@/lib/types";

export default function VoteTable({ mp }: { mp: MP }) {
  const votes = (mp.votes ?? []) as {
    title: string;
    position: string;
    date?: string;
    billId?: string;
    billTitle?: string;
    vote?: string;
  }[];

  if (!votes.length) return null;

  return (
    <div className="mt-6">
      <h3 className="text-sm font-medium text-white/90">Recent votes</h3>
      <table className="mt-2 w-full text-sm">
        <thead className="text-white/60">
          <tr>
            <th className="py-2 pr-4 text-left">Date</th>
            <th className="py-2 pr-4 text-left">Bill</th>
            <th className="py-2 pr-0  text-left">Vote</th>
          </tr>
        </thead>
        <tbody className="text-white/90">
          {votes.map((v, i) => (
            <tr key={`${v.billId ?? v.title}-${v.date ?? i}`} className="border-b last:border-b-0 border-white/10">
              <td className="py-2 pr-4 whitespace-nowrap">
                {v.date ? new Date(v.date).toLocaleDateString() : '—'}
              </td>
              <td className="py-2 pr-4">
                {v.billId ? (
                  <Link href={`/bills/${v.billId}`} className="underline underline-offset-2">
                    {v.billTitle ?? v.title}
                  </Link>
                ) : (
                  v.billTitle ?? v.title
                )}
              </td>
              <td className="py-2 pr-0">{v.vote ?? v.position}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
