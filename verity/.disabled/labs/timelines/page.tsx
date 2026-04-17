import SourceGuard from '../../../components/verity/SourceGuard';
import { Receipts } from '../../../components/verity/Receipts';

const events = [
  { t:'2024-11-12', title:'Second reading speech', receipts:[{url:'https://parlinfo.aph.gov.au',label:'Hansard'}] },
  { t:'2025-02-03', title:'Amendment moved',      receipts:[{url:'https://aph.gov.au',       label:'Notice Paper'}] }
];

export default function Page(){
  const receipts = events.flatMap(e=>e.receipts);
  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Receipts Timeline</h1>
      <SourceGuard receipts={receipts}>
        <ol className="relative border-s border-zinc-700 ml-4 space-y-4">
          {events.map((e,i)=>(
            <li key={i}>
              <div className="absolute -left-1.5 h-3 w-3 rounded-full bg-zinc-400" />
              <div className="ml-4">
                <div className="text-sm text-neutral-100">{e.t}</div>
                <div className="font-medium">{e.title}</div>
              </div>
            </li>
          ))}
        </ol>
        <Receipts items={receipts}/>
      </SourceGuard>
    </div>
  );
}
