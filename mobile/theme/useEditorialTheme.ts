import { useColorScheme } from 'react-native';
import { LIGHT, DARK, EditorialColors } from './tokens';

export function useEditorialTheme(): EditorialColors {
  const scheme = useColorScheme();
  return scheme === 'dark' ? DARK : LIGHT;
}
