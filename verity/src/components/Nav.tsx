import Link from "next/link";

export default function Nav(){
  const links = [
    { href:"/mps", label:"MPs" },
    { href:"/bills", label:"Bills" },
    { href:"/news", label:"News" },
    { href:"/pricing", label:"Pricing" },
    { href:"/join", label:"Join" },
  ];
  return (
    <header className="sticky top-0 z-30 border-b border-[#263041] bg-[#0b0f14]/80 backdrop-blur">
      <div className="mx-auto max-w-6xl px-4 h-14 flex items-center justify-between">
        <Link href="/" className="font-semibold tracking-wide">VERITY</Link>
        <nav className="flex items-center gap-6 text-sm text-[#9BA3AF]">
          {links.map(l => <Link key={l.href} href={l.href} className="hover:text-white">{l.label}</Link>)}
        </nav>
      </div>
    </header>
  );
}
