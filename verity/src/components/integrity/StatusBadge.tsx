"use client";
import { useEffect } from "react";

/** Subtle grid + spotlight that follows the cursor (respects reduced motion). */
export default function Bg() {
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      document.documentElement.style.setProperty("--x", e.clientX + "px");
      document.documentElement.style.setProperty("--y", e.clientY + "px");
    };
    if (window.matchMedia("(prefers-reduced-motion: no-preference)").matches) {
      window.addEventListener("pointermove", onMove);
      return () => window.removeEventListener("pointermove", onMove);
    }
  }, []);

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10">
      {/* spotlight */}
      <div className="absolute inset-0 bg-[radial-gradient(600px_circle_at_var(--x,50%)_var(--y,120px),rgba(16,185,129,0.16),transparent_60%)]" />
      {/* grid */}
      <div className="absolute inset-0 opacity-25 [background-image:linear-gradient(to_right,rgba(255,255,255,.06)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,.06)_1px,transparent_1px)] [background-size:40px_40px]" />
    </div>
  );
}
