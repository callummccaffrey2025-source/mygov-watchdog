export function partyClasses(party?: string) {
  const p = (party || "").toLowerCase();
  if (p.includes("labor")) return "bg-rose-500/20 text-rose-300";
  if (p.includes("liberal") || p.includes("national"))
    return "bg-blue-500/20 text-blue-300";
  if (p.includes("greens")) return "bg-emerald-500/20 text-emerald-300";
  if (p.includes("teal") || p.includes("independent"))
    return "bg-cyan-500/20 text-cyan-300";
  return "bg-white/10 text-white/80";
}
