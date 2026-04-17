export type Prefs = {
  mps: string[];
  bills: string[];
  topics: string[];
};

const KEY = "verity_prefs_v1";

function safeParse(x: unknown): Prefs {
  try {
    const o = typeof x === "string" ? JSON.parse(x) : {};
    const arr = (v: unknown) => (Array.isArray(v) ? v.filter((s) => typeof s === "string") : []);
    return {
      mps: arr((o as { mps?: unknown }).mps),
      bills: arr((o as { bills?: unknown }).bills),
      topics: arr((o as { topics?: unknown }).topics),
    };
  } catch {
    return { mps: [], bills: [], topics: [] };
  }
}

export function getPrefs(): Prefs {
  if (typeof window === "undefined") return { mps: [], bills: [], topics: [] };
  return safeParse(window.localStorage.getItem(KEY));
}

export function setPrefs(next: Prefs): void {
  if (typeof window === "undefined") return;
  const norm: Prefs = {
    mps: [...new Set(next.mps.filter(Boolean))],
    bills: [...new Set(next.bills.filter(Boolean))],
    topics: [...new Set(next.topics.filter(Boolean))],
  };
  window.localStorage.setItem(KEY, JSON.stringify(norm));
}

function toggle(list: string[], id: string, on?: boolean): string[] {
  const has = list.includes(id);
  if (on === true || (!has && on === undefined)) return [...list, id];
  if (on === false || (has && on === undefined)) return list.filter((x) => x !== id);
  return list;
}

export const prefs = {
  followMP(id: string, on?: boolean) {
    const p = getPrefs();
    setPrefs({ ...p, mps: toggle(p.mps, id, on) });
  },
  followBill(id: string, on?: boolean) {
    const p = getPrefs();
    setPrefs({ ...p, bills: toggle(p.bills, id, on) });
  },
  toggleTopic(id: string, on?: boolean) {
    const p = getPrefs();
    setPrefs({ ...p, topics: toggle(p.topics, id, on) });
  },
};

export function coercePrefs(x: unknown): Prefs { return safeParse(x); }
export function encodeCookie(p: Prefs): string {
  try { return encodeURIComponent(JSON.stringify(p)); } catch { return encodeURIComponent('{"mps":[],"bills":[],"topics":[]}'); }
}
export function decodeCookie(v: string | undefined | null): Prefs {
  if(!v) return { mps:[], bills:[], topics:[] };
  try { return coercePrefs(JSON.parse(decodeURIComponent(v))); } catch { return { mps:[], bills:[], topics:[] }; }
}
