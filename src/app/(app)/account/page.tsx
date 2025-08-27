"use client";
import { useState } from "react";
import { supabase } from "../../../lib/supabase";

export default function Account() {
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  async function sendMagic() {
    setMsg("Sending…");
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001" }
    });
    setMsg(error ? `Error: ${error.message}` : "Check your email for the magic link.");
  }

  return (
    <div style={{maxWidth:420}}>
      <h1>Account</h1>
      <input
        placeholder="you@example.com"
        type="email"
        value={email}
        onChange={e=>setEmail(e.target.value)}
        style={{padding:"8px", width:"100%", marginBottom:"8px"}}
      />
      <button onClick={sendMagic} style={{padding:"8px 12px"}}>Send magic link</button>
      {msg && <p>{msg}</p>}
    </div>
  );
}
