// Shared formatting helpers used across MP pages

/** Title-case a phrase safely */
function titleCase(s: string): string {
  return s
    .toLowerCase()
    .replace(/[_\s]+/g, ' ')
    .trim()
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

/** Accepts Date | string and returns a YYYY-MM-DD string (for machine use) */
export function fmtDate(input: any): string {
  if (!input) return "—";
  try {
    const d = new Date(input);
    if (isNaN(d.getTime())) return String(input);
    // ISO date (no time)
    return d.toISOString().slice(0, 10);
  } catch {
    return String(input);
  }
}

/** Human friendly date in current locale (e.g., 17 Oct 2025) */
export function formatIsoDate(input: any): string {
  if (!input) return "—";
  try {
    const d = new Date(input);
    if (isNaN(d.getTime())) return String(input);
    return d.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return String(input);
  }
}

/** Explicit AU style date (same visual but fixed locale) */
export function formatDateAU(input: any): string {
  if (!input) return "—";
  try {
    const d = new Date(input);
    if (isNaN(d.getTime())) return String(input);
    return d.toLocaleDateString("en-AU", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return String(input);
  }
}

/** Normalise a bill stage to a clean display label */
export function formatStage(raw: string): string {
  if (!raw) return "—";
  const key = raw.toLowerCase().replace(/[\s_/-]+/g, "").replace(/[^\w]/g, "");

  const map: Record<string, string> = {
    firstreading: "First reading",
    secondreading: "Second reading",
    thirdreading: "Third reading",
    secondreadingsummary: "Second reading",
    secondreadingagree: "Second reading",
    considerationindetail: "Consideration in detail",
    committagestage: "Committee stage",
    committeestage: "Committee stage",
    committee: "Committee",
    reportstage: "Report stage",
    assent: "Royal assent",
    passed: "Passed",
  };

  if (map[key]) return map[key];
  return titleCase(raw.replace(/_/g, " ").replace(/\s+/g, " "));
}

// Keep a default bundle for places that do `import format from "@/lib/format"`
const format = { fmtDate, formatIsoDate, formatDateAU, formatStage };
export default format;
