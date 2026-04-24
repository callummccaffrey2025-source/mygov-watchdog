/**
 * Bill enrichment helpers — derives narrative status, liveness, and stage
 * from existing bill fields without requiring server-side computation.
 *
 * Used by BillCard and BillDetailScreen to show rich status even before
 * the cron-based enrichment runs.
 */

export type NarrativeStatus =
  | 'moving_quickly'
  | 'progressing'
  | 'stalled'
  | 'died_silently'
  | 'became_law'
  | 'defeated'
  | 'unknown';

export type StageKey =
  | 'introduced'
  | 'first_reading'
  | 'committee'
  | 'second_reading'
  | 'third_reading'
  | 'senate_consideration'
  | 'passed'
  | 'failed'
  | 'withdrawn'
  | 'archived';

export interface BillEnrichment {
  isLive: boolean;
  narrativeStatus: NarrativeStatus;
  stageKey: StageKey;
  stageLabel: string;
  narrativeLabel: string;
  daysSinceMovement: number | null;
  statusColor: string; // green/blue/amber/grey
}

const TERMINAL_KEYWORDS = [
  'passed both houses', 'royal assent', 'awaiting assent', 'enacted',
  'defeated', 'not passed', 'withdrawn', 'lapsed', 'in search index', 'historical',
];

export function enrichBill(bill: {
  current_status?: string | null;
  status?: string | null;
  last_updated?: string | null;
  date_introduced?: string | null;
  narrative_status?: string | null;
  is_live?: boolean | null;
  days_since_movement?: number | null;
}): BillEnrichment {
  const raw = (bill.current_status || bill.status || '').toLowerCase().trim();

  // If DB already computed these, use them
  if (bill.narrative_status && bill.narrative_status !== 'unknown' && bill.is_live !== null) {
    return {
      isLive: bill.is_live ?? false,
      narrativeStatus: bill.narrative_status as NarrativeStatus,
      stageKey: deriveStageKey(raw),
      stageLabel: deriveStageLabel(raw),
      narrativeLabel: narrativeToLabel(bill.narrative_status as NarrativeStatus, bill.days_since_movement ?? null),
      daysSinceMovement: bill.days_since_movement ?? null,
      statusColor: narrativeToColor(bill.narrative_status as NarrativeStatus),
    };
  }

  // Compute locally
  const isTerminal = TERMINAL_KEYWORDS.some(kw => raw.includes(kw));
  const isLive = !isTerminal && raw !== '';

  const daysSince = computeDaysSince(bill.last_updated || bill.date_introduced);

  let narrativeStatus: NarrativeStatus = 'unknown';
  if (raw.includes('enacted') || raw.includes('assent') || (raw.includes('passed') && !raw.includes('not passed'))) {
    narrativeStatus = 'became_law';
  } else if (raw.includes('defeated') || raw.includes('not passed')) {
    narrativeStatus = 'defeated';
  } else if (raw.includes('withdrawn') || raw.includes('lapsed') || raw === 'in search index' || raw === 'historical') {
    narrativeStatus = 'died_silently';
  } else if (isLive && daysSince !== null && daysSince <= 14) {
    narrativeStatus = 'moving_quickly';
  } else if (isLive && daysSince !== null && daysSince <= 60) {
    narrativeStatus = 'progressing';
  } else if (isLive && daysSince !== null && daysSince > 60) {
    narrativeStatus = 'stalled';
  }

  const stageKey = deriveStageKey(raw);

  return {
    isLive,
    narrativeStatus,
    stageKey,
    stageLabel: deriveStageLabel(raw),
    narrativeLabel: narrativeToLabel(narrativeStatus, daysSince),
    daysSinceMovement: daysSince,
    statusColor: narrativeToColor(narrativeStatus),
  };
}

function deriveStageKey(status: string): StageKey {
  if (status.includes('enacted') || status.includes('assent') || status.includes('act')) return 'passed';
  if (status.includes('passed') && !status.includes('not passed')) return 'passed';
  if (status.includes('defeated') || status.includes('not passed')) return 'failed';
  if (status.includes('withdrawn')) return 'withdrawn';
  if (status.includes('lapsed') || status === 'in search index' || status === 'historical') return 'archived';
  if (status.includes('third')) return 'third_reading';
  if (status.includes('second') || status.includes('debate')) return 'second_reading';
  if (status.includes('committee') || status.includes('referred') || status.includes('inquiry')) return 'committee';
  if (status.includes('before senate')) return 'senate_consideration';
  if (status.includes('before house') || status.includes('before parliament')) return 'first_reading';
  if (status.includes('first')) return 'first_reading';
  return 'introduced';
}

function deriveStageLabel(status: string): string {
  if (status.includes('enacted')) return 'Enacted';
  if (status.includes('assent') || status.includes('act')) return 'Became law';
  if (status.includes('passed both')) return 'Passed both houses';
  if (status.includes('passed')) return 'Passed';
  if (status.includes('defeated') || status.includes('not passed')) return 'Defeated';
  if (status.includes('withdrawn')) return 'Withdrawn';
  if (status.includes('lapsed')) return 'Lapsed';
  if (status === 'in search index') return 'Archived';
  if (status.includes('third')) return 'Third reading';
  if (status.includes('second')) return 'Second reading';
  if (status.includes('committee') || status.includes('inquiry')) return 'In committee';
  if (status.includes('before parliament')) return 'Before Parliament';
  if (status.includes('before senate')) return 'Before Senate';
  if (status.includes('before house')) return 'Before House';
  if (status.includes('first')) return 'First reading';
  if (status.includes('introduced')) return 'Introduced';
  if (status === 'historical') return 'Historical';
  return 'Introduced';
}

function narrativeToLabel(narrative: NarrativeStatus, days: number | null): string {
  switch (narrative) {
    case 'moving_quickly': return 'Moving quickly';
    case 'progressing': return 'In progress';
    case 'stalled': return days ? `Stalled — no movement in ${days} days` : 'Stalled';
    case 'died_silently': return 'Archived without a vote';
    case 'became_law': return 'Became law';
    case 'defeated': return 'Defeated';
    default: return '';
  }
}

function narrativeToColor(narrative: NarrativeStatus): string {
  switch (narrative) {
    case 'became_law': return '#00843D';
    case 'moving_quickly':
    case 'progressing': return '#2563EB';
    case 'stalled': return '#B45309';
    case 'defeated':
    case 'died_silently': return '#6B7280';
    default: return '#6B7280';
  }
}

function computeDaysSince(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  return Math.max(0, Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24)));
}
