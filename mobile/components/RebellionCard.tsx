import React, { useRef, useEffect, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRebellionNarrative } from '../hooks/useRebellionNarrative';
import { useTheme } from '../context/ThemeContext';
import { SPACING, FONT_SIZE, FONT_WEIGHT, BORDER_RADIUS, SHADOWS } from '../constants/design';
import { timeAgo } from '../lib/timeAgo';
import { RebellionShareCard } from './ShareCards';
import { captureAndShare } from '../utils/shareContent';

interface Props {
  memberId: string;
  memberName: string;
  partyName: string;
  userId?: string;
  onPressRebellion?: (divisionId: string) => void;
}

function cleanDivisionTitle(name: string): string {
  return name.replace(/^Bills?\s*[—\-]\s*/i, '').trim();
}

export function RebellionCard({ memberId, memberName, partyName, userId, onPressRebellion }: Props) {
  const { rebellions, totalRebellions, rebellionRate, totalVotes, biggestRebellion, loading } = useRebellionNarrative(memberId);
  const { colors } = useTheme();
  const shareRef = useRef<any>(null);
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    if (sharing && totalRebellions > 0) {
      captureAndShare(shareRef, 'rebellion_report', memberId, userId)
        .finally(() => setSharing(false));
    }
  }, [sharing]);

  if (loading || totalRebellions === 0) return null;

  const recentFive = rebellions.slice(0, 5);

  return (
    <>
      <View style={{
        marginHorizontal: SPACING.lg + 4,
        marginBottom: SPACING.lg,
        backgroundColor: colors.card,
        borderRadius: BORDER_RADIUS.lg,
        ...SHADOWS.md,
        overflow: 'hidden',
      }}>
        {/* Header */}
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: SPACING.lg,
          paddingTop: SPACING.lg,
          paddingBottom: SPACING.sm,
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.sm }}>
            <Ionicons name="git-branch-outline" size={18} color="#b45309" />
            <Text style={{ fontSize: FONT_SIZE.subtitle, fontWeight: FONT_WEIGHT.bold, color: colors.text }}>
              Broke with party
            </Text>
            <View style={{
              backgroundColor: '#fef3c7',
              borderRadius: BORDER_RADIUS.full,
              minWidth: 24,
              height: 24,
              justifyContent: 'center',
              alignItems: 'center',
              paddingHorizontal: SPACING.sm,
            }}>
              <Text style={{ fontSize: FONT_SIZE.small, fontWeight: FONT_WEIGHT.bold, color: '#b45309' }}>
                {totalRebellions}
              </Text>
            </View>
          </View>
          <Pressable onPress={() => setSharing(true)} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Ionicons name="share-outline" size={16} color="#00843D" />
            <Text style={{ fontSize: FONT_SIZE.small, fontWeight: FONT_WEIGHT.semibold, color: '#00843D' }}>Share</Text>
          </Pressable>
        </View>

        {/* Hero stat */}
        <View style={{ paddingHorizontal: SPACING.lg, paddingTop: SPACING.sm, paddingBottom: SPACING.md }}>
          <Text style={{ fontSize: FONT_SIZE.heading, fontWeight: FONT_WEIGHT.bold, color: colors.text, lineHeight: 30 }}>
            {totalRebellions} time{totalRebellions !== 1 ? 's' : ''}{' '}
            <Text style={{ color: colors.textBody, fontWeight: FONT_WEIGHT.regular }}>
              {memberName} voted against {partyName}
            </Text>
          </Text>
        </View>

        {/* Rebellion rate bar */}
        <View style={{ paddingHorizontal: SPACING.lg, paddingBottom: SPACING.lg }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACING.xs }}>
            <Text style={{ fontSize: FONT_SIZE.small, fontWeight: FONT_WEIGHT.semibold, color: colors.textBody }}>
              {rebellionRate}% independence rate
            </Text>
            <Text style={{ fontSize: FONT_SIZE.caption, color: colors.textMuted }}>
              {totalRebellions} of {totalVotes} votes
            </Text>
          </View>
          <View style={{ height: 6, backgroundColor: colors.cardAlt, borderRadius: 3, overflow: 'hidden' }}>
            <View style={{
              height: 6,
              width: `${Math.min(rebellionRate, 100)}%`,
              backgroundColor: '#b45309',
              borderRadius: 3,
            }} />
          </View>
        </View>

        {/* Most significant break */}
        {biggestRebellion && (
          <View style={{
            marginHorizontal: SPACING.lg,
            marginBottom: SPACING.lg,
            backgroundColor: '#fef3c7',
            borderRadius: BORDER_RADIUS.md,
            padding: SPACING.md,
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, marginBottom: SPACING.xs }}>
              <Ionicons name="alert-circle-outline" size={14} color="#92400E" />
              <Text style={{ fontSize: FONT_SIZE.caption, fontWeight: FONT_WEIGHT.bold, color: '#92400E', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Most significant break
              </Text>
            </View>
            <Text style={{ fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.semibold, color: '#1a2332', lineHeight: 20 }} numberOfLines={2}>
              {cleanDivisionTitle(biggestRebellion.divisionName)}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginTop: SPACING.xs }}>
              <Text style={{ fontSize: FONT_SIZE.caption, color: '#92400E' }}>
                {biggestRebellion.date ? new Date(biggestRebellion.date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }) : ''}
              </Text>
              <View style={{
                backgroundColor: biggestRebellion.voteCast === 'aye' ? 'rgba(0,132,61,0.15)' : 'rgba(220,53,69,0.15)',
                borderRadius: 4,
                paddingHorizontal: 6,
                paddingVertical: 1,
              }}>
                <Text style={{
                  fontSize: 10,
                  fontWeight: FONT_WEIGHT.bold,
                  color: biggestRebellion.voteCast === 'aye' ? '#00843D' : '#DC3545',
                }}>
                  Voted {biggestRebellion.voteCast === 'aye' ? 'AYE' : biggestRebellion.voteCast === 'no' ? 'NO' : biggestRebellion.voteCast.toUpperCase()}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Recent rebellions */}
        {recentFive.length > 0 && (
          <View style={{ borderTopWidth: 0.5, borderTopColor: colors.border }}>
            <Text style={{
              fontSize: FONT_SIZE.caption,
              fontWeight: FONT_WEIGHT.bold,
              color: colors.textMuted,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
              paddingHorizontal: SPACING.lg,
              paddingTop: SPACING.md,
              paddingBottom: SPACING.sm,
            }}>
              Recent rebellions
            </Text>
            {recentFive.map((r, idx) => {
              const isAye = r.voteCast === 'aye';
              const isNo = r.voteCast === 'no';
              return (
                <Pressable
                  key={r.id + '-' + idx}
                  onPress={() => onPressRebellion?.(r.id)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingHorizontal: SPACING.lg,
                    paddingVertical: SPACING.md,
                    borderBottomWidth: idx < recentFive.length - 1 ? 0.5 : 0,
                    borderBottomColor: colors.border,
                  }}
                >
                  <View style={{ flex: 1, marginRight: SPACING.md }}>
                    <Text style={{ fontSize: FONT_SIZE.small, fontWeight: FONT_WEIGHT.medium, color: colors.text, lineHeight: 18 }} numberOfLines={2}>
                      {cleanDivisionTitle(r.divisionName)}
                    </Text>
                    <Text style={{ fontSize: FONT_SIZE.caption, color: colors.textMuted, marginTop: 2 }}>
                      {r.date ? timeAgo(r.date) : ''}
                    </Text>
                  </View>
                  <View style={{
                    backgroundColor: isAye ? 'rgba(0,132,61,0.12)' : isNo ? 'rgba(220,38,38,0.12)' : colors.cardAlt,
                    borderRadius: 6,
                    paddingHorizontal: 10,
                    paddingVertical: 4,
                  }}>
                    <Text style={{
                      fontSize: 12,
                      fontWeight: FONT_WEIGHT.bold,
                      color: isAye ? '#00843D' : isNo ? '#DC2626' : colors.textMuted,
                    }}>
                      {isAye ? 'Aye' : isNo ? 'No' : r.voteCast || '-'}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}
      </View>

      {/* Hidden share card for view-shot capture */}
      <View style={{ position: 'absolute', left: -9999, top: 0 }} pointerEvents="none">
        <View ref={shareRef}>
          {sharing && biggestRebellion && (
            <RebellionShareCard
              memberName={memberName}
              partyName={partyName}
              rebellionCount={totalRebellions}
              rebellionRate={rebellionRate}
              biggestRebellion={biggestRebellion}
            />
          )}
        </View>
      </View>
    </>
  );
}
