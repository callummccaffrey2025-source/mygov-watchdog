"use client";
import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

export default function TopProgress(){
  const pathname = usePathname();
  const search = useSearchParams();
  const [active, setActive] = useState(false);

  useEffect(() => {
    setActive(true);
    const t = setTimeout(()=>setActive(false), 450); // brief, smooth
    return () => clearTimeout(t);
  }, [pathname, search?.toString()]);

  return (
    <div aria-hidden className="pointer-events-none fixed inset-x-0 top-0 z-[60]">
      <div className={`h-[2px] bg-white/80 transition-all duration-500 ${active ? 'w-full opacity-100' : 'w-0 opacity-0'}`} />
    </div>
  );
}
