import React from 'react';
import { View, Text, ScrollView, Pressable, Linking, Share } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { PublishedPoll } from '../hooks/usePublishedPolls';
import { SPACING, FONT_SIZE, FONT_WEIGHT, BORDER_RADIUS, SHADOWS } from '../constants/design';

const GREEN = '#00843D';

function formatDate(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-AU', {
    day: 'numeric', month: 'long', year: 'numeric',
  });
}

function PrimaryRow({ label, value, color }: { label: string; value: number | null; color: string }) {
  if (value === null) return null;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: SPACING.sm }}>
      <Text style={{ fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.medium, color: '#1a2332' }}>{label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.sm }}>
        <View style={{ width: 100, height: 8, borderRadius: 4, backgroundColor: '#F3F4F6', overflow: 'hidden' }}>
          <View style={{ width: `${Math.min(value, 100)}%`, height: 8, borderRadius: 4, backgroundColor: color }} />
        </View>
        <Text style={{ fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.bold, color, width: 45, textAlign: 'right' }}>{value}%</Text>
      </View>
    </View>
  );
}

export function PollDetailScreen({ route, navigation }: any) {
  const { colors } = useTheme();
  const params = route.params ?? {};

  // Handle both new published poll shape and any legacy navigation
  const poll: PublishedPoll | null = params.poll ?? null;

  if (!poll) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }}>
        <Ionicons name="alert-circle-outline" size={48} color={colors.textMuted} />
        <Text style={{ fontSize: FONT_SIZE.body, color: colors.textMuted, marginTop: SPACING.md }}>Poll not found</Text>
        <Pressable onPress={() => navigation.goBack()} style={{ marginTop: SPACING.lg }} accessibilityRole="button" accessibilityLabel="Go back">
          <Text style={{ fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.semibold, color: GREEN }}>Go back</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const handleShare = () => {
    const tpp = poll.tpp_alp && poll.tpp_lnp
      ? `TPP: ALP ${poll.tpp_alp} — L/NP ${poll.tpp_lnp}`
      : '';
    Share.share({
      message: `${poll.pollster} poll (${formatDate(poll.publish_date)})\n${tpp}\n\nSource: ${poll.source_url}\n\nvia Verity`,
    });
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      {/* Nav */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: SPACING.xl, paddingVertical: SPACING.md }}>
        <Pressable
          style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.cardAlt, justifyContent: 'center', alignItems: 'center' }}
          onPress={() => navigation.goBack()} hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Pressable>
        <Pressable
          style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.cardAlt, justifyContent: 'center', alignItems: 'center' }}
          onPress={handleShare} hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Share poll"
        >
          <Ionicons name="share-outline" size={22} color={colors.text} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={{ paddingHorizontal: SPACING.xl, marginBottom: SPACING.xl }}>
          <Text style={{ fontSize: 24, fontWeight: '800', color: colors.text, marginBottom: SPACING.xs }}>
            {poll.pollster}
          </Text>
          <Text style={{ fontSize: FONT_SIZE.body, color: colors.textBody }}>
            {formatDate(poll.field_start_date)} — {formatDate(poll.field_end_date)}
          </Text>
        </View>

        {/* TPP headline */}
        {poll.tpp_alp && poll.tpp_lnp && (
          <View style={{
            marginHorizontal: SPACING.xl, backgroundColor: colors.card,
            borderRadius: BORDER_RADIUS.lg, padding: SPACING.xl, marginBottom: SPACING.xl,
            ...SHADOWS.md,
          }}>
            <Text style={{ fontSize: 11, fontWeight: FONT_WEIGHT.semibold, letterSpacing: 1, color: colors.textMuted, textTransform: 'uppercase', marginBottom: SPACING.lg }}>
              Two-Party Preferred
            </Text>

            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.xxl, marginBottom: SPACING.lg }}>
              <View style={{ alignItems: 'center' }}>
                <Text style={{ fontSize: 11, fontWeight: FONT_WEIGHT.semibold, color: '#DC3545', marginBottom: 4 }}>ALP</Text>
                <Text style={{ fontSize: 42, fontWeight: '800', color: '#DC3545' }}>{poll.tpp_alp}</Text>
              </View>
              <Text style={{ fontSize: 20, color: colors.textMuted }}>—</Text>
              <View style={{ alignItems: 'center' }}>
                <Text style={{ fontSize: 11, fontWeight: FONT_WEIGHT.semibold, color: '#2563EB', marginBottom: 4 }}>L/NP</Text>
                <Text style={{ fontSize: 42, fontWeight: '800', color: '#2563EB' }}>{poll.tpp_lnp}</Text>
              </View>
            </View>

            <View style={{ height: 12, borderRadius: 6, overflow: 'hidden', flexDirection: 'row', backgroundColor: colors.cardAlt }}>
              <View style={{ flex: Number(poll.tpp_alp), backgroundColor: '#DC3545' }} />
              <View style={{ flex: Number(poll.tpp_lnp), backgroundColor: '#2563EB' }} />
            </View>
          </View>
        )}

        {/* Primary votes */}
        <View style={{
          marginHorizontal: SPACING.xl, backgroundColor: colors.card,
          borderRadius: BORDER_RADIUS.lg, padding: SPACING.xl, marginBottom: SPACING.xl,
          ...SHADOWS.sm,
        }}>
          <Text style={{ fontSize: 11, fontWeight: FONT_WEIGHT.semibold, letterSpacing: 1, color: colors.textMuted, textTransform: 'uppercase', marginBottom: SPACING.md }}>
            Primary Vote
          </Text>

          <PrimaryRow label="Labor (ALP)" value={poll.primary_alp} color="#DC3545" />
          <PrimaryRow label="Coalition (L/NP)" value={poll.primary_lnp} color="#2563EB" />
          <PrimaryRow label="Greens" value={poll.primary_grn} color="#10B981" />
          <PrimaryRow label="One Nation" value={poll.primary_one_nation} color="#F97316" />
          <PrimaryRow label="Independents" value={poll.primary_ind} color="#8B5CF6" />
          <PrimaryRow label="Other" value={poll.primary_other} color="#6B7280" />
        </View>

        {/* Methodology */}
        <View style={{
          marginHorizontal: SPACING.xl, backgroundColor: colors.card,
          borderRadius: BORDER_RADIUS.lg, padding: SPACING.xl, marginBottom: SPACING.xl,
          ...SHADOWS.sm,
        }}>
          <Text style={{ fontSize: 11, fontWeight: FONT_WEIGHT.semibold, letterSpacing: 1, color: colors.textMuted, textTransform: 'uppercase', marginBottom: SPACING.md }}>
            Methodology
          </Text>

          <View style={{ gap: SPACING.sm }}>
            {poll.sample_size && (
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ fontSize: FONT_SIZE.body, color: colors.textBody }}>Sample size</Text>
                <Text style={{ fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.semibold, color: colors.text }}>{poll.sample_size.toLocaleString()}</Text>
              </View>
            )}
            {poll.methodology && (
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ fontSize: FONT_SIZE.body, color: colors.textBody }}>Method</Text>
                <Text style={{ fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.semibold, color: colors.text, textTransform: 'capitalize' }}>{poll.methodology}</Text>
              </View>
            )}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ fontSize: FONT_SIZE.body, color: colors.textBody }}>Field dates</Text>
              <Text style={{ fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.semibold, color: colors.text }}>
                {formatDate(poll.field_start_date)} — {formatDate(poll.field_end_date)}
              </Text>
            </View>
          </View>

          {poll.notes && (
            <Text style={{ fontSize: FONT_SIZE.caption, color: colors.textMuted, marginTop: SPACING.md, lineHeight: 18 }}>
              {poll.notes}
            </Text>
          )}
        </View>

        {/* Source link */}
        <Pressable
          onPress={() => Linking.openURL(poll.source_url)}
          style={{
            marginHorizontal: SPACING.xl, flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
            backgroundColor: colors.surface, borderRadius: BORDER_RADIUS.md, padding: SPACING.lg,
            marginBottom: SPACING.xl,
          }}
          accessibilityRole="button"
          accessibilityLabel="View original source"
        >
          <Ionicons name="open-outline" size={16} color={GREEN} />
          <Text style={{ flex: 1, fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.semibold, color: GREEN }}>
            View original source
          </Text>
          <Ionicons name="chevron-forward" size={14} color={colors.textMuted} />
        </Pressable>

        {/* Attribution */}
        <View style={{ marginHorizontal: SPACING.xl, backgroundColor: colors.surface, borderRadius: BORDER_RADIUS.md, padding: SPACING.md }}>
          <Text style={{ fontSize: FONT_SIZE.caption - 1, color: colors.textMuted, lineHeight: 16 }}>
            Poll conducted by {poll.pollster}. Data sourced from published results with attribution. Verity does not conduct polls. Numbers displayed are as published by the polling firm.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
