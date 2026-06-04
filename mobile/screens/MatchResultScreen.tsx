import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, Pressable, ScrollView, Modal, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { useTheme } from '../context/ThemeContext';
import { useMatchResult, useMatchVotes } from '../hooks/useVerityMatch';
import { MatchFlexShareCard } from '../components/ShareCards';
import { SourceTrace } from '../components/SourceTrace';
import { SkeletonLoader } from '../components/SkeletonLoader';
import { SPACING, FONT_SIZE, FONT_WEIGHT, BORDER_RADIUS, SHADOWS, PARTY_COLORS } from '../constants/design';
import { hapticLight } from '../lib/haptics';
import { supabase } from '../lib/supabase';
import { captureAndShare } from '../utils/shareContent';
import { useUser } from '../context/UserContext';

// ── Ring gauge ──────────────────────────────────────────────────────────

function MatchRing({ pct, size = 160 }: { pct: number | null; size?: number }) {
  const { colors } = useTheme();
  const borderW = 10;

  return (
    <View style={{
      width: size, height: size, borderRadius: size / 2,
      borderWidth: borderW, borderColor: pct != null ? '#00843D' : colors.border,
      alignItems: 'center', justifyContent: 'center',
      backgroundColor: 'transparent',
    }}>
      {pct != null ? (
        <Text style={{ fontSize: 42, fontWeight: FONT_WEIGHT.bold, color: '#fff' }}>
          {Math.round(pct)}%
        </Text>
      ) : (
        <Ionicons name="help-circle-outline" size={36} color="rgba(255,255,255,0.6)" />
      )}
    </View>
  );
}

// ── Alignment chip ──────────────────────────────────────────────────────

function AlignmentChip({ state }: { state: string }) {
  const config = state === 'aligned'
    ? { label: 'Aligned', bg: '#10B98115', color: '#10B981' }
    : state === 'gap'
    ? { label: 'Gap', bg: '#F59E0B15', color: '#F59E0B' }
    : state === 'big_gap'
    ? { label: 'Big gap', bg: '#DC354515', color: '#DC3545' }
    : { label: 'No data', bg: '#6B728015', color: '#6B7280' };

  return (
    <View style={{
      paddingHorizontal: SPACING.sm, paddingVertical: SPACING.xs,
      borderRadius: BORDER_RADIUS.sm, backgroundColor: config.bg,
    }}>
      <Text style={{ fontSize: FONT_SIZE.caption, fontWeight: FONT_WEIGHT.semibold, color: config.color }}>
        {config.label}
      </Text>
    </View>
  );
}

// ── Contributing votes modal ────────────────────────────────────────────

function VotesModal({
  visible, memberId, issueSlug, issueName, onClose,
}: {
  visible: boolean; memberId: string; issueSlug: string | null; issueName: string; onClose: () => void;
}) {
  const { colors } = useTheme();
  const { votes, loading } = useMatchVotes(visible ? memberId : null, issueSlug);

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' }}>
        <View style={{
          backgroundColor: colors.card,
          borderTopLeftRadius: BORDER_RADIUS.lg, borderTopRightRadius: BORDER_RADIUS.lg,
          padding: SPACING.xl, paddingBottom: SPACING.xxxl, maxHeight: '80%',
        }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.lg }}>
            <Text style={{ fontSize: FONT_SIZE.title, fontWeight: FONT_WEIGHT.bold, color: colors.text, flex: 1 }}>
              {issueName} — Votes
            </Text>
            <Pressable onPress={onClose} hitSlop={12}>
              <Ionicons name="close" size={24} color={colors.textMuted} />
            </Pressable>
          </View>

          {loading ? (
            <ActivityIndicator color="#00843D" />
          ) : (
            <ScrollView showsVerticalScrollIndicator={false}>
              {votes.map((v, i) => (
                <View key={v.division_id + i} style={{
                  paddingVertical: SPACING.md,
                  borderBottomWidth: i < votes.length - 1 ? 0.5 : 0,
                  borderBottomColor: colors.border,
                }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: 4 }}>
                    <View style={{
                      width: 8, height: 8, borderRadius: 4,
                      backgroundColor: v.vote_signal === 'support' ? '#10B981' : '#DC3545',
                    }} />
                    <Text style={{ fontSize: FONT_SIZE.caption, color: colors.textMuted }}>
                      {v.division_date} · Voted {v.vote_cast.toUpperCase()}
                    </Text>
                  </View>
                  <Text style={{ fontSize: FONT_SIZE.body, color: colors.text, lineHeight: 20 }} numberOfLines={2}>
                    {v.division_name}
                  </Text>
                  {v.rationale && (
                    <Text style={{ fontSize: FONT_SIZE.small, color: colors.textMuted, marginTop: 2, fontStyle: 'italic' }}>
                      {v.rationale}
                    </Text>
                  )}
                </View>
              ))}
              {votes.length === 0 && (
                <Text style={{ fontSize: FONT_SIZE.body, color: colors.textMuted, textAlign: 'center', marginTop: SPACING.xl }}>
                  No contributing votes found
                </Text>
              )}
            </ScrollView>
          )}

          <Text style={{
            fontSize: FONT_SIZE.caption, color: colors.textMuted,
            marginTop: SPACING.lg, fontStyle: 'italic', lineHeight: 16,
          }}>
            Source: TheyVoteForYou API · Division votes tagged by Verity AI
          </Text>
        </View>
      </View>
    </Modal>
  );
}

