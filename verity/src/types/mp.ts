export type VoteDecision = "Aye" | "No" | "Abstain" | "Absent";

export interface MPBasic {
  slug: string;                 // e.g., "alba"
  name: string;                 // "Anthony Albanese"
  party: string;                // "Labor"
  electorate: string;           // "Grayndler"
  state: string;                // "NSW"
  headshot_url?: string | null; // CDN/Parliament asset
  party_logo_url?: string | null;
}

export interface MPRole {
  title: string;                // "Prime Minister"
  since?: string | null;        // ISO
}

export interface MPCommittee {
  name: string;
  role?: string | null;         // "Member" | "Chair"
}

export interface MPContactOffice {
  kind: "Parliament" | "Electorate";
  address: string;
  phone?: string | null;
  email?: string | null;
  hours?: string | null;
}

export interface MPCommittee {
  name: string;
  role?: string | null;         // "Member" | "Chair"
}

export interface MPVote {
  bill_id: string;
  bill_title: string;
  stage: string;                // "Second reading"
  date: string;                 // ISO
  decision: VoteDecision;
}

export interface MPNewsItem {
  id: string;
  title: string;
  published_at: string;         // ISO
  url: string;
  source?: string | null;
}

export interface MPProfile extends MPBasic {
  roles: MPRole[];
  committees: MPCommittee[];
  recent_votes: MPVote[];
  news: MPNewsItem[];
  offices?: MPContactOffice[];
}
