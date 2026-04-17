"use client";
import { useEffect, useState } from "react";
import { partyClasses } from "@/lib/party";
import FollowButton from "@/components/mps/FollowButton";

export default function StickyIdentity({ name, slug, party }: { name: string; slug: string; party?: string }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const target = document.getElementById("scorecard") || document.getElementById("main");
    if (!target) { setShow(true); return; }
    const io = new IntersectionObserver(
      (entries) => setShow(!entries[0].isIntersecting),
      { rootMargin: "-100px 0px 0px 0px", threshold: 0 }
    );
    io.observe(target);
    return () => io.disconnect();
  }, []);
  if (!show) return null;
  return (
    <div className="sticky top-12 z-40 border-b border-white/10 bg-black/60 backdrop-blur relative z-20">
      <div className="mx-auto flex w-full max-w-4xl items-center justify-between px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{name}</span>
          <span className={`rounded-full px-2 py-0.5 text-xs ${partyClasses(party)}`}>{party}</span>
        </div>
        <div className="flex items-center gap-2">
          <FollowButton slug={slug} name={name} />
        </div>
      </div>
    </div>
  );
}
