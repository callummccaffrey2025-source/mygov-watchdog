"use client";
import { useEffect, useState } from "react";

export function useScrollSpy(ids: string[], offset = 80) {
  const [active, setActive] = useState<string | null>(null);
  useEffect(() => {
    const els = ids
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => !!el);
    if (!els.length) return;

    const handler = () => {
      let current: string | null = null;
      for (const el of els) {
        const top = el.getBoundingClientRect().top - offset;
        if (top <= 0) current = el.id;
      }
      if (!current) current = els[0].id;
      setActive(current);
    };
    handler();
    window.addEventListener("scroll", handler, { passive: true });
    window.addEventListener("resize", handler);
    return () => {
      window.removeEventListener("scroll", handler);
      window.removeEventListener("resize", handler);
    };
  }, [ids, offset]);

  return active;
}
