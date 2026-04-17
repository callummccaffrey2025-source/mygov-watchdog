export type Receipt = { label: string; url: string; source: string; date?: string };

export type Vote = {
  date: string; billId: string; billTitle: string;
  position: 'Aye'|'No'|'Abstain'; division: 'Passed'|'Failed';
  topics: string[]; receipts: Receipt[];
};

export type Committee = { name: string; role: 'Chair'|'Member'; attendancePct?: number };

export type MP = {
  id: string; slug: string; name: string;
  party: 'Labor'|'Liberal'|'National'|'Greens'|'Independent'|'Other';
  chamber: 'House'|'Senate'; electorate: string;
  portraitUrl?: string;
  attendance: { overallPct: number; last12mPct: number; series: Array<[string, number]> };
  rebellions12m: number;
  committees: Committee[]; roles: string[];
  votes: Vote[];
  speeches: { date: string; title: string; url: string; receipts: Receipt[] }[];
  interestsUrl?: string;
  donations?: { amount: number; source: string; date: string; receipts: Receipt[] }[];
  signals: { kind:'FloorCross'|'Investigation'|'Promotion'|'Other'; summary:string; date?:string; receipts:Receipt[] }[];
  receipts: Receipt[];
};
