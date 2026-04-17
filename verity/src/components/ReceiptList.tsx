export default function ReceiptList({ items }:{ items:{label:string;url:string}[] }){
  return (<ul className="mt-3 space-y-1 text-sm">
    {items.map((r,i)=>(<li key={i}><a href={r.url} className="text-emerald-300 hover:text-emerald-400">↗ {r.label}</a></li>))}
  </ul>);
}
