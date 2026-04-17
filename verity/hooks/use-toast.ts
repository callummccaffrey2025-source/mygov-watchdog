import { useState } from "react";
export function useToast(){
  const [toasts, setToasts] = useState<any[]>([]);
  function toast(t:any){ setToasts(s=>[...s, { id: String(Date.now()), ...t }]); }
  return { toast, toasts };
}
