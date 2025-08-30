// app/ai/page.tsx
"use client";

import { useRef, useState } from "react";

type Msg = { role: "user" | "assistant"; content: string };

export default function AIPage() {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  async function send() {
    const q = input.trim();
    if (!q) return;
    setMsgs((m) => [...m, { role: "user", content: q }, { role: "assistant", content: "" }]);
    setInput("");

    abortRef.current?.abort();
    abortRef.current = new AbortController();

    const res = await fetch("/api/ask", {
      method: "POST",
      body: JSON.stringify({ question: q }),
      headers: { "content-type": "application/json" },
      signal: abortRef.current.signal,
    });
    if (!res.ok || !res.body) {
      setMsgs((m) => {
        const last = [...m];
        const i = last.findIndex((x, idx) => idx === last.length - 1 && x.role === "assistant");
        if (i >= 0) last[i] = { role: "assistant", content: "Error: failed to get response." };
        return last;
      });
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      setMsgs((m) => {
        const last = [...m];
        const i = last.length - 1;
        if (last[i]?.role === "assistant") last[i] = { role: "assistant", content: last[i].content + chunk };
        return last;
      });
    }
  }

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Ask Verity</h1>
      <div className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="Ask about laws, media releases, Hansard…"
          className="flex-1 h-10 px-3 rounded-md border bg-background"
        />
        <button className="h-10 px-4 rounded-md border" onClick={send}>Ask</button>
      </div>

      <div className="space-y-4">
        {msgs.map((m, i) => (
          <div key={i} className="rounded-md border p-3 text-sm">
            <div className="font-medium mb-1">{m.role === "user" ? "You" : "Verity"}</div>
            <div className="whitespace-pre-wrap">{m.content}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

