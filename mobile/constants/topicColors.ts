export type TopicKey =
  | 'legislation'
  | 'economy'
  | 'defence'
  | 'health'
  | 'housing'
  | 'climate'
  | 'immigration'
  | 'election'
  | 'politics';

const DEFAULT_BG     = '#F3F4F6';
const DEFAULT_TEXT   = '#5a6a7a';
const DEFAULT_ACCENT = '#374151';
const DEFAULT_ICON   = '📰';

// Pastel backgrounds — for UI chips, pills, category tags
export const TOPIC_BG: Record<TopicKey, string> = {
  legislation: '#E8F5EE',
  economy:     '#FFF3CD',
  defence:     '#E3F2FD',
  health:      '#F3E5F5',
  housing:     '#FFF8E1',
  climate:     '#E8F5E9',
  immigration: '#FCE4EC',
  election:    '#EDE7F6',
  politics:    '#F3F4F6',
};

// Text colors — paired with TOPIC_BG
export const TOPIC_TEXT: Record<TopicKey, string> = {
  legislation: '#00843D',
  economy:     '#856404',
  defence:     '#1565C0',
  health:      '#6A1B9A',
  housing:     '#E65100',
  climate:     '#2E7D32',
  immigration: '#AD1457',
  election:    '#4527A0',
  politics:    '#5a6a7a',
};

// Vibrant accents — for share cards and highlights
export const TOPIC_ACCENT: Record<TopicKey, string> = {
  legislation: '#00843D',
  economy:     '#d97706',
  defence:     '#1d4ed8',
  health:      '#dc2626',
  housing:     '#7c3aed',
  climate:     '#16a34a',
  immigration: '#0891b2',
  election:    '#4527A0',
  politics:    '#374151',
};

// Emoji icons
export const TOPIC_ICON: Record<TopicKey, string> = {
  legislation: '📜',
  economy:     '💹',
  defence:     '🛡️',
  health:      '🏥',
  housing:     '🏠',
  climate:     '🌿',
  immigration: '✈️',
  election:    '🗳️',
  politics:    '🏛️',
};

function normalise(cat: string | null | undefined): TopicKey | null {
  if (!cat) return null;
  const key = cat.toLowerCase().trim() as TopicKey;
  return key in TOPIC_BG ? key : null;
}

export function topicBg(cat: string | null | undefined): string {
  const key = normalise(cat);
  return key ? TOPIC_BG[key] : DEFAULT_BG;
}

export function topicText(cat: string | null | undefined): string {
  const key = normalise(cat);
  return key ? TOPIC_TEXT[key] : DEFAULT_TEXT;
}

export function topicAccent(cat: string | null | undefined): string {
  const key = normalise(cat);
  return key ? TOPIC_ACCENT[key] : DEFAULT_ACCENT;
}

export function topicIcon(cat: string | null | undefined): string {
  const key = normalise(cat);
  return key ? TOPIC_ICON[key] : DEFAULT_ICON;
}
