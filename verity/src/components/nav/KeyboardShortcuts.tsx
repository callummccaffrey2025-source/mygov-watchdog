"use client";
import { useEffect } from "react";
export default function KeyboardShortcuts() {
  useEffect(() => {
    let gPressed = false;
    const onKey = (e: KeyboardEvent) => {
      // '/' opens search
      if (e.key === '/' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        const el = document.querySelector<HTMLInputElement>('input[type="search"], [role="search"] input');
        if (el) el.focus(); else window.location.href = '/search';
      }
      // g followed by v/n/c jumps to sections on MP pages
      if (e.key.toLowerCase() === 'g') { gPressed = true; setTimeout(()=>gPressed=false, 800); return; }
      if (gPressed) {
        const map: Record<string,string> = { v: '#votes', n: '#news', c: '#contacts' };
        const hash = map[e.key.toLowerCase()];
        if (hash) { e.preventDefault(); location.hash = hash; }
        gPressed = false;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  return null;
}
