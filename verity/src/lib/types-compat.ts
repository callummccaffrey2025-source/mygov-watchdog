export type MPStatement =
  | string
  | { date?: string; text?: string; excerpt?: string; source?: string; url?: string };

export interface MP {
  slug?: string;
  id: string;
  name: string;
  electorate: string;
  state?: string;
  chamber?: string;
  party: string;
  since?: number;
  attendancePct?: number;
  partyLinePct?: number;
  integrityGrade?: string;
  trustIndex?: number;
  influenceScore?: number;
  recentVotes?: { title: string; position: string }[];

  // --- extras used by MP components (all optional) ---
  headshot?: string;
  roles?: string[];
  bio?: string;
  committees?: string[];
  donors?: { name: string; amount: number; amountAUD?: number; year?: number }[];
  statements?: MPStatement[];
  votes?: {
    title: string;
    position: string;
    date?: string;
    billId?: string;
    billTitle?: string;
    vote?: string;
  }[];
}

export interface Bill {
  id: string;
  title: string;
  introducedBy: string;  // mp id (slug)
  stage: 'Introduced' | 'Second Reading' | 'Committee' | 'Passed' | 'Rejected';
  summary?: string;
  lapsed?: boolean;
  votes?: { mpId: string; mpName: string; vote: 'Aye' | 'No' | 'Abstain' | 'Absent' }[];
  sources?: { label: string; url: string }[];
  predictedPassPct?: number;
  yourMPPosition?: 'For' | 'Against' | 'Abstain' | '-';
}
