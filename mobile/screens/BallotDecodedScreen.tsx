/**
 * Ballot Decoded — factual election guide for the user's electorate.
 *
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║  LEGAL GATE — DO NOT ENABLE WITHOUT:                               ║
 * ║  1. Defamation legal sign-off (candidate comparisons)              ║
 * ║  2. AEC electoral-authorisation review (this is "electoral matter" ║
 * ║     under the Commonwealth Electoral Act 1918, s.4)                ║
 * ║                                                                    ║
 * ║  Feature flag: 'ballot_decoded' — default OFF in featureFlags.ts   ║
 * ║  Can only be enabled via the remote `feature_flags` table after    ║
 * ║  legal clearance.                                                  ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 *
 * This feature touches "electoral matter" under Australian law.
 * It must carry an electoral authorisation statement if enabled during
 * an election period. The disclaimer component below is required.
 */
import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';
import { useUser } from '../context/UserContext';
import { useElectorateByPostcode } from '../hooks/useElectorateByPostcode';
import { useBallotGuide, BallotCandidate, VotingRecordByTopic } from '../hooks/useBallotGuide';
import { isFeatureEnabled } from '../lib/featureFlags';
import { SkeletonLoader } from '../components/SkeletonLoader';
import { SPACING, FONT_SIZE, FONT_WEIGHT, BORDER_RADIUS, SHADOWS, PARTY_COLORS } from '../constants/design';
import { decodeHtml } from '../utils/decodeHtml';

// ── Constants ────────────────────────────────────────────────────────────────

const GREEN = '#00843D';

const TOPIC_CONFIG: Record<string, { label: string; icon: keyof typeof Ionicons.glyphMap; color: string }> = {
  housing:        { label: 'Housing',           icon: 'home-outline',          color: '#E65100' },
  healthcare:     { label: 'Healthcare',        icon: 'medkit-outline',        color: '#DC2626' },
  health:         { label: 'Health',            icon: 'medkit-outline',        color: '#DC2626' },
  economy:        { label: 'Economy',           icon: 'trending-up-outline',   color: '#2563EB' },
  climate:        { label: 'Climate',           icon: 'leaf-outline',          color: '#059669' },
  immigration:    { label: 'Immigration',       icon: 'airplane-outline',      color: '#7C3AED' },
  defence:        { label: 'Defence',           icon: 'shield-outline',        color: '#1D4ED8' },
  education:      { label: 'Education',         icon: 'school-outline',        color: '#EA580C' },
  cost_of_living: { label: 'Cost of Living',    icon: 'cart-outline',          color: '#B45309' },
  indigenous:     { label: 'Indigenous Affairs', icon: 'earth-outline',        color: '#712B13' },
  technology:     { label: 'Technology',        icon: 'hardware-chip-outline', color: '#0891B2' },
  agriculture:    { label: 'Agriculture',       icon: 'nutrition-outline',     color: '#27500A' },
  infrastructure: { label: 'Infrastructure',    icon: 'construct-outline',     color: '#444441' },
  foreign_policy: { label: 'Foreign Policy',    icon: 'globe-outline',         color: '#0C447C' },
  justice:        { label: 'Justice',           icon: 'scale-outline',         color: '#6D28D9' },
};