// ── Methodology modal ───────────────────────────────────────────────────

function MethodologyModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { colors } = useTheme();

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' }}>
        <View style={{
          backgroundColor: colors.card,
          borderTopLeftRadius: BORDER_RADIUS.lg, borderTopRightRadius: BORDER_RADIUS.lg,
          padding: SPACING.xl, paddingBottom: SPACING.xxxl, maxHeight: '80%',
        }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.lg }}>
            <Text style={{ fontSize: FONT_SIZE.title, fontWeight: FONT_WEIGHT.bold, color: colors.text }}>
              How We Score This
            </Text>
            <Pressable onPress={onClose} hitSlop={12}>
              <Ionicons name="close" size={24} color={colors.textMuted} />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={{ fontSize: FONT_SIZE.body, color: colors.text, lineHeight: 22, marginBottom: SPACING.lg }}>
              Your Verity Match measures how closely an MP's real voting record aligns with your stated positions on key policy issues.
            </Text>

            <Text style={{ fontSize: FONT_SIZE.subtitle, fontWeight: FONT_WEIGHT.semibold, color: colors.text, marginBottom: SPACING.sm }}>
              1. Division tagging
            </Text>
            <Text style={{ fontSize: FONT_SIZE.body, color: colors.textMuted, lineHeight: 22, marginBottom: SPACING.lg }}>
              Each parliamentary division (vote) is classified by AI into 0-2 policy issues, with a confidence score. Only high-confidence tags (60%+) count toward scoring. Tags can be overridden by human review.
            </Text>

            <Text style={{ fontSize: FONT_SIZE.subtitle, fontWeight: FONT_WEIGHT.semibold, color: colors.text, marginBottom: SPACING.sm }}>
              2. MP lean
            </Text>
            <Text style={{ fontSize: FONT_SIZE.body, color: colors.textMuted, lineHeight: 22, marginBottom: SPACING.lg }}>
              For each issue, we calculate whether the MP's votes lean toward the "support" or "oppose" side, accounting for the fact that voting Aye doesn't always mean support (e.g., voting Aye on an amendment that weakens a bill).
            </Text>

            <Text style={{ fontSize: FONT_SIZE.subtitle, fontWeight: FONT_WEIGHT.semibold, color: colors.text, marginBottom: SPACING.sm }}>
              3. Your match
            </Text>
            <Text style={{ fontSize: FONT_SIZE.body, color: colors.textMuted, lineHeight: 22, marginBottom: SPACING.lg }}>
              We compare your stance on each issue with the MP's lean, weighted by how important each issue is to you. Issues where you haven't stated a position or the MP has fewer than 3 votes are excluded.
            </Text>

            <Text style={{ fontSize: FONT_SIZE.subtitle, fontWeight: FONT_WEIGHT.semibold, color: colors.text, marginBottom: SPACING.sm }}>
              4. Integrity guards
            </Text>
            <Text style={{ fontSize: FONT_SIZE.body, color: colors.textMuted, lineHeight: 22, marginBottom: SPACING.lg }}>
              If an MP has fewer than 8 contributing votes across your chosen issues, we show "limited data" instead of a percentage. We never show a misleading score.
            </Text>

            <Text style={{ fontSize: FONT_SIZE.caption, color: colors.textMuted, fontStyle: 'italic', lineHeight: 16 }}>
              Data source: TheyVoteForYou API (parliamentary divisions). Division tagging: Verity AI with human override. Every score is tap-traceable to its contributing votes.
            </Text>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// ── Party alignment bar ─────────────────────────────────────────────────

