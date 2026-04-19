/**
 * ReceiptsBlock — Primary parliamentary sources beneath a news story.
 *
 * Pillar 1 of Verity's trust architecture: for every news story, show users
 * the Hansard speeches, division votes, related bills, and donation records
 * that underpin the reporting. Media frames the narrative; Verity shows the receipts.
 *
 * Returns null when no sources exist (silent design, same as VerityRealityCheck).
 */
import React from 'react';
import { View, Text, Pressable, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useStoryPrimarySources, PrimarySource } from '../hooks/useStoryPrimarySources';
import { useTheme } from '../context/ThemeContext';
import { decodeHtml } from '../utils/decodeHtml';
import { timeAgo } from '../lib/timeAgo';
import { SPACING, FONT_SIZE, FONT_WEIGHT, BORDER_RADIUS, SHADOWS } from '../constants/design';

interface Props {
  storyId: number;
  headline: string;
  onPressBill?: (billId: string) => void;
  onPressMember?: (memberId: string) => void;
}

function formatCurrency(amount: number): string {
  return amount.toLocaleString('en-AU', { style: 'currency', currency: 'AUD' });
}

function truncateExcerpt(text: string | null, maxLen = 150): string | null {
  if (!text) return null;
  const decoded = decodeHtml(text);
  if (decoded.length <= maxLen) return decoded;
  return decoded.slice(0, maxLen).trimEnd() + '...';
}

// ── Section renderers ─────────────────────────────────────────────────────────

function HansardItem({ source, colors }: { source: PrimarySource; colors: any }) {
  const meta = source.metadata || {};
  const handlePress = () => {
    const url = meta.source_url || meta.url;
    if (url) Linking.openURL(url).catch(() => {});
  };

  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => ({
        backgroundColor: pressed ? colors.cardAlt : colors.card,
        borderRadius: BORDER_RADIUS.lg,
        padding: SPACING.lg,
        marginBottom: SPACING.sm,
        ...SHADOWS.sm,
      })}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.xs }}>
        <Ionicons name="chatbubble-ellipses-outline" size={14} color={colors.green} />
        <Text style={{ fontSize: FONT_SIZE.caption, fontWeight: FONT_WEIGHT.semibold, color: colors.green, letterSpacing: 0.6 }}>
          SEE THE ACTUAL SPEECH
        </Text>
      </View>
      {meta.debate_topic ? (
        <Text style={{ fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.bold, color: colors.text, lineHeight: 21, marginBottom: SPACING.xs }} numberOfLines={2}>
          {decodeHtml(meta.debate_topic)}
        </Text>
      ) : null}
      {meta.date ? (
        <Text style={{ fontSize: FONT_SIZE.small, color: colors.textMuted, marginBottom: SPACING.xs }}>
          {timeAgo(meta.date)}
        </Text>
      ) : null}
      {source.excerpt ? (
        <Text style={{ fontSize: FONT_SIZE.small, color: colors.textBody, lineHeight: 19, fontStyle: 'italic' }} numberOfLines={3}>
          "{truncateExcerpt(source.excerpt)}"
        </Text>
      ) : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: SPACING.sm }}>
        <Text style={{ fontSize: FONT_SIZE.caption, color: colors.green, fontWeight: FONT_WEIGHT.medium }}>
          View on APH
        </Text>
        <Ionicons name="open-outline" size={12} color={colors.green} style={{ marginLeft: SPACING.xs }} />
      </View>
    </Pressable>
  );
}

function VoteItem({ source, colors }: { source: PrimarySource; colors: any }) {
  const meta = source.metadata || {};
  const voteCast = meta.vote_cast as string | undefined;
  const isAye = voteCast === 'aye';
  const ayeCount = meta.aye_count as number | undefined;
  const noCount = meta.no_count as number | undefined;

  return (
    <View style={{
      backgroundColor: colors.card,
      borderRadius: BORDER_RADIUS.lg,
      padding: SPACING.lg,
      marginBottom: SPACING.sm,
      ...SHADOWS.sm,
    }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.xs }}>
        <Ionicons name="checkmark-circle-outline" size={14} color={colors.green} />
        <Text style={{ fontSize: FONT_SIZE.caption, fontWeight: FONT_WEIGHT.semibold, color: colors.green, letterSpacing: 0.6 }}>
          HOW THEY VOTED
        </Text>
      </View>
      {meta.division_name ? (
        <Text style={{ fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.semibold, color: colors.text, lineHeight: 21, marginBottom: SPACING.sm }} numberOfLines={3}>
          {decodeHtml(meta.division_name)}
        </Text>
      ) : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, flexWrap: 'wrap' }}>
        {voteCast ? (
          <View style={{
            backgroundColor: isAye ? '#00843D' : '#DC3545',
            borderRadius: BORDER_RADIUS.sm,
            paddingHorizontal: SPACING.sm,
            paddingVertical: SPACING.xs,
          }}>
            <Text style={{ fontSize: FONT_SIZE.caption, fontWeight: FONT_WEIGHT.bold, color: '#FFFFFF' }}>
              {voteCast.toUpperCase()}
            </Text>
          </View>
        ) : null}
        {(ayeCount != null && noCount != null) ? (
          <Text style={{ fontSize: FONT_SIZE.small, color: colors.textBody }}>
            {ayeCount} ayes, {noCount} noes
          </Text>
        ) : null}
      </View>
    </View>
  );
}

