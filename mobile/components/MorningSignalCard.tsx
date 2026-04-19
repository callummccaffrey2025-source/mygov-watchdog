import React from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useMorningSignal } from '../hooks/useMorningSignal';
import { SPACING, FONT_SIZE, FONT_WEIGHT, BORDER_RADIUS, SHADOWS } from '../constants/design';

interface Props {
  onPress: () => void;
  electorate: string | null;
  mpName: string | null;
}

function formatCardDate(): string {
  const d = new Date();
  return d.toLocaleDateString('en-AU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function MorningSignalCard({ onPress, electorate, mpName }: Props) {
  const { colors } = useTheme();
  const { signal, loading } = useMorningSignal(electorate, mpName);

  const topHeadline = signal?.top_stories?.[0]?.headline ?? null;

  return (
    <Pressable
      onPress={onPress}
      style={{
        marginHorizontal: SPACING.lg,
        marginBottom: SPACING.lg,
        borderRadius: BORDER_RADIUS.lg,
        overflow: 'hidden',
        ...SHADOWS.md,
      }}
    >
      {/* Green header */}
      <View
        style={{
          backgroundColor: colors.green,
          paddingHorizontal: SPACING.lg,
          paddingTop: SPACING.lg,
          paddingBottom: SPACING.md,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text
            style={{
              color: '#ffffff',
              fontSize: FONT_SIZE.heading,
              fontWeight: FONT_WEIGHT.bold,
            }}
          >
            Your Morning Signal
          </Text>
          <Ionicons name="chevron-forward" size={20} color="#ffffff" />
        </View>
        <Text
          style={{
            color: 'rgba(255,255,255,0.8)',
            fontSize: FONT_SIZE.small,
            fontWeight: FONT_WEIGHT.regular,
            marginTop: SPACING.xs,
          }}
        >
          {formatCardDate()}
        </Text>
        {electorate ? (
          <Text
            style={{
              color: 'rgba(255,255,255,0.7)',
              fontSize: FONT_SIZE.caption,
              fontWeight: FONT_WEIGHT.medium,
              marginTop: SPACING.xs,
            }}
          >
            For {electorate}
          </Text>
        ) : null}
      </View>

      {/* Body */}
      <View
        style={{
          backgroundColor: colors.card,
          paddingHorizontal: SPACING.lg,
          paddingVertical: SPACING.md,
        }}
      >
        {loading && !topHeadline ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: SPACING.sm }}>
            <View
              style={{
                height: 14,
                borderRadius: BORDER_RADIUS.sm,
                backgroundColor: colors.cardAlt,
                flex: 1,
              }}
            />
          </View>
        ) : topHeadline ? (
          <Text
            numberOfLines={1}
            style={{
              color: colors.text,
              fontSize: FONT_SIZE.body,
              fontWeight: FONT_WEIGHT.medium,
              lineHeight: 22,
            }}
          >
            {topHeadline}
          </Text>
        ) : (
          <Text
            style={{
              color: colors.textMuted,
              fontSize: FONT_SIZE.body,
              fontWeight: FONT_WEIGHT.regular,
            }}
          >
            Nothing to report today
          </Text>
        )}

        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            marginTop: SPACING.sm,
          }}
        >
          <Ionicons name="flash-outline" size={14} color={colors.green} />
          <Text
            style={{
              color: colors.textMuted,
              fontSize: FONT_SIZE.caption,
              fontWeight: FONT_WEIGHT.regular,
              marginLeft: SPACING.xs,
            }}
          >
            Powered by Verity AI
          </Text>
        </View>
      </View>
    </Pressable>
  );
}
