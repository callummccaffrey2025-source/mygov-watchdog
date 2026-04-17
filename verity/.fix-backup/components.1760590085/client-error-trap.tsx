function isErr(e: unknown): e is { message?: unknown } { return typeof e === "object" && e !== null; }
"use client";
import { useEffect } from "react";

export default function ClientErrorTrap() {
  useEffect(() => {
    const onErr = (e: ErrorEvent) => {
      try {
        console.error("[client-error]", e.message, e.error?.stack || "(no stack)");
      } catch {}
    };
    const onRej = (e: PromiseRejectionEvent) => {
      try {
        console.error("[client-error] unhandledrejection", e.reason);
      } catch {}
    };
    window.addEventListener("error", onErr);
    window.addEventListener("unhandledrejection", onRej);
    return () => {
      window.removeEventListener("error", onErr);
      window.removeEventListener("unhandledrejection", onRej);
    };
  }, []);
  return null;
}
