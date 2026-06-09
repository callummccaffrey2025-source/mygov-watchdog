import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { Skeleton } from './ui/Skeleton';
import { spacing, radius, colors as tokenColors } from '../theme/tokens';

const FACTS = [
  'Australia has compulsory voting — over 96% turnout.',
  'The Senate has 76 senators: 12 per state, 2 per territory.',
  'A bill must pass both House and Senate to become law.',
  'Question Time runs 45 minutes each sitting day.',
  'There are 151 House of Representatives seats across Australia.',
  'Preferential voting means you rank candidates from 1 to last.',
];

export function HomeScreenSkeleton() {
  const [factIdx, setFactIdx] = useState(() => Math.floor(Math.random() * FACTS.length));
  useEffect(() => {
    const t = setInterval(() => setFactIdx(i => (i + 1) % FACTS.length), 4000);
    return () => clearInterval(t);
  }, []);

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingTop: spacing.lg }} showsVerticalScrollIndicator={false}>
      {/* Hero: greeting + date */}
      <View style={{ gap: spacing.sm, marginBottom: spacing.xl }}>
        <Skeleton width="60%" height={34} borderRadius={radius.sm} />
        <Skeleton width="45%" height={16} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm }}>
          <Skeleton width={8} height={8} borderRadius={4} />
          <Skeleton width={140} height={12} />
        </View>
      </View>

      {/* Section header */}
      <Skeleton width={150} height={13} style={{ marginBottom: spacing.md }} />

      {/* MP card skeleton: avatar + text side by side */}
      <View style={{ backgroundColor: tokenColors.surface, borderRadius: radius.md, padding: spacing.lg, marginBottom: spacing.xl }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <Skeleton width={54} height={54} borderRadius={radius.lg} />
          <View style={{ flex: 1, gap: spacing.sm }}>
            <Skeleton width="70%" height={16} />
            <Skeleton width="50%" height={12} />
          </View>
        </View>
        <Skeleton width="100%" height={40} borderRadius={radius.sm} style={{ marginTop: spacing.md }} />
        <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }}>
          <Skeleton width="48%" height={40} borderRadius={radius.pill} />
          <Skeleton width="48%" height={40} borderRadius={radius.pill} />
        </View>
      </View>

      {/* Bill swipe card skeleton */}
      <Skeleton width={120} height={13} style={{ marginBottom: spacing.md }} />
      <View style={{ backgroundColor: tokenColors.surface, borderRadius: radius.md, padding: spacing.lg, marginBottom: spacing.xl }}>
        <Skeleton width={100} height={20} borderRadius={radius.sm} style={{ marginBottom: spacing.md }} />
        <Skeleton width="90%" height={20} style={{ marginBottom: spacing.sm }} />
        <Skeleton width="70%" height={14} style={{ marginBottom: spacing.lg }} />
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <Skeleton width="40%" height={40} borderRadius={radius.pill} />
          <Skeleton width="40%" height={40} borderRadius={radius.pill} />
        </View>
      </View>

      {/* Civic fact while loading */}
      <View style={{ alignItems: 'center', paddingVertical: spacing.md, marginBottom: spacing.lg }}>
        <Text style={{ fontSize: 13, color: tokenColors.textMuted, textAlign: 'center', lineHeight: 19, fontStyle: 'italic', paddingHorizontal: spacing.lg }}>
          {FACTS[factIdx]}
        </Text>
      </View>

      {/* Vote card skeletons */}
      <Skeleton width={140} height={13} style={{ marginBottom: spacing.md }} />
      {[1, 2].map(i => (
        <View key={i} style={{ backgroundColor: tokenColors.surface, borderRadius: radius.md, padding: spacing.lg, marginBottom: spacing.sm }}>
          <Skeleton width="85%" height={14} style={{ marginBottom: spacing.sm }} />
          <Skeleton width="50%" height={12} />
        </View>
      ))}
    </ScrollView>
  );
}
