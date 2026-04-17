export type BillExplainer = {
  slug: string; title: string; summary: string;
  stages: string[]; qas: { q: string; a: string }[]; sources: { title: string; url: string }[];
};
export const BILLS: BillExplainer[] = [
  {
    slug: "privacy-amendment-2025",
    title: "Privacy Amendment Bill 2025",
    summary: "Updates the Privacy Act with stronger consent and penalties.",
    stages: ["Introduced", "Second reading", "Committee", "Report", "Third reading"],
    qas: [
      { q: "Who is affected?", a: "Most Australian entities handling personal data." },
      { q: "When does it start?", a: "Staged commencement over 12 months." },
      { q: "Key changes?", a: "Higher penalties, clearer consent, breach notifications." },
    ],
    sources: [
      { title: "Bill text", url: "#" },
      { title: "Explanatory memorandum", url: "#" }
    ],
  },
];
export function getBill(slug: string){ return BILLS.find(b => b.slug === slug) || null; }
