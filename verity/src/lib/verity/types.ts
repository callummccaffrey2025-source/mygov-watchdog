export type BiasPoint = { outlet: string; score: number; receipts: { url: string; label?: string }[] };
export type ImpactScenario = { title: string; summary: string; receipts: { url: string; label?: string }[] };
export type MPMetric = { mpId: string; metric: string; value: number; receipts: { url: string; label?: string }[] };
export type FactCheckItem = { claimId: string; verdict: 'true'|'false'|'mixed'|'unverified'; receipts: { url: string; label?: string }[] };
