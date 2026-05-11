import React from 'react';
import { Text } from 'react-native';
import { parseBold } from '../lib/parseBold';

describe('parseBold', () => {
  it('returns plain text when no bold markers', () => {
    const result = parseBold('Hello world');
    expect(result).toBe('Hello world');
  });

  it('wraps bold text in bold Text elements', () => {
    const result = parseBold('This is **important** news');
    expect(Array.isArray(result)).toBe(true);
    const parts = result as React.ReactNode[];
    expect(parts).toHaveLength(3);
    expect(parts[0]).toBe('This is ');
    expect(parts[2]).toBe(' news');
    // The middle element should be a Text component with bold style
    const boldElement = parts[1] as React.ReactElement<{ children: string }>;
    expect(boldElement.type).toBe(Text);
    expect(boldElement.props.children).toBe('important');
  });

  it('handles multiple bold sections', () => {
    const result = parseBold('**A** and **B**');
    const parts = result as React.ReactNode[];
    expect(parts).toHaveLength(5); // ["", bold("A"), " and ", bold("B"), ""]
  });

  it('handles empty string', () => {
    const result = parseBold('');
    expect(result).toBe('');
  });
});
