/**
 * Industry classification taxonomy — 27 industries from OPAX
 * (jaketracey/opax) adapted for Australian political donations.
 */

export const INDUSTRY_LABELS: Record<string, string> = {
  gambling: 'Gambling',
  mining: 'Mining & Resources',
  fossil_fuels: 'Fossil Fuels',
  energy: 'Energy',
  property: 'Property & Construction',
  finance: 'Banking & Finance',
  lobbying: 'Lobbying',
  legal: 'Legal',
  hospitality: 'Hospitality',
  media: 'Media',
  unions: 'Unions',
  telecom: 'Telecommunications',
  pharmacy: 'Pharmaceuticals',
  health: 'Health',
  alcohol: 'Alcohol',
  tobacco: 'Tobacco',
  tech: 'Technology',
  agriculture: 'Agriculture',
  retail: 'Retail',
  defence: 'Defence',
  transport: 'Transport',
  education: 'Education',
  government: 'Government',
  party_internal: 'Party Internal',
  security: 'Security',
  waste_management: 'Waste Management',
  adult_entertainment: 'Adult Entertainment',
  individual: 'Individual',
  unidentified: 'Unidentified',
  other: 'Other',
};

export const INDUSTRY_COLORS: Record<string, string> = {
  gambling: '#DC2626',
  mining: '#92400E',
  fossil_fuels: '#78350F',
  energy: '#F59E0B',
  property: '#7C3AED',
  finance: '#2563EB',
  lobbying: '#6B7280',
  legal: '#1F2937',
  hospitality: '#EC4899',
  media: '#8B5CF6',
  unions: '#0EA5E9',
  telecom: '#06B6D4',
  pharmacy: '#10B981',
  health: '#059669',
  alcohol: '#B45309',
  tobacco: '#991B1B',
  tech: '#6366F1',
  agriculture: '#16A34A',
  retail: '#F97316',
  defence: '#475569',
  transport: '#0284C7',
  education: '#7C3AED',
  government: '#4B5563',
  party_internal: '#9CA3AF',
  security: '#374151',
  waste_management: '#65A30D',
  adult_entertainment: '#BE185D',
  individual: '#6B7280',
  unidentified: '#D1D5DB',
  other: '#9CA3AF',
};

export const INDUSTRY_ICONS: Record<string, string> = {
  gambling: 'dice-outline',
  mining: 'hammer-outline',
  fossil_fuels: 'flame-outline',
  energy: 'flash-outline',
  property: 'home-outline',
  finance: 'cash-outline',
  lobbying: 'megaphone-outline',
  legal: 'briefcase-outline',
  hospitality: 'restaurant-outline',
  media: 'newspaper-outline',
  unions: 'people-outline',
  telecom: 'call-outline',
  pharmacy: 'medkit-outline',
  health: 'heart-outline',
  alcohol: 'wine-outline',
  tobacco: 'ban-outline',
  tech: 'code-slash-outline',
  agriculture: 'leaf-outline',
  retail: 'cart-outline',
  defence: 'shield-outline',
  transport: 'airplane-outline',
  education: 'school-outline',
  government: 'flag-outline',
  party_internal: 'git-branch-outline',
  security: 'lock-closed-outline',
  waste_management: 'trash-outline',
  adult_entertainment: 'warning-outline',
  individual: 'person-outline',
  unidentified: 'help-outline',
  other: 'ellipsis-horizontal-outline',
};

export function getIndustryLabel(key: string | null | undefined): string {
  if (!key) return 'Unknown';
  return INDUSTRY_LABELS[key] ?? key;
}

export function getIndustryColor(key: string | null | undefined): string {
  if (!key) return '#9CA3AF';
  return INDUSTRY_COLORS[key] ?? '#9CA3AF';
}
