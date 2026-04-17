import SourceGuard from '../../../components/verity/SourceGuard';
const rows = [
  { metric:'Housing affordability index', au:72, ca:69, uk:66, receipts:[{url:'https://oecd.org',label:'OECD dataset'}] }
];
export default function Page(){
  const receipts = rows.flatMap(r=>r.receipts);
  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Global Benchmarks</h1>
      <SourceGuard receipts={receipts}>
        <div className="rounded-2xl border border-zinc-800 p-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-neutral-100"><th className="text-left">Metric</th><th>AU</th><th>CA</th><th>UK</th></tr></thead>
            <tbody>{rows.map((r,i)=>(
              <tr key={i} className="border-t border-zinc-800"><td>{r.metric}</td><td className="text-center">{r.au}</td><td className="text-center">{r.ca}</td><td className="text-center">{r.uk}</td></tr>
            ))}</tbody>
          </table>
        </div>
      </SourceGuard>
    </div>
  );
}