function topicLabel(slug: string): string {
  return TOPIC_CONFIG[slug]?.label ?? slug.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function topicColor(slug: string): string {
  return TOPIC_CONFIG[slug]?.color ?? '#6B7280';
}

function topicIcon(slug: string): keyof typeof Ionicons.glyphMap {
  return TOPIC_CONFIG[slug]?.icon ?? 'help-circle-outline';
}

function partyColor(party: { colour?: string | null; name?: string } | null): string {
  if (party?.colour) return party.colour;
  const name = (party?.name ?? '').toLowerCase();
  if (name.includes('labor')) return PARTY_COLORS.ALP;
  if (name.includes('liberal') || name.includes('lnp')) return PARTY_COLORS.LNP;
  if (name.includes('green')) return PARTY_COLORS.GRN;
  if (name.includes('one nation')) return PARTY_COLORS.ONP;
  return PARTY_COLORS.OTH;
}

// ── Main Screen ──────────────────────────────────────────────────────────────

export function BallotDecodedScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const nav = useNavigation<any>();
  const { postcode } = useUser();
  const { electorate } = useElectorateByPostcode(postcode);
  const { candidates, electorate_name, loading, error, refresh } = useBallotGuide(electorate?.id ?? null);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [expandedCandidateId, setExpandedCandidateId] = useState<string | null>(null);

  const enabled = isFeatureEnabled('ballot_decoded');

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  // Collect all unique topics across candidates for Compare section
  const allTopics = useMemo(() => {
    const topicSet = new Set<string>();
    for (const c of candidates) {
      for (const p of c.policy_summary_by_topic) topicSet.add(p.category);
      for (const v of c.voting_record_by_topic) topicSet.add(v.topic);
    }
    return Array.from(topicSet).sort();
  }, [candidates]);

  // ── Legal gate: Coming Soon ────────────────────────────────────────────
  if (!enabled) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
        <Header colors={colors} onBack={() => nav.goBack()} subtitle={null} />
        <View style={styles.comingSoonWrap}>
          <View style={[styles.comingSoonCard, { backgroundColor: colors.card }, SHADOWS.md]}>
            <Ionicons name="lock-closed-outline" size={48} color={colors.textMuted} />
            <Text style={[styles.comingSoonTitle, { color: colors.text }]}>Coming Soon</Text>
            <Text style={[styles.comingSoonBody, { color: colors.textBody }]}>
              Ballot Decoded is currently under legal review to ensure compliance with Australian
              electoral law. We want to make sure this guide meets the highest standards of accuracy
              and impartiality before release.
            </Text>
            <View style={[styles.comingSoonBadge, { backgroundColor: colors.greenLight }]}>
              <Ionicons name="shield-checkmark-outline" size={16} color={GREEN} />
              <Text style={[styles.comingSoonBadgeText, { color: GREEN }]}>Legal review in progress</Text>
            </View>
          </View>
        </View>
      </View>
    );
  }

  // ── Loading skeleton ───────────────────────────────────────────────────
  if (loading && candidates.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
        <Header colors={colors} onBack={() => nav.goBack()} subtitle={electorate_name} />
        <View style={styles.skeletonWrap}>
          {[1, 2, 3].map(i => (
            <View key={i} style={[styles.candidateCard, { backgroundColor: colors.card }, SHADOWS.sm]}>
              <View style={styles.skeletonRow}>
                <SkeletonLoader width={48} height={48} borderRadius={BORDER_RADIUS.full} />
                <View style={{ marginLeft: SPACING.md, flex: 1 }}>
                  <SkeletonLoader width="60%" height={16} />
                  <SkeletonLoader width="40%" height={12} style={{ marginTop: SPACING.xs }} />
                </View>
              </View>
              <SkeletonLoader width="100%" height={60} style={{ marginTop: SPACING.md }} />
              <SkeletonLoader width="80%" height={14} style={{ marginTop: SPACING.sm }} />
            </View>
          ))}
        </View>
      </View>
    );
  }

  // ── Empty state ────────────────────────────────────────────────────────
  if (!loading && candidates.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
        <Header colors={colors} onBack={() => nav.goBack()} subtitle={electorate_name} />
        <View style={styles.emptyWrap}>
          <Ionicons name="people-outline" size={48} color={colors.textMuted} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>No candidates found</Text>
          <Text style={[styles.emptyBody, { color: colors.textBody }]}>
            {postcode
              ? 'We could not find active candidates for your electorate. Check back closer to the election.'
              : 'Set your postcode in your profile to see candidates for your electorate.'}
          </Text>
        </View>
      </View>
    );
  }

  // ── Main content ───────────────────────────────────────────────────────
  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <Header colors={colors} onBack={() => nav.goBack()} subtitle={electorate_name} />

      {/* Persistent disclaimer banner — always visible when scrolling */}
      <View style={{ backgroundColor: '#FFFBEB', paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm, borderBottomWidth: 1, borderBottomColor: '#FDE68A' }}>
        <Text style={{ fontSize: FONT_SIZE.caption, color: '#92400E', textAlign: 'center', fontWeight: FONT_WEIGHT.medium }}>
          Factual voting record only — not voting advice
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={GREEN} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* ── Your Candidates ──────────────────────────────────────────── */}
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Your Candidates</Text>

        {candidates.map(candidate => (
          <CandidateCard
            key={candidate.member.id}
            candidate={candidate}
            colors={colors}
            expanded={expandedCandidateId === candidate.member.id}
            onToggle={() =>
              setExpandedCandidateId(
                expandedCandidateId === candidate.member.id ? null : candidate.member.id
              )
            }
            onPressMember={() =>
              nav.navigate('MemberProfile', { member: candidate.member })
            }
          />
        ))}

        {/* ── Compare on Issues ────────────────────────────────────────── */}
        {allTopics.length > 0 && (
          <>
            <Text style={[styles.sectionTitle, { color: colors.text, marginTop: SPACING.xl }]}>
              Compare on Issues
            </Text>
            <Text style={[styles.sectionSubtitle, { color: colors.textBody }]}>
              Tap a topic to see all candidates side-by-side
            </Text>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.topicPillRow}
            >
              {allTopics.map(topic => {
                const active = selectedTopic === topic;
                const tc = topicColor(topic);
                return (
                  <Pressable
                    key={topic}
                    onPress={() => setSelectedTopic(active ? null : topic)}
                    style={[
                      styles.topicPill,
                      {
                        backgroundColor: active ? tc + '18' : colors.cardAlt,
                        borderColor: active ? tc : colors.border,
                      },
                    ]}
                  >
                    <Ionicons name={topicIcon(topic)} size={14} color={active ? tc : colors.textMuted} />
                    <Text
                      style={[
                        styles.topicPillText,
                        { color: active ? tc : colors.textBody },
                      ]}
                    >
                      {topicLabel(topic)}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            {selectedTopic && (
              <CompareSection
                topic={selectedTopic}
                candidates={candidates}
                colors={colors}
              />
            )}
          </>
        )}

        {/* ── Persistent legal disclaimer (required for electoral matter) ── */}
        <View style={[styles.disclaimerCard, { backgroundColor: '#FEF3C7', borderWidth: 1, borderColor: '#F59E0B' }]}>
          <Ionicons name="warning-outline" size={18} color="#92400E" />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: FONT_SIZE.small, fontWeight: FONT_WEIGHT.bold, color: '#92400E', marginBottom: SPACING.xs }}>
              NOT VOTING ADVICE
            </Text>
            <Text style={[styles.disclaimerText, { color: '#78350F' }]}>
              This is a factual voting record based on public parliamentary data. It is not a recommendation to vote for or against any candidate. Verify all information with official sources.
            </Text>
            <Text style={[styles.disclaimerText, { color: '#78350F', marginTop: SPACING.xs, fontStyle: 'italic' }]}>
              Source: TheyVoteForYou API, APH.gov.au, AEC.gov.au
            </Text>
          </View>
        </View>

        <View style={{ height: insets.bottom + SPACING.xl }} />
      </ScrollView>
    </View>
  );
}

