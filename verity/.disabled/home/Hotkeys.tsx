"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function Hotkeys() {
  const r = useRouter();
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (k === "b") r.push("/bills");
      if (k === "n") r.push("/news");
      if (k === "m") r.push("/mps");
      if (k === "p") r.push("/pricing");
    };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, [r]);
  return null;
}
