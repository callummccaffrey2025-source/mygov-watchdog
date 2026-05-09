interface StatusColor {
  bg: string;
  text: string;
  label: string;
}

interface StatusColorSet {
  light: StatusColor;
  dark: StatusColor;
}

const STATUS_MAP: Record<string, StatusColorSet> = {
  passed: {
    light: { bg: '#e8f5ee', text: '#00843D', label: 'Passed' },
    dark:  { bg: '#003d1a', text: '#4ade80', label: 'Passed' },
  },
  royal_assent: {
    light: { bg: '#e8f5ee', text: '#00843D', label: 'Royal Assent' },
    dark:  { bg: '#003d1a', text: '#4ade80', label: 'Royal Assent' },
  },
  defeated: {
    light: { bg: '#fdecea', text: '#DC3545', label: 'Defeated' },
    dark:  { bg: '#3d1a1a', text: '#f87171', label: 'Defeated' },
  },
  withdrawn: {
    light: { bg: '#fdecea', text: '#DC3545', label: 'Withdrawn' },
    dark:  { bg: '#3d1a1a', text: '#f87171', label: 'Withdrawn' },
  },
  lapsed: {
    light: { bg: '#fdecea', text: '#DC3545', label: 'Lapsed' },
    dark:  { bg: '#3d1a1a', text: '#f87171', label: 'Lapsed' },
  },
  introduced: {
    light: { bg: '#dbeafe', text: '#2563EB', label: 'Introduced' },
    dark:  { bg: '#1e2a4a', text: '#60a5fa', label: 'Introduced' },
  },
  first_reading: {
    light: { bg: '#dbeafe', text: '#2563EB', label: 'First Reading' },
    dark:  { bg: '#1e2a4a', text: '#60a5fa', label: 'First Reading' },
  },
  second_reading: {
    light: { bg: '#dbeafe', text: '#2563EB', label: 'Second Reading' },
    dark:  { bg: '#1e2a4a', text: '#60a5fa', label: 'Second Reading' },
  },
  committee: {
    light: { bg: '#fef3c7', text: '#b45309', label: 'In Committee' },
    dark:  { bg: '#3d2e0a', text: '#fbbf24', label: 'In Committee' },
  },
  referred: {
    light: { bg: '#fef3c7', text: '#b45309', label: 'Referred' },
    dark:  { bg: '#3d2e0a', text: '#fbbf24', label: 'Referred' },
  },
  active: {
    light: { bg: '#e8f5ee', text: '#00843D', label: 'Active' },
    dark:  { bg: '#003d1a', text: '#4ade80', label: 'Active' },
  },
  current: {
    light: { bg: '#e8f5ee', text: '#00843D', label: 'Current' },
    dark:  { bg: '#003d1a', text: '#4ade80', label: 'Current' },
  },
};

const DEFAULT_COLOR: StatusColorSet = {
  light: { bg: '#f3f4f6', text: '#6b7280', label: 'Unknown' },
  dark:  { bg: '#243040', text: '#9aabb8', label: 'Unknown' },
};

function normalize(status: string): string {
  return status
    .toLowerCase()
    .trim()
    .replace(/[\s-]+/g, '_');
}

export function getStatusColor(
  status: string,
  isDark = false,
): { bg: string; text: string; label: string } {
  const key = normalize(status);
  const entry = STATUS_MAP[key] ?? DEFAULT_COLOR;
  return isDark ? entry.dark : entry.light;
}
