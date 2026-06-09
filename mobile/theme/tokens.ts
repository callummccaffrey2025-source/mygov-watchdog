// theme/tokens.ts
// ─────────────────────────────────────────────────────────────────────────────
// VERITY DESIGN TOKENS — the single source of truth for spacing, type, colour,
// radius, motion, and elevation. Nothing in the app should hardcode a value
// that exists here. If you find yourself typing a raw number for padding,
// a hex code for colour, or a fontSize, STOP and use a token instead.
//
// HARD CONSTRAINT: StyleSheet.create does NOT render in Expo Go for this
// project. Every token below is a plain value or plain object, designed to be
// spread INLINE on JSX elements:
//
//   <View style={{ padding: spacing.lg, backgroundColor: colors.surface }} />
//   <Text style={[typography.heading, { color: colors.textPrimary }]} />
//
// Never wrap these in StyleSheet.create. Inline only.
// ─────────────────────────────────────────────────────────────────────────────

import type { TextStyle, ViewStyle } from 'react-native';

// ─── SPACING ─────────────────────────────────────────────────────────────────
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
  xxxxl: 64,
} as const;

// ─── RADII ───────────────────────────────────────────────────────────────────
export const radius = {
  sm: 8,
  md: 14,
  lg: 24,
  pill: 999,
} as const;

// ─── TYPOGRAPHY ───────────────────────────────────────────────────────────────
export const typography = {
  display: { fontSize: 34, lineHeight: 40, fontWeight: '700', letterSpacing: -0.5 } as TextStyle,
  title: { fontSize: 24, lineHeight: 30, fontWeight: '700', letterSpacing: -0.3 } as TextStyle,
  heading: { fontSize: 20, lineHeight: 26, fontWeight: '600', letterSpacing: -0.2 } as TextStyle,
  body: { fontSize: 16, lineHeight: 24, fontWeight: '400', letterSpacing: 0 } as TextStyle,
  callout: { fontSize: 15, lineHeight: 22, fontWeight: '500', letterSpacing: 0 } as TextStyle,
  label: { fontSize: 13, lineHeight: 18, fontWeight: '600', letterSpacing: 0.2 } as TextStyle,
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '500', letterSpacing: 0.3 } as TextStyle,
} as const;

export const tabularNums: { fontVariant: ('tabular-nums')[] } = {
  fontVariant: ['tabular-nums'],
};

// ─── COLOUR ───────────────────────────────────────────────────────────────────
export const lightColors = {
  background: '#F6F6F4',
  surface: '#FFFFFF',
  surfaceMuted: '#EEEEEA',
  border: '#E4E4DF',
  borderStrong: '#D3D3CC',

  textPrimary: '#16161A',
  textSecondary: '#5A5A60',
  textMuted: '#8C8C92',
  textInverse: '#FFFFFF',

  accent: '#1F5F8B',
  accentMuted: '#E7F0F6',
  onAccent: '#FFFFFF',

  success: '#1E7A4D',
  warning: '#B5791F',
  danger: '#C0392B',
  info: '#1F5F8B',
} as const;

export const darkColors: Record<keyof typeof lightColors, string> = {
  background: '#0E0E10',
  surface: '#1A1A1D',
  surfaceMuted: '#26262B',
  border: '#2C2C31',
  borderStrong: '#3B3B41',

  textPrimary: '#F4F4F5',
  textSecondary: '#A8A8AE',
  textMuted: '#76767C',
  textInverse: '#16161A',

  accent: '#5BA3D0',
  accentMuted: '#16303D',
  onAccent: '#0E0E10',

  success: '#3FB37A',
  warning: '#D4A24E',
  danger: '#E06150',
  info: '#5BA3D0',
};

// Mutable palette: ThemeProvider swaps the values in place via applyColorScheme()
// so every `colors as tokenColors` import follows the active scheme. Consumers
// must re-render to pick up a mid-session flip — components that read these
// values should subscribe with useTheme().
export const colors: Record<keyof typeof lightColors, string> = { ...lightColors };

export function applyColorScheme(isDark: boolean) {
  Object.assign(colors, isDark ? darkColors : lightColors);
}

// ─── MOTION ───────────────────────────────────────────────────────────────────
export const motion = {
  spring: {
    snappy: { damping: 18, stiffness: 320, mass: 0.7 },
    gentle: { damping: 20, stiffness: 160, mass: 1 },
    bouncy: { damping: 12, stiffness: 220, mass: 0.9 },
  },
  duration: {
    fast: 150,
    base: 250,
    slow: 400,
  },
  pressScale: 0.97,
} as const;

// ─── ELEVATION ────────────────────────────────────────────────────────────────
export const elevation = {
  none: {} as ViewStyle,
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  } as ViewStyle,
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 5,
  } as ViewStyle,
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.12,
    shadowRadius: 28,
    elevation: 12,
  } as ViewStyle,
} as const;

// ─── ERGONOMICS ───────────────────────────────────────────────────────────────
export const minTouch = 44;
export const hitSlop = { top: 8, bottom: 8, left: 8, right: 8 };
