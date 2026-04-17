export type Release = { id: string; title: string; date: string; source: string; url: string };
export type Article = { id: string; title: string; date: string; outlet: string; url: string; relatedReleaseId?: string };

export const RELEASES: Release[] = [
  { id: "r1", title: "Minister announces privacy reform", date: "2025-09-08", source: "AGD", url: "#" },
  { id: "r2", title: "Treasurer updates budget outlook", date: "2025-09-07", source: "Treasury", url: "#" },
];

export const ARTICLES: Article[] = [
  { id: "a1", title: "Explainer: Privacy changes", date: "2025-09-09", outlet: "The Age", url: "#", relatedReleaseId: "r1" },
  { id: "a2", title: "Budget outlook: what changed", date: "2025-09-08", outlet: "ABC", url: "#", relatedReleaseId: "r2" },
];
