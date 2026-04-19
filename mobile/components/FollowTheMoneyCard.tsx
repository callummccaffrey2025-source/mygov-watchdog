/**
 * FollowTheMoneyCard — Financial connections behind a news story.
 *
 * Shows which MPs mentioned in the story received declared donations,
 * and which media owners have multiple outlets covering the story.
 * Returns null when no financial connections exist.
 */
import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFollowTheMoney, MpDonationEntry, MediaOwnershipEntry } from '../hooks/useFollowTheMoney';
import { useTheme } from '../context/ThemeContext';
import { SPACING, FONT_SIZE, FONT_WEIGHT, BORDER_RADIUS, SHADOWS } from '../constants/design';

const MONEY_ACCENT = '#B8860B';

interface Props {
  storyId: number;
  headline: string;
  category: string | null;
  onPressMember?: (memberId: string) => void;
}

function formatCurrency(amount: number): string {
  return amount.toLocaleString('en-AU', { style: 'currency', currency: 'AUD', minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function donorTypeIcon(donorType: string | null): keyof typeof Ionicons.glyphMap {
  switch (donorType?.toLowerCase()) {
    case 'corporation': return 'business-outline';
    case 'organisation': return 'people-outline';
    case 'individual': return 'person-outline';
    case 'union': return 'construct-outline';
    default: return 'cash-outline';
  }
}

// ── MP donation row ──────────────────────────────────────────────────────────

function MpDonationRow({
  mp,
  colors,
  onPress,
}: {
  mp: MpDonationEntry;
  colors: any;
  onPress?: () => void;
}) {
  const top3 = mp.topDonors.slice(0, 3);

  return (
    <View style={{
      backgroundColor: colors.card,
      borderRadius: BORDER_RADIUS.lg,
      padding: SPACING.lg,
      marginBottom: SPACING.sm,
      ...SHADOWS.sm,
    }}>
      {/* MP name + party */}
      <Pressable
        onPress={onPress}
        style={{ flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.sm }}
      >
        <Text style={{
          fontSize: FONT_SIZE.body,
          fontWeight: FONT_WEIGHT.bold,
          color: colors.green,
          flex: 1,
        }}>
          {mp.memberName}
        </Text>
        {mp.party ? (
          <View style={{
            backgroundColor: colors.greenBg,
            borderRadius: BORDER_RADIUS.sm,
            paddingHorizontal: SPACING.sm,
            paddingVertical: 2,
          }}>
            <Text style={{
              fontSize: FONT_SIZE.caption,
              fontWeight: FONT_WEIGHT.semibold,
              color: colors.green,
            }}>
              {mp.party}
            </Text>
          </View>
        ) : null}
        <Ionicons name="chevron-forward" size={14} color={colors.textMuted} style={{ marginLeft: SPACING.xs }} />
      </Pressable>

      {/* Top donors */}
      {top3.map((donor, idx) => (
        <View
          key={`${donor.donor_name}-${idx}`}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingVertical: SPACING.xs,
            gap: SPACING.sm,
          }}
        >
          <Ionicons
            name={donorTypeIcon(donor.donor_type)}
            size={14}
            color={colors.textMuted}
          />
          <Text
            style={{
              fontSize: FONT_SIZE.small,
              color: colors.textBody,
              flex: 1,
            }}
            numberOfLines={1}
          >
            {donor.donor_name}
          </Text>
          <Text style={{
            fontSize: FONT_SIZE.small,
            fontWeight: FONT_WEIGHT.semibold,
            color: colors.text,
          }}>
            {formatCurrency(donor.amount)}
          </Text>
        </View>
      ))}

      {/* Total */}
      <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: SPACING.sm,
        paddingTop: SPACING.sm,
        borderTopWidth: 1,
        borderTopColor: colors.border,
      }}>
        <Text style={{
          fontSize: FONT_SIZE.caption,
          color: colors.textMuted,
          flex: 1,
        }}>
          Total declared donations
        </Text>
        <Text style={{
          fontSize: FONT_SIZE.body,
          fontWeight: FONT_WEIGHT.bold,
          color: colors.text,
        }}>
          {formatCurrency(mp.totalReceived)}
        </Text>
      </View>
    </View>
  );
}

// ── Media ownership row ──────────────────────────────────────────────────────

