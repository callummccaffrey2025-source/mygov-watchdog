"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";

/** ========= Env + tiny helpers ========= **/
const B = typeof window !== "undefined" && typeof document !== "undefined";
const clsx = (...xs: any[]) => xs.filter(Boolean).join(" ");
const copy = async (t: string) => {
  if (!B) return false;
  try { await navigator.clipboard.writeText(t); return true; } catch { return false; }
};

/** ========= Minimal internal router (hash) ========= **/
type Route =
  | { name: "landing" }
  | { name: "ask" }
  | { name: "search" }
  | { name: "briefing" }
  | { name: "dashboard" }
  | { name: "sources" }
  | { name: "docs" }
  | { name: "me" };

export const parseHashString = (h: string): Route => {
  const s = (h || "").replace(/^#/, "");
  if (!s || s === "/" || s === "landing") return { name: "landing" };
  if (s.startsWith("ask")) return { name: "ask" };
  if (s.startsWith("search")) return { name: "search" };
  if (s.startsWith("briefing")) return { name: "briefing" };
  if (s.startsWith("dashboard")) return { name: "dashboard" };
  if (s.startsWith("sources")) return { name: "sources" };
  if (s.startsWith("docs")) return { name: "docs" };
  if (s.startsWith("me")) return { name: "me" };
  return { name: "landing" };
};

const parseHash = (): Route => (B ? parseHashString(location.hash) : { name: "landing" });

function useRoute() {
  const [route, setRoute] = useState<Route>(parseHash());
  useEffect(() => {
    if (!B) return;
    const on = () => setRoute(parseHash());
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  const nav = (to: string) => { if (B) location.hash = to; };
  return { route, nav };
}

/** ========= Mock data (small & fast) ========= **/
const RESULTS = [
  { id: "DOC-1", title: "Budget media release", type: "news", jur: "AU", date: "2024-05-14" },
  { id: "DOC-2", title: "Budget Paper No.2 – SMEs", type: "bill", jur: "AU", date: "2024-05-14" },
  { id: "DOC-3", title: "Hansard — Energy QTs", type: "hansard", jur: "AU", date: "2024-05-15" },
] as const;
const MOCK_DIFF = [{ before: "… penalties up to 200 units …", after: "… penalties up to 300 units …" }];

/** ========= App ========= **/
export default function App() {
  const { route, nav } = useRoute();

  // Subscription state (localStorage mock)
  const [sub, setSub] = useState<boolean>(() => {
    try { return B ? JSON.parse(localStorage.getItem("verity.sub") || "false") : false; } catch { return false; }
  });
  const subscribe = () => { setSub(true); try { localStorage.setItem("verity.sub", "true"); } catch {} };
  const unsubscribe = () => { setSub(false); try { localStorage.setItem("verity.sub", "false"); } catch {} };

  // Toasts
  const [toast, setToast] = useState<string | null>(null);
  useEffect(() => { if (!toast) return; const id = setTimeout(() => setToast(null), 1500); return () => clearTimeout(id); }, [toast]);

  // Keyboard shortcuts: '/' focus search, g s → Search, g d → Dashboard, g a → Ask, g b → Briefing
  const gRef = useRef(false);
  const timerRef = useRef<number | undefined>(undefined as any);
  useEffect(() => {
    if (!B) return;
    const on = (e: KeyboardEvent) => {
      if (e.key === "/") {
        const el = document.getElementById("search-input") as HTMLInputElement | null;
        if (el) { e.preventDefault(); el.focus(); setToast("Focus: Search"); }
        return;
      }
      if (e.key.toLowerCase() === "g") {
        gRef.current = true;
        if (timerRef.current) window.clearTimeout(timerRef.current);
        timerRef.current = window.setTimeout(() => { gRef.current = false; }, 800);
        return;
      }
      const go = (hash: string, msg: string) => { location.hash = hash; setToast(msg); gRef.current = false; if (timerRef.current) window.clearTimeout(timerRef.current); };
      if (gRef.current && e.key.toLowerCase() === "s") return go("search", "Go: Search");
      if (gRef.current && e.key.toLowerCase() === "d") return go("dashboard", "Go: Dashboard");
      if (gRef.current && e.key.toLowerCase() === "a") return go("ask", "Go: Ask");
      if (gRef.current && e.key.toLowerCase() === "b") return go("briefing", "Go: Briefing");
    };
    window.addEventListener("keydown", on);
    return () => { window.removeEventListener("keydown", on); if (timerRef.current) window.clearTimeout(timerRef.current); };
  }, []);

  // Gated routes (fully locked without sub)
  const fullyGated = route.name === "ask" || route.name === "search" || route.name === "dashboard";
  // Briefing is *previewable* (blur) without sub to help conversion.

  return (
    <main className="min-h-[100vh] bg-neutral-950 text-neutral-100">
      <Topbar nav={nav} current={route.name} sub={sub} />
      {/* Keyboard cheat sheet & Toast */}
      <div className="fixed bottom-4 left-4 bg-neutral-800 text-neutral-200 px-3 py-1 rounded-md text-xs opacity-80 hidden sm:block">
        Shortcuts: <kbd className="px-1">/</kbd> focus · <kbd className="px-1">g s</kbd> Search · <kbd className="px-1">g d</kbd> Dashboard · <kbd className="px-1">g a</kbd> Ask · <kbd className="px-1">g b</kbd> Briefing
      </div>
      {toast && <div className="fixed bottom-4 right-4 bg-emerald-500 text-neutral-900 px-4 py-2 rounded-lg text-sm shadow">{toast}</div>}

      <section className="mx-auto max-w-5xl px-4 py-8">
        {fullyGated && !sub ? (
          <Curtain onSub={subscribe} />
        ) : (
          <Switch route={route} onSub={subscribe} onUnsub={unsubscribe} setToast={setToast} sub={sub} />
        )}
      </section>
      <Footer />
    </main>
  );
}

/** ========= Topbar ========= **/
function Topbar({ nav, current, sub }: { nav: (to: string) => void; current: string; sub: boolean }) {
  const Tab = ({ to, label }: { to: string; label: string }) => {
    const active = current === to;
    return (
      <button
        aria-current={active ? "page" : undefined}
        onClick={() => nav(to)}
        className={clsx(
          "px-2 py-1.5 rounded-lg border text-xs sm:text-sm",
          active ? "bg-white/10 border-white/20" : "border-white/10 hover:bg-white/5"
        )}
      >
        {label}
      </button>
    );
  };
  return (
    <header className="sticky top-0 z-10 backdrop-blur border-b border-white/10 bg-neutral-950/70">
      <div className="mx-auto max-w-5xl px-4 h-12 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-emerald-300" />
          <span className="font-semibold">Verity</span>
        </div>
        <nav className="flex gap-2 flex-wrap">
          <Tab to="landing" label="Home" />
          <Tab to="ask" label="Ask" />
          <Tab to="search" label="Search" />
          <Tab to="briefing" label="Briefing" />
          <Tab to="dashboard" label="Dashboard" />
          <Tab to="sources" label="Sources" />
          <Tab to="docs" label="Docs" />
          <Tab to="me" label={sub ? "Account" : "Subscribe"} />
        </nav>
        <span className="hidden sm:inline rounded-lg border border-emerald-400/40 text-emerald-300 px-2 py-1 text-xs">$1/mo</span>
      </div>
    </header>
  );
}

/** ========= Switch ========= **/
function Switch({
  route,
  onSub,
  onUnsub,
  setToast,
  sub,
}: {
  route: Route;
  onSub: () => void;
  onUnsub: () => void;
  setToast: (m: string) => void;
  sub: boolean;
}) {
  if (route.name === "ask") return <Ask setToast={setToast} />;
  if (route.name === "search") return <Search setToast={setToast} />;
  if (route.name === "briefing") return <Briefing setToast={setToast} sub={sub} />;
  if (route.name === "dashboard") return <Dashboard />;
  if (route.name === "sources") return <Sources />;
  if (route.name === "docs") return <Docs />;
  if (route.name === "me") return <Account sub={sub} onSub={onSub} onUnsub={onUnsub} />;
  return <Landing onSub={onSub} />;
}

/** ========= Paywall ========= **/
function Curtain({ onSub }: { onSub: () => void }) {
  return (
    <div className="rounded-2xl border border-emerald-400/40 bg-neutral-900/80 p-8 text-center">
      <h2 className="text-2xl font-semibold">Subscribe to unlock</h2>
      <p className="mt-2 text-neutral-400 text-sm">Unlimited access to Verity for just $1/month. Cancel anytime.</p>
      <button
        onClick={onSub}
        className="mt-4 rounded-xl bg-emerald-400 text-neutral-900 px-5 py-3 font-semibold hover:bg-emerald-300"
      >
        Subscribe $1/mo
      </button>
    </div>
  );
}

/** ========= Landing ========= **/
function Landing({ onSub }: { onSub: () => void }) {
  return (
    <div>
      <h1 className="text-3xl sm:text-5xl font-semibold tracking-tight">
        Watch the politicians <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-300 to-blue-400">so you don’t have to</span>
      </h1>
      <p className="mt-3 text-neutral-300 max-w-2xl">
        Unified Hansard, bills, media releases, agencies and courts. AI briefings with citations.
      </p>
      <div className="mt-5 flex gap-3 flex-wrap">
        <button
          onClick={onSub}
          className="rounded-xl bg-emerald-400 text-neutral-900 px-5 py-3 font-semibold hover:bg-emerald-300"
        >
          Subscribe $1/mo
        </button>
        <a href="#briefing" className="rounded-xl border border-white/15 px-5 py-3 font-semibold hover:bg-white/5">
          View Briefing (preview)
        </a>
      </div>
      <div className="mt-6 grid gap-2 sm:grid-cols-3">
        <ValueCard title="Daily briefings" sub="AI summaries with sources" />
        <ValueCard title="Watchlist alerts" sub="Track words & topics" />
        <ValueCard title="$1/month" sub="No ads. Just signal." />
      </div>
    </div>
  );
}

function ValueCard({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm">
      <span className="font-medium">{title}</span>
      <div className="text-neutral-400 text-xs">{sub}</div>
    </div>
  );
}

/** ========= Ask ========= **/
function Ask({ setToast }: { setToast: (m: string) => void }) {
  const [q, setQ] = useState("What changed for SMEs in the 2024–25 Budget?");
  const [a, setA] = useState("");
  const [loading, setLoading] = useState(false);

  const run = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!q.trim()) return;
    setLoading(true);
    setA("");
    const parts = [
      "The budget increases asset write-offs, ",
      "extends instant expensing for eligible SMEs, ",
      "and introduces compliance relief.\n\n",
      "Focus areas: energy efficiency grants and penalty unit alignment.",
    ];
    for (const p of parts) { // simulate streaming
      await new Promise((r) => setTimeout(r, 140));
      setA((x) => x + p);
    }
    setLoading(false);
    setToast("Answered");
  };

  return (
    <div>
      <h2 className="text-2xl font-semibold tracking-tight">Hold Power to Account</h2>
      <form onSubmit={run} className="mt-4 rounded-2xl border border-white/10 bg-neutral-900/60 p-3 flex gap-2 items-center">
        <input
          value={q}
          onChange={(e) => setQ((e.target as HTMLInputElement).value)}
          className="flex-1 bg-transparent outline-none"
          placeholder="Ask about a bill, speech, promise, vote, or claim…"
        />
        <button
          className="rounded-lg bg-emerald-400 text-neutral-900 px-3 py-2 text-sm font-semibold hover:bg-emerald-300"
          disabled={loading}
        >
          {loading ? "Asking…" : "Ask"}
        </button>
      </form>
      <article className={clsx("mt-4 rounded-2xl border border-white/10 bg-white/5 p-5 min-h-[140px]", loading && "animate-pulse")}>
        <div className="text-sm text-neutral-400">Answer (with pointers)</div>
        <div className="mt-2 whitespace-pre-wrap">{a || (loading ? "Thinking…" : "")}</div>
        {!loading && a && (
          <ul className="mt-3 text-xs text-neutral-400 list-disc pl-5">
            <li>Budget Paper No.2 — SMEs</li>
            <li>Hansard QTs 15 May</li>
            <li>Gazette 14 May</li>
          </ul>
        )}
      </article>
    </div>
  );
}

/** ========= Search ========= **/
function Search({ setToast }: { setToast: (m: string) => void }) {
  const [q, setQ] = useState("budget");
  const res = useMemo(() => RESULTS.filter((r) => r.title.toLowerCase().includes(q.toLowerCase())), [q]);
  const [saved, setSaved] = useState(false);
  const LS_WATCH = "verity.watch";
  const addTerm = () => {
    try {
      if (B) {
        const arr = JSON.parse(localStorage.getItem(LS_WATCH) || "[]");
        if (!arr.includes(`search:${q}`)) {
          arr.unshift(`search:${q}`);
          localStorage.setItem(LS_WATCH, JSON.stringify(arr.slice(0, 50)));
        }
        setSaved(true);
        setToast("Saved to Watchlist");
      }
    } catch {}
  };
  return (
    <div>
      <h2 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
        Track Every Word & Vote{" "}
        <button onClick={addTerm} className="text-xs rounded-lg border border-white/15 px-2 py-1 hover:bg-white/10">
          Watch this term
        </button>
      </h2>
      {saved && <div className="mt-2 text-xs text-emerald-300">Added to your Watchlist (Dashboard)</div>}
      <form onSubmit={(e) => e.preventDefault()} className="mt-3 flex gap-2">
        <input
          id="search-input"
          value={q}
          onChange={(e) => setQ((e.target as HTMLInputElement).value)}
          className="flex-1 rounded-lg border border-white/15 bg-white/5 px-3 py-2 outline-none"
          placeholder="Search Hansard, bills, media releases…"
        />
      </form>
      <ul className="mt-4 divide-y divide-white/10 rounded-2xl border border-white/10 bg-white/5">
        {res.map((r) => (
          <li key={r.id} className="p-4 flex flex-col gap-2">
            <div className="font-medium">{r.title}</div>
            <div className="text-xs text-neutral-400">
              {r.jur} • {r.date}
            </div>
            {r.type === "bill" && <Diff before={MOCK_DIFF[0].before} after={MOCK_DIFF[0].after} />}
          </li>
        ))}
        {res.length === 0 && <li className="p-4 text-xs text-neutral-500">No results. Try a different term.</li>}
      </ul>
    </div>
  );
}

function Diff({ before, after }: { before: string; after: string }) {
  return (
    <div className="text-xs bg-neutral-900/50 border border-white/10 rounded p-2">
      <div>
        <span className="text-red-400 line-through">{before}</span>
      </div>
      <div>
        <span className="text-emerald-400">{after}</span>
      </div>
    </div>
  );
}

/** ========= Briefing (previewable when unsubscribed) ========= **/
function Briefing({ setToast, sub }: { setToast: (m: string) => void; sub: boolean }) {
  const [followed, setFollowed] = useState(() => {
    try { if (!B) return false; const arr = JSON.parse(localStorage.getItem("verity.watch") || ""); return Array.isArray(arr) && arr.includes("topic:budget"); }
    catch { return false; }
  });

  const toggleFollow = () => {
    try {
      if (!B) return;
      const key = "verity.watch";
      const arr = JSON.parse(localStorage.getItem(key) || "[]");
      if (followed) {
        const nxt = arr.filter((x: string) => x !== "topic:budget");
        localStorage.setItem(key, JSON.stringify(nxt));
        setFollowed(false);
        setToast("Unfollowed topic");
      } else {
        if (!arr.includes("topic:budget")) arr.unshift("topic:budget");
        localStorage.setItem(key, JSON.stringify(arr.slice(0, 50)));
        setFollowed(true);
        setToast("Followed topic");
      }
    } catch {}
  };

  const share = async () => { const ok = await copy("https://verity.run/b/demo"); setToast(ok ? "Link copied" : "Copy failed"); };

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold tracking-tight">Budget 2024–25 Briefing</h2>
        <div className="flex items-center gap-2">
          <button onClick={toggleFollow} className="rounded-lg border border-white/10 px-3 py-2 text-sm hover:bg-white/10">
            {followed ? "Unfollow" : "Follow"}
          </button>
          <button onClick={share} className="rounded-lg border border-white/10 px-3 py-2 text-sm hover:bg-white/10">
            Share
          </button>
        </div>
      </div>

      <div className={clsx("mt-4 rounded-2xl border border-white/10 bg-white/5 p-4", !sub && "blur-sm pointer-events-none select-none")}>
        <p className="text-sm">Summary of SME measures, compliance relief and energy efficiency grants.</p>
        <ul className="mt-3 text-sm list-disc pl-5">
          <li>SME asset write-offs extended</li>
          <li>Penalty units increased</li>
          <li>Energy efficiency grants expanded</li>
        </ul>
        <div className="mt-3 text-xs text-neutral-400">Sources: Budget Paper No.2; Hansard QT 15 May; Gazette 14 May</div>
      </div>
      {!sub && <p className="mt-2 text-xs text-neutral-400">Subscribe $1/month to unlock full briefings.</p>}
    </div>
  );
}

