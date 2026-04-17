"use client";
let loaded = false;
export function track(name: string, props?: Record<string, any>) {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key || typeof window === 'undefined') return;
  if (!loaded) {
    (window as any).posthog = (window as any).posthog || { capture: () => {} };
    // @ts-ignore lazy init (you'll replace with real snippet)
    loaded = true;
  }
  // @ts-ignore
  window.posthog.capture(name, props);
}