function MediaOwnershipRow({
  entry,
  totalSources,
  colors,
}: {
  entry: MediaOwnershipEntry;
  totalSources: number;
  colors: any;
}) {
  const allSameLeaning = entry.leanings.length === 1;

  return (
    <View style={{
      backgroundColor: colors.card,
      borderRadius: BORDER_RADIUS.lg,
      padding: SPACING.lg,
      marginBottom: SPACING.sm,
      ...SHADOWS.sm,
    }}>
      <Text style={{
        fontSize: FONT_SIZE.body,
        fontWeight: FONT_WEIGHT.semibold,
        color: colors.text,
        marginBottom: SPACING.xs,
      }}>
        {entry.owner}
      </Text>
      <Text style={{
        fontSize: FONT_SIZE.small,
        color: colors.textBody,
        lineHeight: 19,
        marginBottom: SPACING.xs,
      }}>
        {entry.outlets.join(', ')} ({entry.articleCount} {entry.articleCount === 1 ? 'article' : 'articles'})
      </Text>
      {entry.outlets.length >= 2 && totalSources > 0 ? (
        <Text style={{
          fontSize: FONT_SIZE.caption,
          color: colors.textMuted,
          lineHeight: 16,
        }}>
          {entry.outlets.length} of {totalSources} sources covering this story are owned by {entry.owner}
          {allSameLeaning && entry.leanings.length > 0
            ? ` — all lean ${entry.leanings[0]}`
            : ''}
        </Text>
      ) : null}
    </View>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export function FollowTheMoneyCard({ storyId, headline, category, onPressMember }: Props) {
  const { colors } = useTheme();
  const { mpDonations, mediaOwnership, loading } = useFollowTheMoney(storyId);

  // Silent when loading or no data
  if (loading) return null;

  const hasMP = mpDonations.length > 0;
  const hasMedia = mediaOwnership.filter(m => m.outlets.length >= 2).length > 0;

  if (!hasMP && !hasMedia) return null;

  const grandTotal = mpDonations.reduce((sum, mp) => sum + mp.totalReceived, 0);
  const totalSourceCount = mediaOwnership.reduce((sum, m) => sum + m.outlets.length, 0);

  return (
    <View style={{ marginBottom: SPACING.xl }}>
      {/* Header */}
      <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.sm,
        marginBottom: SPACING.md,
      }}>
        <Ionicons name="cash-outline" size={20} color={MONEY_ACCENT} />
        <Text style={{
          fontSize: FONT_SIZE.heading,
          fontWeight: FONT_WEIGHT.bold,
          color: colors.text,
        }}>
          Follow the money
        </Text>
      </View>

      {/* MP donations section */}
      {hasMP ? (
        <View style={{ marginBottom: SPACING.lg }}>
          {mpDonations.map((mp) => (
            <MpDonationRow
              key={mp.memberId}
              mp={mp}
              colors={colors}
              onPress={() => onPressMember?.(mp.memberId)}
            />
          ))}

          {mpDonations.length > 1 ? (
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: SPACING.sm,
              paddingHorizontal: SPACING.sm,
              marginTop: SPACING.xs,
            }}>
              <Ionicons name="wallet-outline" size={14} color={colors.textMuted} />
              <Text style={{
                fontSize: FONT_SIZE.small,
                color: colors.textBody,
                fontWeight: FONT_WEIGHT.medium,
              }}>
                MPs in this story received {formatCurrency(grandTotal)} total in declared donations
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}

      {/* Media ownership section */}
      {hasMedia ? (
        <View>
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: SPACING.sm,
            marginBottom: SPACING.sm,
          }}>
            <Ionicons name="newspaper-outline" size={14} color={colors.textMuted} />
            <Text style={{
              fontSize: FONT_SIZE.subtitle,
              fontWeight: FONT_WEIGHT.semibold,
              color: colors.text,
            }}>
              Who's reporting this
            </Text>
          </View>

          {mediaOwnership
            .filter(m => m.outlets.length >= 2)
            .map((entry) => (
              <MediaOwnershipRow
                key={entry.owner}
                entry={entry}
                totalSources={totalSourceCount}
                colors={colors}
              />
            ))}
        </View>
      ) : null}

      {/* Footer */}
      <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.xs,
        marginTop: SPACING.sm,
      }}>
        <Ionicons name="information-circle-outline" size={10} color={colors.textMuted} />
        <Text style={{
          fontSize: FONT_SIZE.caption,
          color: colors.textMuted,
          fontWeight: FONT_WEIGHT.medium,
        }}>
          Source: AEC annual returns
        </Text>
      </View>
    </View>
  );
}