// ── Sub-components ───────────────────────────────────────────────────────────

function Header({
  colors,
  onBack,
  subtitle,
}: {
  colors: any;
  onBack: () => void;
  subtitle: string | null;
}) {
  return (
    <View style={[styles.header, { borderBottomColor: colors.border }]}>
      <Pressable onPress={onBack} hitSlop={12} style={styles.backBtn}>
        <Ionicons name="chevron-back" size={24} color={colors.text} />
      </Pressable>
      <View style={styles.headerCenter}>
        <View style={styles.headerTitleRow}>
          <Ionicons name="document-text-outline" size={20} color={GREEN} style={{ marginRight: SPACING.xs }} />
          <Text style={[styles.headerTitle, { color: colors.text }]}>Ballot Decoded</Text>
        </View>
        {subtitle && (
          <Text style={[styles.headerSubtitle, { color: colors.textMuted }]}>{subtitle}</Text>
        )}
      </View>
      <View style={{ width: 32 }} />
    </View>
  );
}

function CandidateCard({
  candidate,
  colors,
  expanded,
  onToggle,
  onPressMember,
}: {
  candidate: BallotCandidate;
  colors: any;
  expanded: boolean;
  onToggle: () => void;
  onPressMember: () => void;
}) {
  const { member, party, policy_summary_by_topic, voting_record_by_topic } = candidate;
  const pc = partyColor(party);
  const fullName = `${member.first_name} ${member.last_name}`;
  const hasVotingRecord = voting_record_by_topic.length > 0;
  const hasPolicies = policy_summary_by_topic.length > 0;

  return (
    <View style={[styles.candidateCard, { backgroundColor: colors.card }, SHADOWS.sm]}>
      {/* Header row — tap to navigate to MP profile */}
      <Pressable onPress={onPressMember} style={styles.candidateHeader}>
        {member.photo_url ? (
          <Image
            source={{ uri: member.photo_url }}
            style={[styles.candidatePhoto, { borderColor: pc }]}
          />
        ) : (
          <View style={[styles.candidatePhotoPlaceholder, { backgroundColor: pc + '22', borderColor: pc }]}>
            <Text style={[styles.candidateInitials, { color: pc }]}>
              {member.first_name[0]}{member.last_name[0]}
            </Text>
          </View>
        )}
        <View style={styles.candidateInfo}>
          <Text style={[styles.candidateName, { color: colors.text }]} numberOfLines={1}>
            {fullName}
          </Text>
          <View style={styles.candidateMetaRow}>
            <View style={[styles.partyBadge, { backgroundColor: pc + '18' }]}>
              <Text style={[styles.partyBadgeText, { color: pc }]}>
                {party?.short_name ?? party?.name ?? 'Independent'}
              </Text>
            </View>
            {member.ministerial_role && (
              <Text style={[styles.roleText, { color: colors.textMuted }]} numberOfLines={1}>
                {member.ministerial_role}
              </Text>
            )}
          </View>
        </View>
        <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
      </Pressable>

      {/* Toggle expand for policies + votes */}
      <Pressable onPress={onToggle} style={[styles.expandToggle, { borderTopColor: colors.border }]}>
        <Text style={[styles.expandToggleText, { color: GREEN }]}>
          {expanded ? 'Hide details' : 'View policies & record'}
        </Text>
        <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color={GREEN} />
      </Pressable>

      {expanded && (
        <View style={[styles.expandedContent, { borderTopColor: colors.border }]}>
          {/* Key Policy Positions */}
          {hasPolicies ? (
            <>
              <Text style={[styles.expandedSectionTitle, { color: colors.text }]}>
                Key Policy Positions
              </Text>
              {policy_summary_by_topic.map((policy, idx) => (
                <View key={idx} style={[styles.policyRow, { borderBottomColor: colors.border }]}>
                  <View style={styles.policyHeader}>
                    <Ionicons
                      name={topicIcon(policy.category)}
                      size={14}
                      color={topicColor(policy.category)}
                    />
                    <Text style={[styles.policyTopic, { color: topicColor(policy.category) }]}>
                      {topicLabel(policy.category)}
                    </Text>
                  </View>
                  <Text style={[styles.policyText, { color: colors.textBody }]}>
                    {decodeHtml(policy.summary_plain)}
                  </Text>
                </View>
              ))}
            </>
          ) : (
            <Text style={[styles.noPoliciesText, { color: colors.textMuted }]}>
              No policy positions on record for this party.
            </Text>
          )}

          {/* Voting Record */}
          {hasVotingRecord && (
            <>
              <Text style={[styles.expandedSectionTitle, { color: colors.text, marginTop: SPACING.lg }]}>
                Voting Record
              </Text>
              {voting_record_by_topic.slice(0, 8).map(record => (
                <VotingBar key={record.topic} record={record} colors={colors} />
              ))}
            </>
          )}

          {!hasVotingRecord && !hasPolicies && (
            <Text style={[styles.noPoliciesText, { color: colors.textMuted }]}>
              No voting record available. This candidate may not be an incumbent.
            </Text>
          )}
        </View>
      )}
    </View>
  );
}

