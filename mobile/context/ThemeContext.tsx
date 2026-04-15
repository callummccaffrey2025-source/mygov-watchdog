import React, { createContext, useContext, ReactNode } from 'react';
import { useColorScheme } from 'react-native';

const COLORS_LIGHT = {
  background:   '#ffffff',
  surface:      '#f8f9fb',
  card:         '#ffffff',
  cardAlt:      '#f3f4f6',
  text:         '#1a2332',
  textBody:     '#5a6a7a',
  textMuted:    '#9aabb8',
  border:       '#e8ecf0',
  borderStrong: '#c4cdd5',
  green:        '#00843D',
  greenBg:      '#e8f5ee',
  greenLight:   '#00843D18',
  red:          '#DC3545',
  redBg:        '#fdecea',
  tabBar:       '#ffffff',
  statusBar:    'dark' as const,
};

const COLORS_DARK = {
  background:   '#0f1923',
  surface:      '#162030',
  card:         '#1a2332',
  cardAlt:      '#243040',
  text:         '#e8ecf0',
  textBody:     '#9aabb8',
  textMuted:    '#5a6a7a',
  border:       '#2d3f52',
  borderStrong: '#3d5068',
  green:        '#00843D',
  greenBg:      '#003d1a',
  greenLight:   '#00843D30',
  red:          '#DC3545',
  redBg:        '#3d1a1a',
  tabBar:       '#1a2332',
  statusBar:    'light' as const,
};

export type ThemeColors = Omit<typeof COLORS_LIGHT, 'statusBar'> & { statusBar: 'dark' | 'light' };

interface ThemeContextType {
  colors: ThemeColors;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextType>({
  colors: COLORS_LIGHT,
  isDark: false,
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  console.log('[ThemeContext] colorScheme:', scheme, '→ isDark:', isDark);
  return (
    <ThemeContext.Provider value={{ colors: isDark ? COLORS_DARK : COLORS_LIGHT, isDark }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