/** ========= Dashboard ========= **/
function Dashboard() {
  const LS_WATCH = "verity.watch";
  const [items, setItems] = useState<string[]>(() => {
    try { return B ? JSON.parse(localStorage.getItem(LS_WATCH) || "[]") : []; } catch { return []; }
  });

  const terms = items.filter((x) => x.startsWith("search:"));
  const topics = items.filter((x) => x.startsWith("topic:"));

  const remove = (x: string) => {
    const nxt = items.filter((t) => t !== x);
    setItems(nxt);
    try { if (B) localStorage.setItem(LS_WATCH, JSON.stringify(nxt)); } catch {}
  };
  const open = (x: string) => {
    const term = x.replace("search:", "");
    try { if (B) { localStorage.setItem("verity.lastQuery", term); location.hash = "search"; } } catch {}
  };

  return (
    <div>
      <h2 className="text-2xl font-semibold tracking-tight">Your Watchlist</h2>
      <p className="text-neutral-400 text-sm">Saved searches & followed topics.</p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="font-medium">Saved terms</div>
          {terms.length === 0 ? (
            <p className="text-sm text-neutral-400 mt-1">
              Nothing yet. Go to <a href="#search" className="underline">Search</a> and click “Watch this term”.
            </p>
          ) : (
            <ul className="mt-2 space-y-2">
              {terms.map((x) => (
                <li key={x} className="flex items-center justify-between text-sm">
                  <span className="truncate">{x.replace("search:", "")}</span>
                  <div className="flex gap-2">
                    <button onClick={() => open(x)} className="text-xs rounded-lg border border-white/10 px-2 py-1 hover:bg-white/10">Open</button>
                    <button onClick={() => remove(x)} className="text-xs rounded-lg border border-white/10 px-2 py-1 hover:bg-white/10">Remove</button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="font-medium">Followed topics</div>
          {topics.length === 0 ? (
            <p className="text-sm text-neutral-400 mt-1">
              Follow from <a href="#briefing" className="underline">Briefing</a>.
            </p>
          ) : (
            <ul className="mt-2 space-y-2">
              {topics.map((x) => (
                <li key={x} className="flex items-center justify-between text-sm">
                  <span className="truncate">{x.replace("topic:", "")}</span>
                  <div className="flex gap-2">
                    <a href="#briefing" className="text-xs rounded-lg border border-white/10 px-2 py-1 hover:bg-white/10">Open</a>
                    <button onClick={() => remove(x)} className="text-xs rounded-lg border border-white/10 px-2 py-1 hover:bg-white/10">Unfollow</button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

/** ========= Sources (marketing) ========= **/
function Sources() {
  const rows = [
    { name: "Hansard", type: "Parliamentary debate transcripts" },
    { name: "Bills & Acts", type: "Legislation lifecycle, amendments" },
    { name: "Media Releases", type: "Ministerial, departmental announcements" },
    { name: "Agencies", type: "Guidance, notices, consultations" },
    { name: "Courts", type: "High-impact judgments, summaries" },
  ];
  return (
    <div>
      <h2 className="text-2xl font-semibold tracking-tight">Sources</h2>
      <p className="text-neutral-400 text-sm">We aggregate across government so you can verify at a glance.</p>
      <ul className="mt-4 rounded-2xl border border-white/10 bg-white/5 divide-y divide-white/10">
        {rows.map((r) => (
          <li key={r.name} className="p-4 flex items-center justify-between text-sm">
            <span className="font-medium">{r.name}</span>
            <span className="text-neutral-400">{r.type}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** ========= Docs (marketing) ========= **/
function Docs() {
  const curl = `curl https://api.verity.run/v1/search \\
  -H "Authorization: Bearer $VERITY_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"q":"penalty units budget 2024","limit":5}'`;
  return (
    <div>
      <h2 className="text-2xl font-semibold tracking-tight">API Docs (preview)</h2>
      <p className="text-neutral-400 text-sm">Integrate Verity into your newsroom or legal workflow.</p>
      <pre className="mt-4 text-xs rounded-2xl border border-white/10 bg-white/5 p-4 overflow-auto whitespace-pre-wrap">{curl}</pre>
      <p className="text-xs text-neutral-500 mt-2">Full docs available for subscribers.</p>
    </div>
  );
}

/** ========= Account ========= **/
function Account({ sub, onSub, onUnsub }: { sub: boolean; onSub: () => void; onUnsub: () => void }) {
  return (
    <div>
      <h2 className="text-2xl font-semibold tracking-tight">{sub ? "Your Subscription" : "Subscribe to Verity"}</h2>
      <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-medium">{sub ? "Active — $1/month" : "Verity Pro — $1/month"}</div>
            <div className="text-xs text-neutral-400">Daily briefings, watchlist alerts, citations</div>
          </div>
          {sub ? (
            <button onClick={onUnsub} className="rounded-lg border border-white/10 px-3 py-2 text-sm hover:bg-white/10">Cancel</button>
          ) : (
            <button onClick={onSub} className="rounded-lg bg-emerald-400 text-neutral-900 px-3 py-2 text-sm font-semibold hover:bg-emerald-300">
              Subscribe
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/** ========= Footer ========= **/
function Footer() {
  return (
    <footer className="py-8 border-t border-white/10">
      <div className="mx-auto max-w-5xl px-4 text-sm text-neutral-400 flex items-center justify-between">
        <span>Preview — Verity</span>
        <span className="opacity-70">$1/mo</span>
      </div>
    </footer>
  );
}

/** ========= Tiny self-tests (console) ========= **/
;(function runSelfTests() {
  try {
    const T = (name: string, ok: boolean) => { if (!B) return; (console as any)[ok ? "log" : "error"](`[test] ${ok ? "PASS" : "FAIL"} ${name}`); };
    T("parseHashString('') → landing", parseHashString("").name === "landing");
    T("parseHashString('#ask') → ask", parseHashString("#ask").name === "ask");
    T("parseHashString('#search') → search", parseHashString("#search").name === "search");
    T("parseHashString('#briefing') → briefing", parseHashString("#briefing").name === "briefing");
    T("parseHashString('#dashboard') → dashboard", parseHashString("#dashboard").name === "dashboard");
    T("parseHashString('#sources') → sources", parseHashString("#sources").name === "sources");
    T("parseHashString('#docs') → docs", parseHashString("#docs").name === "docs");
    T("parseHashString('#me') → me", parseHashString("#me").name === "me");
  } catch (e) { if (B) console.error("[test] exception", e); }
})();
