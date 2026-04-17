'use client';
import { useEffect } from 'react';

export default function TrackClicks() {
  useEffect(() => {
    document.querySelectorAll('a, button').forEach((el) => {
      el.addEventListener('click', () => {
        const label = (el as HTMLElement).innerText || el.getAttribute('href') || 'unknown';
        console.log("EVENT_CLICK", label);
      });
    });
  }, []);
  return null;
}
