export type MP = {
  id: string;
  name: string;
  electorate?: string;
  party?: string;
  state?: string;
  headshot?: string;
  roles?: string[];
  donors?: any[];
  votes?: any[];
};
export type Bill = {
  id: string;
  title: string;
  // Fields some pages expect:
  stage?: string;
  introducedBy?: string;
  predictedPassPct?: number;
  yourMPPosition?: string;
  // Legacy fields some older code might reference:
  summary?: string;
  status?: string;
  introduced?: string;
  sponsor?: string;
  progress?: number;
};
export type NewsItem = {
  id: string;
  title: string;
  url?: string;
  date?: string;
};
