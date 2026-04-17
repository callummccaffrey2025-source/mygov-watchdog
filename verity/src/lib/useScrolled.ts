"use client";
import { useEffect, useState } from "react";
export default function useScrolled(threshold = 8) {
  const [scrolled, set] = useState(false);
  useEffect(() => {
    let rAF = 0;
    const on = () => {
      rAF = requestAnimationFrame(() => set(window.scrollY > threshold));
    };
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => { cancelAnimationFrame(rAF); window.removeEventListener("scroll", on); };
  }, [threshold]);
  return scrolled;
}
