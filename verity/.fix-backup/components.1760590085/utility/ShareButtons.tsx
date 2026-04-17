"use client";
import { useState } from "react";

export default function ShareButtons({ title }: { title: string }) {
  const [copied, setCopied] = useState(false);
  const url = typeof window !== "undefined" ? window.location.href : "";

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true); setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  const nativeShare = async () => {
    try {
      if (navigator.share) await navigator.share({ title, url });
      else copy();
    } catch {}
  };

  return (
    <div className="flex items-center gap-2">
      <button onClick={copy} className="rounded-lg bg-white/10 px-3 py-2 text-sm hover:bg-white/15">
        {copied ? "Copied" : "Copy link"}
      </button>
      <button onClick={nativeShare} className="rounded-lg bg-white/10 px-3 py-2 text-sm hover:bg-white/15">
        Share
      </button>
    </div>
  );
}