function BillItem({ source, colors, onPressBill }: { source: PrimarySource; colors: any; onPressBill?: (id: string) => void }) {
  const meta = source.metadata || {};
  const title = meta.short_title || meta.title || 'Related bill';
  const status = meta.current_status || meta.status;

  return (
    <Pressable
      onPress={() => onPressBill?.(source.source_id)}
      style={({ pressed }) => ({
        backgroundColor: pressed ? colors.cardAlt : colors.card,
        borderRadius: BORDER_RADIUS.lg,
        padding: SPACING.lg,
        marginBottom: SPACING.sm,
        ...SHADOWS.sm,
      })}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.xs }}>
        <Ionicons name="document-outline" size={14} color={colors.green} />
        <Text style={{ fontSize: FONT_SIZE.caption, fontWeight: FONT_WEIGHT.semibold, color: colors.green, letterSpacing: 0.6 }}>
          RELATED LEGISLATION
        </Text>
      </View>
      <Text style={{ fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.semibold, color: colors.text, lineHeight: 21, marginBottom: SPACING.sm }} numberOfLines={3}>
        {decodeHtml(title)}
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.sm }}>
        {status ? (
          <View style={{ backgroundColor: colors.greenBg, borderRadius: BORDER_RADIUS.sm, paddingHorizontal: SPACING.sm, paddingVertical: SPACING.xs }}>
            <Text style={{ fontSize: FONT_SIZE.caption, fontWeight: FONT_WEIGHT.bold, color: colors.green }}>
              {status.toUpperCase()}
            </Text>
          </View>
        ) : null}
        <Ionicons name="chevron-forward" size={14} color={colors.green} style={{ marginLeft: 'auto' }} />
      </View>
    </Pressable>
  );
}

function DonationItem({ source, colors }: { source: PrimarySource; colors: any }) {
  const meta = source.metadata || {};
  const donorName = meta.donor_name as string | undefined;
  const amount = meta.amount as number | undefined;
  const financialYear = meta.financial_year as string | undefined;

  return (
    <View style={{
      backgroundColor: colors.card,
      borderRadius: BORDER_RADIUS.lg,
      padding: SPACING.lg,
      marginBottom: SPACING.sm,
      ...SHADOWS.sm,
    }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.xs }}>
        <Ionicons name="cash-outline" size={14} color={colors.green} />
        <Text style={{ fontSize: FONT_SIZE.caption, fontWeight: FONT_WEIGHT.semibold, color: colors.green, letterSpacing: 0.6 }}>
          WHO FUNDED THIS MP
        </Text>
      </View>
      {donorName ? (
        <Text style={{ fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.semibold, color: colors.text, lineHeight: 21, marginBottom: SPACING.xs }} numberOfLines={2}>
          {decodeHtml(donorName)}
        </Text>
      ) : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.md, flexWrap: 'wrap' }}>
        {amount != null ? (
          <Text style={{ fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.bold, color: colors.text }}>
            {formatCurrency(amount)}
          </Text>
        ) : null}
        {financialYear ? (
          <Text style={{ fontSize: FONT_SIZE.small, color: colors.textMuted }}>
            FY {financialYear}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function ReceiptsBlock({ storyId, headline, onPressBill, onPressMember }: Props) {
  const { colors } = useTheme();
  const { hansard, votes, bills, donations, loading, sources } = useStoryPrimarySources(storyId);

  // Silent when no sources — same pattern as VerityRealityCheck
  if (!loading && sources.length === 0) return null;
  if (loading) return null; // Don't show skeleton — appear only when data is ready

  return (
    <View style={{ marginBottom: SPACING.xl }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.md }}>
        <Ionicons name="document-text" size={16} color={colors.green} />
        <Text style={{
          fontSize: FONT_SIZE.subtitle,
          fontWeight: FONT_WEIGHT.semibold,
          color: colors.text,
        }}>
          Primary sources
        </Text>
      </View>

      {/* Hansard speeches */}
      {hansard.length > 0 ? (
        hansard.map(s => <HansardItem key={s.id} source={s} colors={colors} />)
      ) : null}

      {/* Division votes */}
      {votes.length > 0 ? (
        votes.map(s => <VoteItem key={s.id} source={s} colors={colors} />)
      ) : null}

      {/* Related bills */}
      {bills.length > 0 ? (
        bills.map(s => <BillItem key={s.id} source={s} colors={colors} onPressBill={onPressBill} />)
      ) : null}

      {/* Donations */}
      {donations.length > 0 ? (
        donations.map(s => <DonationItem key={s.id} source={s} colors={colors} />)
      ) : null}

      {/* Footer */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, marginTop: SPACING.sm }}>
        <Ionicons name="sparkles" size={10} color={colors.textMuted} />
        <Text style={{ fontSize: FONT_SIZE.caption, color: colors.textMuted, fontWeight: FONT_WEIGHT.medium }}>
          Powered by Verity AI
        </Text>
      </View>
    </View>
  );
}
