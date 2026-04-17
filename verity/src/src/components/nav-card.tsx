import Link from "next/link";
import { ArrowRight } from "./icons";

export default function NavCard({
  href, title, body,
}: { href: string; title: string; body?: string }) {
  return (
    <Link href={href} className="card card-hover card-ring block p-5 group outline-none">
      <div className="flex items-start justify-between gap-4">
        <div className="text-emerald-300 group-hover:text-emerald-200 font-semibold">{title}</div>
        <span className="text-neutral-300/80 group-hover:text-emerald-300 transition-transform group-hover:translate-x-0.5">
          <ArrowRight className="size-5" />
        </span>
      </div>
      {body && <p className="mt-2 text-sm text-neutral-400">{body}</p>}
    </Link>
  );
}
