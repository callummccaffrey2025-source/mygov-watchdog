'use client';
import { useEffect } from 'react';

/**
 * Avoid hydration mismatches by NOT changing attributes that were server-rendered.
 * We only attach click handlers. We never modify <a href="...">.
 */
export default function RetargetJoin() {
  useEffect(() => {
    // Target only buttons (not anchors) whose text looks like "Join" / "Join $1"
    const buttons = Array.from(document.querySelectorAll('button')) as HTMLButtonElement[];
    const isJoin = (t: string) => /join/i.test(t) || /\$?\s*1(\/month)?/i.test(t);

    buttons.forEach((btn) => {
      const text = (btn.innerText || '').trim();
      if (!isJoin(text)) return;

      // Attach a navigation handler without touching server-rendered markup
      const handler = (e: MouseEvent) => {
        e.preventDefault();
        window.location.href = '/join';
      };
      btn.addEventListener('click', handler);

      // Cleanup
      return () => btn.removeEventListener('click', handler);
    });
  }, []);

  return null;
}
