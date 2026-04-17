export type Toast = { id: string; title?: string; description?: string };
export function ToastViewport(){ return null }
export function ToastProvider({ children }:{ children: React.ReactNode }){ return <>{children}</>; }
export function ToastAction({ altText, children }:{ altText: string; children: React.ReactNode }){ return <>{children}</>; }
export function Toaster(){ return null }
