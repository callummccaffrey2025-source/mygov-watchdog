"use client";
import { createContext, useCallback, useContext, useMemo, useState } from "react";

type Toast = { id: number; text: string };
const Ctx = createContext<{ push: (text: string) => void } | null>(null);

export function useToast() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider/>");
  return ctx.push;
}

export default function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const push = useCallback((text: string) => {
    const id = Date.now() + Math.random();
    setItems((s) => [...s, { id, text }]);
    setTimeout(() => setItems((s) => s.filter((t) => t.id !== id)), 2200);
  }, []);
  const value = useMemo(() => ({ push }), [push]);

  return (
    <Ctx.Provider value={value}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-4 z-[100] flex flex-col items-center gap-2">
        {items.map((t) => (
          <div key={t.id} className="pointer-events-auto rounded-lg border border-white/15 bg-black/70 px-3 py-2 text-sm shadow-xl backdrop-blur">
            {t.text}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
