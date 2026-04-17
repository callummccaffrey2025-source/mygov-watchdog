"use client";
import { useEffect, useState } from "react";

export default function StatusPill() {
  const [text, setText] = useState("…");
  useEffect(() => {
    let off = false;
    fetch("/api/status")
      .then(r => r.json())
      .then(j => {
        if (off) return;
        const up = j && j.uptime30d ? j.uptime30d : "ok";
        setText("Uptime " + up);
      })
      .catch(() => setText("ok"));
    return () => { off = true; };
  }, []);
  return (
    <span className="ml-3 rounded-full border border-emerald-800/60 bg-emerald-900/30 px-2 py-0.5 text-xs text-emerald-300">
      Status: {text}
    </span>
  );
}