const PARTY_COLOR_MAP: Record<string, string> = {
  ALP: PARTY_COLORS.ALP,
  LPB: PARTY_COLORS.LNP,
  NPT: PARTY_COLORS.LNP,
  AGS: PARTY_COLORS.GRN,
  PHO: PARTY_COLORS.ONP,
  IND: PARTY_COLORS.IND,
};

function getPartyColor(abbreviation: string | null): string {
  if (!abbreviation) return PARTY_COLORS.OTH;
  return PARTY_COLOR_MAP[abbreviation] ?? PARTY_COLORS.OTH;
}

// ── Main Screen ─────────────────────────────────────────────────────────

export function MatchResultScreen({ route, navigation }: { route: any; navigation: any }) {
  const { memberId } = route.params as { memberId: string };
  const { colors } = useTheme();
  const { user } = useUser();
  const { data, loading, error } = useMatchResult(memberId);
  const [member, setMember] = useState<any>(null);
  const [showMethodology, setShowMethodology] = useState(false);
  const [votesModal, setVotesModal] = useState<{ slug: string; name: string } | null>(null);
  const matchCardRef = useRef<View>(null);

  const handleShare = () => {
    hapticLight();
    if (matchCardRef.current && data?.overall_match_pct != null && member) {
      captureAndShare(matchCardRef, 'match_flex', memberId, user?.id);
    }
  };

  // Load member info
  useEffect(() => {
    supabase
      .from('members')
      .select('id, first_name, last_name, photo_url, party:parties!members_party_id_fkey(name, short_name, colour, abbreviation), electorate:electorates!members_electorate_id_fkey(name, state)')
      .eq('id', memberId)
      .single()
      .then(({ data: m }) => {
        if (m) {
          const party = Array.isArray(m.party) ? m.party[0] : m.party;
          const electorate = Array.isArray(m.electorate) ? m.electorate[0] : m.electorate;
          setMember({ ...m, party, electorate });
        }
      });
  }, [memberId]);

  if (loading || !member) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={{ padding: 20, gap: 16 }}>
          <SkeletonLoader width="100%" height={200} />
          <SkeletonLoader width="100%" height={60} />
          <SkeletonLoader width="100%" height={300} />
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
        <Ionicons name="alert-circle-outline" size={48} color={colors.textMuted} />
        <Text style={{ fontSize: FONT_SIZE.body, color: colors.textMuted, marginTop: SPACING.md, textAlign: 'center' }}>
          {error}
        </Text>
        <Pressable onPress={() => navigation.goBack()} style={{ marginTop: SPACING.xl }}>
          <Text style={{ fontSize: FONT_SIZE.body, color: '#00843D', fontWeight: FONT_WEIGHT.semibold }}>Go back</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const partyColor = member.party?.colour ?? getPartyColor(member.party?.abbreviation);
  const bigGap = data?.biggest_gap;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <LinearGradient
          colors={['#00843D', '#006B31']}
          style={{ paddingHorizontal: 20, paddingTop: SPACING.lg, paddingBottom: SPACING.xxl }}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.xl }}>
            <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </Pressable>
            <Text style={{ fontSize: FONT_SIZE.subtitle, fontWeight: FONT_WEIGHT.bold, color: '#fff' }}>
              Verity Match
            </Text>
            <Pressable onPress={handleShare} hitSlop={12}>
              <Ionicons name="share-outline" size={22} color="#fff" />
            </Pressable>
          </View>

          {/* Hero ring */}
          <View style={{ alignItems: 'center' }}>
            <MatchRing pct={data?.overall_match_pct ?? null} />
            {data?.limited_data ? (
              <Text style={{ fontSize: FONT_SIZE.body, color: 'rgba(255,255,255,0.8)', textAlign: 'center', marginTop: SPACING.md, paddingHorizontal: 20 }}>
                We need more of your MP's votes to score this accurately
              </Text>
            ) : (
              <Text style={{ fontSize: FONT_SIZE.body, color: 'rgba(255,255,255,0.8)', textAlign: 'center', marginTop: SPACING.md }}>
                aligned with your MP on what matters to you
              </Text>
            )}
          </View>
        </LinearGradient>

        {/* MP identity row */}
        <View style={{
          flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
          paddingHorizontal: 20, paddingVertical: SPACING.lg,
          marginTop: -SPACING.lg, marginHorizontal: 20,
          backgroundColor: colors.card, borderRadius: BORDER_RADIUS.lg,
          ...SHADOWS.md,
        }}>
          {member.photo_url ? (
            <Image
              source={{ uri: member.photo_url }}
              style={{ width: 52, height: 52, borderRadius: 26, borderWidth: 2, borderColor: partyColor }}
              contentFit="cover"
            />
          ) : (
            <View style={{
              width: 52, height: 52, borderRadius: 26, borderWidth: 2, borderColor: partyColor,
              backgroundColor: colors.surface, justifyContent: 'center', alignItems: 'center',
            }}>
              <Text style={{ fontSize: FONT_SIZE.title, fontWeight: FONT_WEIGHT.bold, color: partyColor }}>
                {member.first_name?.[0]}{member.last_name?.[0]}
              </Text>
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: FONT_SIZE.subtitle, fontWeight: FONT_WEIGHT.bold, color: colors.text }}>
              {member.first_name} {member.last_name}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, marginTop: 2 }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: partyColor }} />
              <Text style={{ fontSize: FONT_SIZE.small, color: colors.textMuted }}>
                {member.party?.name ?? 'Unknown'} · {member.electorate?.name ?? ''}
              </Text>
            </View>
          </View>
        </View>

        {/* Where you line up */}
        {data && data.per_issue.length > 0 && (
          <View style={{ marginTop: SPACING.xl, paddingHorizontal: 20 }}>
            <Text style={{ fontSize: FONT_SIZE.title, fontWeight: FONT_WEIGHT.bold, color: colors.text, marginBottom: SPACING.md }}>
              Where you line up
            </Text>
            <View style={{ backgroundColor: colors.card, borderRadius: BORDER_RADIUS.lg, ...SHADOWS.sm }}>
              {data.per_issue.map((issue, i) => (
                <Pressable
                  key={issue.issue_slug}
                  onPress={() => {
                    if (issue.alignment_state !== 'insufficient_data') {
                      hapticLight();
                      setVotesModal({ slug: issue.issue_slug, name: issue.issue_name });
                    }
                  }}
                  style={{
                    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
                    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md,
                    borderBottomWidth: i < data.per_issue.length - 1 ? 0.5 : 0,
                    borderBottomColor: colors.border,
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.medium, color: colors.text }}>
                      {issue.issue_name}
                    </Text>
                    {issue.mp_sample > 0 && (
                      <Text style={{ fontSize: FONT_SIZE.caption, color: colors.textMuted, marginTop: 2 }}>
                        {issue.mp_sample} votes
                      </Text>
                    )}
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.sm }}>
                    <AlignmentChip state={issue.alignment_state} />
                    {issue.alignment_state !== 'insufficient_data' && (
                      <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                    )}
                  </View>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {/* Biggest gap callout */}
        {bigGap && (
          <Pressable
            onPress={() => { hapticLight(); setVotesModal({ slug: bigGap.issue_slug, name: bigGap.issue_name }); }}
            style={{
              marginTop: SPACING.xl, marginHorizontal: 20,
              backgroundColor: '#DC354510', borderRadius: BORDER_RADIUS.lg,
              padding: SPACING.lg, borderLeftWidth: 4, borderLeftColor: '#DC3545',
            }}
          >
            <Text style={{ fontSize: FONT_SIZE.small, fontWeight: FONT_WEIGHT.semibold, color: '#DC3545', marginBottom: SPACING.xs }}>
              YOUR BIGGEST GAP
            </Text>
            <Text style={{ fontSize: FONT_SIZE.body, color: colors.text, lineHeight: 22 }}>
              You {bigGap.user_stance > 0 ? 'support' : 'oppose'} {bigGap.issue_name.toLowerCase()}.
              {' '}Your MP voted {bigGap.mp_lean > 0 ? 'for' : 'against'} it {bigGap.mp_sample} times.
            </Text>
            <Text style={{ fontSize: FONT_SIZE.small, color: '#DC3545', marginTop: SPACING.sm }}>
              See the votes →
            </Text>
          </Pressable>
        )}

        {/* Party alignment */}
        {data?.party_alignment && data.party_alignment.length > 0 && (
          <View style={{ marginTop: SPACING.xl, paddingHorizontal: 20 }}>
            <Text style={{ fontSize: FONT_SIZE.title, fontWeight: FONT_WEIGHT.bold, color: colors.text, marginBottom: SPACING.md }}>
              You're most aligned with
            </Text>
            <View style={{ backgroundColor: colors.card, borderRadius: BORDER_RADIUS.lg, padding: SPACING.lg, ...SHADOWS.sm }}>
              {data.party_alignment.slice(0, 6).map((party, i) => {
                const pColor = getPartyColor(party.abbreviation);
                const pct = party.match_pct ?? 0;
                return (
                  <View key={party.party_id} style={{ marginBottom: i < 5 ? SPACING.md : 0 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: SPACING.xs }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.sm }}>
                        <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: pColor }} />
                        <Text style={{ fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.medium, color: colors.text }}>
                          {party.short_name ?? party.party_name}
                        </Text>
                      </View>
                      <Text style={{ fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.semibold, color: pColor }}>
                        {pct}%
                      </Text>
                    </View>
                    <View style={{ height: 6, backgroundColor: colors.surface, borderRadius: 3, overflow: 'hidden' }}>
                      <View style={{ height: 6, width: `${pct}%`, backgroundColor: pColor, borderRadius: 3 }} />
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* Methodology / source trace */}
        <View style={{ marginTop: SPACING.xl, paddingHorizontal: 20 }}>
          <SourceTrace
            label={`Based on ${data?.total_contributing_votes ?? 0} real votes this term`}
            sublabel="TheyVoteForYou API · Division tagging by Verity AI"
            onPress={() => setShowMethodology(true)}
          />
        </View>

        {/* Share CTA */}
        <View style={{ paddingHorizontal: 20, marginTop: SPACING.xl }}>
          <Pressable
            onPress={handleShare}
            style={{
              paddingVertical: SPACING.lg, borderRadius: BORDER_RADIUS.md,
              backgroundColor: '#00843D', alignItems: 'center',
            }}
          >
            <Text style={{ fontSize: FONT_SIZE.subtitle, fontWeight: FONT_WEIGHT.bold, color: '#fff' }}>
              Share your Match
            </Text>
          </Pressable>
        </View>
      </ScrollView>

      {/* Offscreen share card — captured by react-native-view-shot */}
      {data?.overall_match_pct != null && member && (
        <View style={{ position: 'absolute', left: -9999, top: 0 }} pointerEvents="none">
          <View ref={matchCardRef}>
            <MatchFlexShareCard
              matchPct={Math.round(data.overall_match_pct)}
              mpName={`${member.first_name} ${member.last_name}`}
              mpPhotoUrl={member.photo_url}
              partyName={member.party?.short_name ?? member.party?.name ?? ''}
              partyColour={partyColor}
              electorate={member.electorate?.name ?? ''}
              topAligned={data.per_issue.filter(i => i.alignment_state === 'aligned').map(i => i.issue_name)}
              topGaps={data.per_issue.filter(i => i.alignment_state === 'big_gap').map(i => i.issue_name)}
            />
          </View>
        </View>
      )}

      {/* Modals */}
      <MethodologyModal visible={showMethodology} onClose={() => setShowMethodology(false)} />
      {votesModal && (
        <VotesModal
          visible={!!votesModal}
          memberId={memberId}
          issueSlug={votesModal.slug}
          issueName={votesModal.name}
          onClose={() => setVotesModal(null)}
        />
      )}
    </SafeAreaView>
  );
}
