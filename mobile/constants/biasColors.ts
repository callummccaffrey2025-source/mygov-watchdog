const BIAS_MAP: Record<string, string> = {
  left:          '#2563EB',
  lean_left:     '#60A5FA',
  center_left:   '#60A5FA',
  centre_left:   '#60A5FA',
  centre:        '#6B7280',
  center:        '#6B7280',
  lean_right:    '#F87171',
  center_right:  '#F87171',
  centre_right:  '#F87171',
  right:         '#DC2626',
};

const DEFAULT_COLOR = '#6B7280';

function normalize(bias: string): string {
  return bias
    .toLowerCase()
    .trim()
    .replace(/[\s-]+/g, '_');
}

export function getBiasColor(bias: string): string {
  return BIAS_MAP[normalize(bias)] ?? DEFAULT_COLOR;
}
