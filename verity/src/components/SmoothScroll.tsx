'use client';
import { useEffect } from 'react';

export default function SmoothScroll() {
  useEffect(() => {
    document.querySelectorAll('a[href^="#"]').forEach((el) => {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        const id = (el as HTMLAnchorElement).getAttribute('href')?.slice(1);
        const target = id ? document.getElementById(id) : null;
        if (target) target.scrollIntoView({ behavior: 'smooth' });
      });
    });
  }, []);
  return null;
}
