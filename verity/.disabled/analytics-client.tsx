"use client";
import { useEffect } from "react";
import { analyticsConsent, track } from "@/lib/analytics";

export default function AnalyticsClient() {
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const el = (e.target as HTMLElement)?.closest?.("a,button");
      if (!el) return;
      const href = (el as HTMLAnchorElement).getAttribute?.("href") || "";
      const dataName = (el as HTMLElement).getAttribute("data-track");
      const name =
        dataName ||
        (href === "/pricing" ? "pricing_cta_click" :
         href === "/product" ? "product_cta_click" :
         href === "/join-waitlist" ? "waitlist_cta_click" :
         (el.tagName === "BUTTON" ? "button_click" : "link_click"));
      track(name, { href, text: (el.textContent || "").trim().slice(0,80) });
    };

    const onSubmit = (e: Event) => {
      const form = e.target as HTMLFormElement;
      const action = form.getAttribute("action") || "";
      if (action.includes("/api/waitlist")) track("waitlist_submitted");
      if (action.includes("/api/contact")) track("contact_submitted");
      if (action.includes("/api/diff/subscribe")) track("diff_subscribe");
    };

    document.addEventListener("click", onClick, { capture: true });
    document.addEventListener("submit", onSubmit, { capture: true });

    // First load view event (once consent is granted)
    if (analyticsConsent() === "granted") track("page_view", { path: location.pathname });

    return () => {
      document.removeEventListener("click", onClick, { capture: true });
      document.removeEventListener("submit", onSubmit, { capture: true });
    };
  }, []);
  return null;
}
