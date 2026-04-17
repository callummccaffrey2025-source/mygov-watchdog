export type Change = { slug: string; title: string; date: string; items: string[] };
export const CHANGELOG: Change[] = [
  { slug: "2025-09-10", title: "Diff viewer + CSV", date: "2025-09-10", items: ["Diff viewer", "Explainer CSV", "Auth token mock"] },
  { slug: "2025-09-08", title: "Home polish + pricing", date: "2025-09-08", items: ["Hero refinement", "Pricing revamp"] },
];
