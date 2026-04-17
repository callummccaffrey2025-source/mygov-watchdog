"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

type Toast = { id: number; text: string };
const Ctx = createContext<{ push: (text: string) => void } | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const push = useCallback((text: string) => {
    const id = Date.now() + Math.random();
    setItems((xs) => [...xs, { id, text }]);
    setTimeout(() => setItems((xs) => xs.filter((t) => t.id !== id)), 2200);
  }, []);
  const value = useMemo(() => ({ push }), [push]);
  return (
    <Ctx.Provider value={value}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-4 z-[9999] flex justify-center px-3">
        <div className="flex w-full max-w-sm flex-col gap-2">
          {items.map((t) => (
            <div key={t.id} className="pointer-events-auto rounded-lg bg-white/10 px-3 py-2 text-sm shadow-lg backdrop-blur">
              {t.text}
            </div>
          ))}
        </div>
      </div>
    </Ctx.Provider>
  );
}
export function useToast() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx.push;
}
