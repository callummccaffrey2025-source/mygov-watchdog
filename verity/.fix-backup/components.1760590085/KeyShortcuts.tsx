'use client';
import { useEffect } from 'react';
export default function KeyShortcuts() {
  useEffect(() => {
    let last = '';
    const handler = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (last === 'g') {
        if (k === 'f') window.location.href = '/features';
        if (k === 'j') window.location.href = '/join';
        if (k === 't') window.location.href = '/today';
        last = '';
      } else {
        last = k === 'g' ? 'g' : '';
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);
  return null;
}
