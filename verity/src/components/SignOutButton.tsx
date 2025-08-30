"use client";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
export default function SignOutButton() {
  const router = useRouter();
  return (
    <button className="border rounded-lg px-3 py-2" onClick={async ()=>{
      await supabaseBrowser.auth.signOut(); router.refresh();
    }}>Sign out</button>
  );
}
