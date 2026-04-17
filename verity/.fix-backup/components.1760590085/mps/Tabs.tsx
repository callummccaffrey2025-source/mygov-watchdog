import Link from "next/link";

const items = [
  { id: "votes", label: "Votes", href: "?tab=votes" },
  { id: "news", label: "News", href: "?tab=news" },
  { id: "committees", label: "Committees", href: "?tab=committees" },
  { id: "contacts", label: "Contacts", href: "?tab=contacts" },
];

export default function Tabs({ active = "votes" }: { active?: string }) {
  return (
    <nav aria-label="MP sections" className="mt-2 text-sm">
      <ul className="flex gap-4">
        {items.map(t => (
          <li key={t.id}>
            <Link
              href={t.href}
              aria-current={active === t.id ? "page" : undefined}
              className={`underline-offset-4 ${active===t.id ? "text-white underline" : "text-white/70 hover:text-white"}`}
              prefetch
            >{t.label}</Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
