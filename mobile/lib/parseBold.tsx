import React from 'react';
import { Text, type TextStyle } from 'react-native';

/**
 * Parses **bold** markdown in a string and returns React Native Text elements.
 *
 * Usage:
 *   <Text>{parseBold("This is **important** news")}</Text>
 */
export function parseBold(
  text: string,
  boldStyle?: TextStyle,
): React.ReactNode {
  if (!text.includes('**')) return text;

  const parts = text.split(/\*\*(.*?)\*\*/g);
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <Text key={i} style={[{ fontWeight: '700' }, boldStyle]}>
        {part}
      </Text>
    ) : (
      part
    ),
  );
}
