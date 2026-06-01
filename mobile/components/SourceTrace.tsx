/**
 * SourceTrace — reusable "show your working" component.
 * Every quantitative claim in the app should be one tap from its primary source.
 *
 * Usage:
 *   <SourceTrace
 *     label="Based on 91 real votes"
 *     onPress={() => openContributingVotes()}
 *     sourceUrl="https://theyvoteforyou.org.au/..."  // optional outbound link
 *   />
 */
import React from 'react';
import { View, Text, Pressable, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { SPACING, FONT_SIZE, FONT_WEIGHT, BORDER_RADIUS } from '../constants/design';

interface SourceTraceProps {
  label: string;
  sublabel?: string;
  onPress?: () => void;
  sourceUrl?: string | null;
}

export function SourceTrace({ label, sublabel, onPress, sourceUrl }: SourceTraceProps) {
  const { colors } = useTheme();

  const handlePress = () => {
    if (onPress) onPress();
    else if (sourceUrl) Linking.openURL(sourceUrl);
  };

  const isInteractive = !!onPress || !!sourceUrl;

  return (
    <Pressable
      onPress={isInteractive ? handlePress : undefined}
      disabled={!isInteractive}
      style={{
        flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
        paddingVertical: SPACING.sm, paddingHorizontal: SPACING.md,
        backgroundColor: colors.surface,
        borderRadius: BORDER_RADIUS.sm,
      }}
    >
      <Ionicons name="open-outline" size={14} color="#00843D" />
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: FONT_SIZE.caption, color: '#00843D', fontWeight: FONT_WEIGHT.medium }}>
          {label}
        </Text>
        {sublabel && (
          <Text style={{ fontSize: FONT_SIZE.caption, color: colors.textMuted, marginTop: 1 }}>
            {sublabel}
          </Text>
        )}
      </View>
      {isInteractive && (
        <Ionicons name="chevron-forward" size={14} color={colors.textMuted} />
      )}
    </Pressable>
  );
}

interface SourceTraceInlineProps {
  label: string;
  onPress?: () => void;
}

/** Minimal inline variant — just an underlined tap target, for use in text rows. */
export function SourceTraceInline({ label, onPress }: SourceTraceInlineProps) {
  return (
    <Pressable onPress={onPress} hitSlop={8}>
      <Text style={{
        fontSize: FONT_SIZE.caption, color: '#00843D', fontWeight: FONT_WEIGHT.medium,
        textDecorationLine: 'underline',
      }}>
        {label}
      </Text>
    </Pressable>
  );
}
