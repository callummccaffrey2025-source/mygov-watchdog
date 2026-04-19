import { Platform } from 'react-native';

// ─── Colours ─────────────────────────────────────────────
export const LIGHT = {
  paper: '#F5F3EF',
  card: '#FEFDFB',
  textPrimary: '#1A1A17',
  textSecondary: 'rgba(26,26,23,0.55)',
  textTertiary: 'rgba(26,26,23,0.40)',
  textQuiet: 'rgba(26,26,23,0.30)',
  hairline: 'rgba(26,26,23,0.08)',
  softBorder: 'rgba(26,26,23,0.15)',
  brandGreen: '#00843D',
  semanticAye: '#00843D',
  semanticNo: '#8B1A1A',
  semanticWarning: '#B8841A',
  semanticInfo: '#1A4D7F',
} as const;

export const DARK = {
  paper: '#1A1A17',
  card: '#242420',
  textPrimary: '#FAF8F3',
  textSecondary: 'rgba(250,248,243,0.60)',
  textTertiary: 'rgba(250,248,243,0.45)',
  textQuiet: 'rgba(250,248,243,0.30)',
  hairline: 'rgba(250,248,243,0.08)',
  softBorder: 'rgba(250,248,243,0.15)',
  brandGreen: '#00843D',
  semanticAye: '#2D9F5E',
  semanticNo: '#C75050',
  semanticWarning: '#D4A84B',
  semanticInfo: '#4A8CC7',
} as const;

export type EditorialColors = {
  paper: string;
  card: string;
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  textQuiet: string;
  hairline: string;
  softBorder: string;
  brandGreen: string;
  semanticAye: string;
  semanticNo: string;
  semanticWarning: string;
  semanticInfo: string;
};

// Bias spectrum — data viz only, never in UI chrome
export const BIAS = {
  left: '#2563EB',
  leanLeft: '#60A5FA',
  centre: '#6B7280',
  leanRight: '#F87171',
  right: '#DC2626',
} as const;

// ─── Typography ──────────────────────────────────────────
const SERIF_FAMILY = Platform.select({
  ios: 'Georgia',
  default: 'serif',
});

export const TYPE = {
  heroHeadline: {
    fontFamily: SERIF_FAMILY,
    fontSize: 34,
    lineHeight: 36,
    fontWeight: '400' as const,
    letterSpacing: -0.02 * 34,
  },
  h1: {
    fontFamily: SERIF_FAMILY,
    fontSize: 24,
    lineHeight: 28,
    fontWeight: '400' as const,
    letterSpacing: -0.01 * 24,
  },
  h2: {
    fontFamily: SERIF_FAMILY,
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '400' as const,
    letterSpacing: -0.01 * 20,
  },
  h3: {
    fontFamily: SERIF_FAMILY,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '400' as const,
    letterSpacing: -0.005 * 17,
  },
  statNumber: {
    fontFamily: SERIF_FAMILY,
    fontSize: 28,
    lineHeight: 30,
    fontWeight: '400' as const,
    letterSpacing: -0.02 * 28,
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '400' as const,
    letterSpacing: 0,
  },
  label: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '400' as const,
    letterSpacing: 0.01 * 13,
  },
  meta: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '400' as const,
    letterSpacing: 0.01 * 12,
  },
  caption: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '500' as const,
    letterSpacing: 0.04 * 11,
    textTransform: 'uppercase' as const,
  },
  button: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500' as const,
    letterSpacing: -0.01 * 14,
  },
} as const;

// ─── Spacing (8-point grid) ──────────────────────────────
export const SPACE = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  '2xl': 28,
  '3xl': 32,
  '4xl': 40,
  '5xl': 48,
  '6xl': 56,
  '7xl': 64,
  '8xl': 80,
} as const;

export const LAYOUT = {
  screenPadding: 20,
  cardPadding: 20,
  sectionGap: 28,
  itemGap: 12,
  inlineGap: 8,
  hairlineHeight: 0.5,
  cardRadius: 20,
  buttonRadius: 12,
  badgeRadius: 4,
} as const;
