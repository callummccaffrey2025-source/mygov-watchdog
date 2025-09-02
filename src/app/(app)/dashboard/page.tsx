"use client";
import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase";

export default function Dashboard() {
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    const sb = supabaseBrowser();
    sb.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
  }, []);

  async function signOut() {
    const sb = supabaseBrowser();
    await sb.auth.signOut();
    location.href = "/";
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold">Verity Dashboard</h1>
      <p className="mt-3 opacity-80">{email ? `Signed in as ${email}` : "Signed in."}</p>
      <button onClick={signOut} className="mt-6 rounded-lg border px-3 py-2">Sign out</button>
    </div>
  );
}
