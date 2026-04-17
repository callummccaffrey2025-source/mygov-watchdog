export type MP = {
  id: string;
  name: string;
  electorate?: string;
  party?: string;
  state?: string;
  headshot?: string;
  roles?: string[];
  donors?: Array<{ name?: string; amount?: number; date?: string } | Record<string, any>>;
  votes?: Array<{ billId?: string; motion?: string; vote?: "Aye" | "No" | "Abstain" | string; date?: string } | Record<string, any>>;
};

export type Bill = {
  id: string;
  title: string;
  /** UI/UX fields the app references */
  stage?: string;
  introduced?: string;
  sponsor?: string;
  progress?: number;
  predictedPassPct?: number;
  yourMPPosition?: string;
  /** compat with sample-data.ts */
  summary?: string;
  status?: string;
};

export type NewsItem = {
  id: string;
  title: string;
  url?: string;
  /** app reads as item.date; allow published too for sample data */
  date?: string;
  published?: string;
  source?: string;
  topic?: string;
};
