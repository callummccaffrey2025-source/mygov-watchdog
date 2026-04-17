"use client";
import { useEffect } from "react";
export default function useAnalytics(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    const send = () =>
      navigator.sendBeacon?.("/api/analytics", JSON.stringify({ path: location.pathname, ts: Date.now() }));
    send();
    window.addEventListener("popstate", send);
    return () => window.removeEventListener("popstate", send);
  }, [enabled]);
}