function VotingBar({ record, colors }: { record: VotingRecordByTopic; colors: any }) {
  const tc = topicColor(record.topic);
  const barWidth = `${Math.max(record.aye_rate, 2)}%`;

  return (
    <View style={styles.votingBarRow}>
      <View style={styles.votingBarLabel}>
        <Ionicons name={topicIcon(record.topic)} size={13} color={tc} />
        <Text style={[styles.votingBarTopic, { color: colors.text }]} numberOfLines={1}>
          {topicLabel(record.topic)}
        </Text>
      </View>
      <View style={styles.votingBarRight}>
        <View style={[styles.votingBarTrack, { backgroundColor: colors.cardAlt }]}>
          <View style={[styles.votingBarFill, { width: barWidth as any, backgroundColor: tc }]} />
        </View>
        <Text style={[styles.votingBarValue, { color: colors.textMuted }]}>
          {record.aye_rate}%
        </Text>
      </View>
    </View>
  );
}

function CompareSection({
  topic,
  candidates,
  colors,
}: {
  topic: string;
  candidates: BallotCandidate[];
  colors: any;
}) {
  const tc = topicColor(topic);

  return (
    <View style={[styles.compareCard, { backgroundColor: colors.card }, SHADOWS.sm]}>
      <View style={styles.compareHeader}>
        <Ionicons name={topicIcon(topic)} size={18} color={tc} />
        <Text style={[styles.compareTitle, { color: colors.text }]}>{topicLabel(topic)}</Text>
      </View>

      {candidates.map(candidate => {
        const { member, party, policy_summary_by_topic, voting_record_by_topic } = candidate;
        const pc = partyColor(party);
        const policy = policy_summary_by_topic.find(
          p => p.category.toLowerCase() === topic.toLowerCase()
        );
        const record = voting_record_by_topic.find(
          r => r.topic.toLowerCase() === topic.toLowerCase()
        );

        return (
          <View key={member.id} style={[styles.compareRow, { borderTopColor: colors.border }]}>
            <View style={styles.compareRowHeader}>
              <View style={[styles.compareDot, { backgroundColor: pc }]} />
              <Text style={[styles.compareRowName, { color: colors.text }]}>
                {member.first_name} {member.last_name}
              </Text>
              <Text style={[styles.compareRowParty, { color: colors.textMuted }]}>
                {party?.short_name ?? 'IND'}
              </Text>
            </View>

            {policy && (
              <Text style={[styles.comparePolicy, { color: colors.textBody }]}>
                {decodeHtml(policy.summary_plain)}
              </Text>
            )}

            {record && (
              <View style={styles.compareVoteRow}>
                <View style={[styles.votingBarTrack, { backgroundColor: colors.cardAlt, flex: 1 }]}>
                  <View
                    style={[
                      styles.votingBarFill,
                      { width: `${Math.max(record.aye_rate, 2)}%` as any, backgroundColor: tc },
                    ]}
                  />
                </View>
                <Text style={[styles.compareVoteText, { color: colors.textMuted }]}>
                  {record.aye_rate}% aye ({record.total_votes} votes)
                </Text>
              </View>
            )}

            {!policy && !record && (
              <Text style={[styles.compareNoData, { color: colors.textMuted }]}>
                No data on this topic
              </Text>
            )}
          </View>
        );
      })}
    </View>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
  },
  backBtn: {
    width: 32,
    alignItems: 'flex-start',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: FONT_SIZE.subtitle,
    fontWeight: FONT_WEIGHT.bold,
  },
  headerSubtitle: {
    fontSize: FONT_SIZE.small,
    marginTop: 2,
  },

  // Scroll
  scrollContent: {
    padding: SPACING.lg,
  },

  // Section titles
  sectionTitle: {
    fontSize: FONT_SIZE.title,
    fontWeight: FONT_WEIGHT.bold,
    marginBottom: SPACING.md,
  },
  sectionSubtitle: {
    fontSize: FONT_SIZE.small,
    marginBottom: SPACING.md,
    marginTop: -SPACING.xs,
  },

  // Candidate card
  candidateCard: {
    borderRadius: BORDER_RADIUS.lg,
    marginBottom: SPACING.md,
    overflow: 'hidden',
  },
  candidateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  candidatePhoto: {
    width: 48,
    height: 48,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 2,
  },
  candidatePhotoPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  candidateInitials: {
    fontSize: FONT_SIZE.subtitle,
    fontWeight: FONT_WEIGHT.bold,
  },
  candidateInfo: {
    flex: 1,
    marginLeft: SPACING.md,
  },
  candidateName: {
    fontSize: FONT_SIZE.subtitle,
    fontWeight: FONT_WEIGHT.semibold,
  },
  candidateMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.xs,
    gap: SPACING.sm,
  },
  partyBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.sm,
  },
  partyBadgeText: {
    fontSize: FONT_SIZE.caption,
    fontWeight: FONT_WEIGHT.semibold,
  },
  roleText: {
    fontSize: FONT_SIZE.caption,
    flex: 1,
  },

  // Expand toggle
  expandToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.sm,
    borderTopWidth: 1,
    gap: SPACING.xs,
  },
  expandToggleText: {
    fontSize: FONT_SIZE.small,
    fontWeight: FONT_WEIGHT.medium,
  },

  // Expanded content
  expandedContent: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.lg,
    borderTopWidth: 1,
  },
  expandedSectionTitle: {
    fontSize: FONT_SIZE.body,
    fontWeight: FONT_WEIGHT.semibold,
    marginTop: SPACING.md,
    marginBottom: SPACING.sm,
  },

  // Policy rows
  policyRow: {
    paddingVertical: SPACING.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  policyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginBottom: 4,
  },
  policyTopic: {
    fontSize: FONT_SIZE.small,
    fontWeight: FONT_WEIGHT.semibold,
  },
  policyText: {
    fontSize: FONT_SIZE.small,
    lineHeight: 18,
  },
  noPoliciesText: {
    fontSize: FONT_SIZE.small,
    fontStyle: 'italic',
    marginTop: SPACING.md,
  },

  // Voting bar
  votingBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  votingBarLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 110,
    gap: SPACING.xs,
  },
  votingBarTopic: {
    fontSize: FONT_SIZE.caption,
    fontWeight: FONT_WEIGHT.medium,
    flex: 1,
  },
  votingBarRight: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  votingBarTrack: {
    height: 8,
    borderRadius: 4,
    flex: 1,
    overflow: 'hidden',
  },
  votingBarFill: {
    height: 8,
    borderRadius: 4,
  },
  votingBarValue: {
    fontSize: FONT_SIZE.caption,
    fontWeight: FONT_WEIGHT.medium,
    width: 36,
    textAlign: 'right',
  },

  // Topic pills
  topicPillRow: {
    paddingBottom: SPACING.md,
    gap: SPACING.sm,
  },
  topicPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
    gap: SPACING.xs,
  },
  topicPillText: {
    fontSize: FONT_SIZE.small,
    fontWeight: FONT_WEIGHT.medium,
  },

  // Compare section
  compareCard: {
    borderRadius: BORDER_RADIUS.lg,
    marginTop: SPACING.sm,
    overflow: 'hidden',
  },
  compareHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.lg,
    gap: SPACING.sm,
  },
  compareTitle: {
    fontSize: FONT_SIZE.body,
    fontWeight: FONT_WEIGHT.semibold,
  },
  compareRow: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderTopWidth: 1,
  },
  compareRowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.xs,
    gap: SPACING.sm,
  },
  compareDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  compareRowName: {
    fontSize: FONT_SIZE.small,
    fontWeight: FONT_WEIGHT.semibold,
  },
  compareRowParty: {
    fontSize: FONT_SIZE.caption,
  },
  comparePolicy: {
    fontSize: FONT_SIZE.small,
    lineHeight: 18,
    marginBottom: SPACING.xs,
  },
  compareVoteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginTop: SPACING.xs,
  },
  compareVoteText: {
    fontSize: FONT_SIZE.caption,
    minWidth: 100,
  },
  compareNoData: {
    fontSize: FONT_SIZE.small,
    fontStyle: 'italic',
  },

  // Disclaimer
  disclaimerCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.md,
    marginTop: SPACING.xl,
    gap: SPACING.sm,
  },
  disclaimerText: {
    fontSize: FONT_SIZE.small,
    lineHeight: 18,
    flex: 1,
  },

  // Coming soon
  comingSoonWrap: {
    flex: 1,
    justifyContent: 'center',
    padding: SPACING.xl,
  },
  comingSoonCard: {
    alignItems: 'center',
    padding: SPACING.xxl,
    borderRadius: BORDER_RADIUS.lg,
  },
  comingSoonTitle: {
    fontSize: FONT_SIZE.title,
    fontWeight: FONT_WEIGHT.bold,
    marginTop: SPACING.lg,
    marginBottom: SPACING.sm,
  },
  comingSoonBody: {
    fontSize: FONT_SIZE.body,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: SPACING.lg,
  },
  comingSoonBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
    gap: SPACING.xs,
  },
  comingSoonBadgeText: {
    fontSize: FONT_SIZE.small,
    fontWeight: FONT_WEIGHT.semibold,
  },

  // Empty state
  emptyWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },
  emptyTitle: {
    fontSize: FONT_SIZE.title,
    fontWeight: FONT_WEIGHT.bold,
    marginTop: SPACING.lg,
    marginBottom: SPACING.sm,
  },
  emptyBody: {
    fontSize: FONT_SIZE.body,
    lineHeight: 22,
    textAlign: 'center',
  },

  // Skeleton
  skeletonWrap: {
    padding: SPACING.lg,
    gap: SPACING.md,
  },
  skeletonRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
