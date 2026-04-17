import { useToast } from "@/hooks/use-toast";
export default function Toaster(){ const { toasts } = useToast(); return <div>{toasts.length ? null : null}</div>; }
