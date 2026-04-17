"use client";
import { useEffect, useId, useState } from "react";
import { track } from "@/lib/analytics";

export default function FollowButton({ slug, name }: { slug: string; name: string }) {
  const key = `watch:${slug}`;
  const [on, setOn] = useState(false);
  const liveId = useId();

  useEffect(() => { setOn(localStorage.getItem(key) === "1"); }, [key]);

  const toggle = () => {
    const next = !on;
    setOn(next);
    localStorage.setItem(key, next ? "1" : "0");
    track(next ? "follow_mp" : "unfollow_mp", { slug, name });
    const el = document.getElementById(liveId);
    if (el) el.textContent = next ? `Following ${name}` : `Unfollowed ${name}`;
  };

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={toggle}
        aria-pressed={on}
        className={`rounded-lg px-3 py-2 text-sm ${on ? "bg-emerald-600 text-white" : "bg-white/10 hover:bg-white/15"}`}
      >
        {on ? "Following" : "Follow"}
      </button>
      <a className="text-sm underline decoration-white/20 underline-offset-2 hover:decoration-white" href={`/mps/${slug}/feed.xml`} target="_blank" rel="noreferrer">RSS</a>
      <a className="text-sm underline decoration-white/20 underline-offset-2 hover:decoration-white"
         href={`mailto:${encodeURIComponent("A.Albanese.MP@aph.gov.au")}?subject=${encodeURIComponent(`Regarding recent votes — ${name}`)}&body=${encodeURIComponent("Dear MP,\n\nI am writing about...")}`}>
        Email office
      </a>
      <span id={liveId} className="sr-only" role="status" aria-live="polite"></span>
    </div>
  );
}
