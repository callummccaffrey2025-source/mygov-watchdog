interface FactualityResult {
  color: string;
  label: string;
}

const FACTUALITY_MAP: Record<string, FactualityResult> = {
  very_high:       { color: '#00843D', label: 'Very High' },
  high:            { color: '#22C55E', label: 'High' },
  mostly_factual:  { color: '#EAB308', label: 'Mostly Factual' },
  mixed:           { color: '#F97316', label: 'Mixed' },
  low:             { color: '#DC3545', label: 'Low' },
};

const DEFAULT_RESULT: FactualityResult = { color: '#6B7280', label: 'Unknown' };

function normalize(rating: string): string {
  return rating
    .toLowerCase()
    .trim()
    .replace(/[\s-]+/g, '_');
}

export function getFactualityColor(rating: string): FactualityResult {
  return FACTUALITY_MAP[normalize(rating)] ?? DEFAULT_RESULT;
}
