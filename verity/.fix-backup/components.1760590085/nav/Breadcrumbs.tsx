import Link from "next/link";
export default function Breadcrumbs({ name, slug }: { name: string; slug: string }) {
  return (
    <nav aria-label="Breadcrumb" className="text-sm text-white/70">
      <ol className="flex items-center gap-2">
        <li><Link className="underline decoration-white/20 underline-offset-2 hover:decoration-white" href="/mps">MPs</Link></li>
        <li aria-hidden="true">▸</li>
        <li className="text-white">{name}</li>
      </ol>
    </nav>
  );
}
