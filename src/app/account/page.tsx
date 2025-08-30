"use client";

import { useState } from "react";

export default function AccountPage() {
  const [userId, setUserId] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);

  async function goCheckout() {
    setBusy(true);
    const r = await fetch("/api/stripe/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId, email }),
    }).then(r => r.json());
    setBusy(false);
    if (r?.url) window.location.href = r.url;
    else alert(r?.error || "failed");
  }

  async function goPortal() {
    setBusy(true);
    const r = await fetch("/api/stripe/portal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId }),
    }).then(r => r.json());
    setBusy(false);
    if (r?.url) window.location.href = r.url;
    else alert(r?.error || "failed");
  }

  return (
    <main className="mx-auto max-w-xl p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Account</h1>

      <input
        placeholder="User ID (temporary)"
        className="w-full rounded-xl border px-4 py-3"
        value={userId}
        onChange={e => setUserId(e.target.value)}
      />
      <input
        placeholder="Email (for Stripe customer)"
        className="w-full rounded-xl border px-4 py-3"
        value={email}
        onChange={e => setEmail(e.target.value)}
      />

      <div className="flex gap-3">
        <button disabled={busy} onClick={goCheckout} className="rounded-xl border px-4 py-3">
          Subscribe $1/mo
        </button>
        <button disabled={busy} onClick={goPortal} className="rounded-xl border px-4 py-3">
          Manage billing
        </button>
      </div>

      <p className="text-sm opacity-60">
        Temporary flow: enter your internal user_id + email to create a Stripe customer and subscription.
      </p>
    </main>
  );
}
