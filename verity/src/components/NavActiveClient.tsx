// "use client" component that marks matching <a> as active in the header.
'use client';
import { useEffect } from 'react';
export default function NavActiveClient() {
  useEffect(() => {
    const path = window.location.pathname.replace(/\/+$/, '') || '/';
    const header = document.querySelector('header') || document.body;
    const links = header.querySelectorAll('a[href^="/"]');
    links.forEach((el) => {
      const href = (el as HTMLAnchorElement).getAttribute('href') || '';
      const clean = href.replace(/\/+$/, '') || '/';
      const isActive =
        clean === '/'
          ? path === '/'
          : path === clean || path.startsWith(clean + '/');
      if (isActive) {
        el.setAttribute('aria-current', 'page');
        el.classList.add('text-emerald-400'); // highlight
      } else {
        el.removeAttribute('aria-current');
        el.classList.remove('text-emerald-400');
      }
    });
  }, []);
  return null;
}
