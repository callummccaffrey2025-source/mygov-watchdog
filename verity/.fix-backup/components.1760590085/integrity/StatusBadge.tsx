export default function StatusBadge({ status }:{ status: string }) {
  return <span className="px-2 py-1 rounded-full text-xs bg-slate-200">{status}</span>;
}
