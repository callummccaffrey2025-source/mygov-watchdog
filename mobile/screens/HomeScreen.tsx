import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  TextInput,
  Pressable,
  Alert,
  Keyboard,
  Linking,
  Share,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useUser } from '../context/UserContext';
import { useBills } from '../hooks/useBills';
import { usePolls } from '../hooks/usePolls';
import { useElectorateByPostcode } from '../hooks/useElectorateByPostcode';
import { useTheme } from '../context/ThemeContext';
import { BillCard } from '../components/BillCard';
import { PollCard } from '../components/PollCard';
import { PartyBadge } from '../components/PartyBadge';
import { SkeletonLoader } from '../components/SkeletonLoader';
import { supabase } from '../lib/supabase';
import { Member } from '../hooks/useMembers';
import { useRecentDivisions } from '../hooks/useRecentDivisions';
import { useNewsItems } from '../hooks/useNewsItems';
import { useNewsStories, NewsStory } from '../hooks/useNewsStories';
import { NewsShareCard } from '../components/ShareCards';
import { captureAndShare } from '../utils/shareContent';
import { decodeHtml } from '../utils/decodeHtml';
import { CoverageBar } from '../components/CoverageBar';
import { useVotes } from '../hooks/useVotes';
import { useDailyBrief } from '../hooks/useDailyBrief';
import { useRepresentativeUpdates, RepresentativeUpdate } from '../hooks/useRepresentativeUpdates';
import { Bill } from '../hooks/useBills';
import { topicBg, topicAccent } from '../constants/topicColors';
import { Image } from 'expo-image';
import { usePersonalisedFeed, filterPoliticalStories } from '../hooks/usePersonalisedFeed';
import { timeAgo } from '../lib/timeAgo';
import { SPACING, FONT_SIZE, FONT_WEIGHT, BORDER_RADIUS, SHADOWS } from '../constants/design';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { hapticLight } from '../lib/haptics';
import { HomeScreenSkeleton } from '../components/HomeScreenSkeleton';
import { AuthPromptSheet } from '../components/AuthPromptSheet';
import { useAuthGate } from '../hooks/useAuthGate';
import { track } from '../lib/analytics';

function cleanDivisionName(raw: string): string {
  return raw
    .replace(/^[A-Za-z\s]+\s*[—–]\s*/i, '')
    .replace(/\s*[-;]\s*(first|second|third|fourth|consideration|agree|pass|against|final|bill as passed).*$/i, '')
    .trim();
}

function categoryBorderColor(cat: string): string {
  return topicAccent(cat);
}

function categoryColor(cat: string): string {
  return topicBg(cat);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────


function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

// ─── MP Card ─────────────────────────────────────────────────────────────────

function MPCard({ member, onPress }: { member: Member; onPress: () => void }) {
  const { colors } = useTheme();
  const party = member.party;
  const partyColour = party?.colour || '#9aabb8';
  const initials = `${member.first_name[0]}${member.last_name[0]}`;

  return (
    <Pressable style={[styles.mpCard, { borderLeftColor: partyColour }]} onPress={onPress}>
      {/* Avatar */}
      <View style={[styles.mpAvatar, { backgroundColor: partyColour + '22' }]}>
        <Text style={[styles.mpInitials, { color: partyColour }]}>{initials}</Text>
      </View>

      {/* Info */}
      <View style={styles.mpInfo}>
        <Text style={[styles.mpName, { color: colors.text }]}>{member.first_name} {member.last_name}</Text>
        {party && (
          <PartyBadge
            name={party.short_name || party.abbreviation || party.name}
            colour={party.colour}
            size="sm"
          />
        )}
        {member.electorate && (
          <Text style={[styles.mpElectorate, { color: colors.textMuted }]}>{member.electorate.name}, {member.electorate.state}</Text>
        )}
      </View>

      {/* Arrow */}
      <View style={styles.mpArrow}>
        <Text style={[styles.mpArrowText, { color: partyColour }]}>View Profile</Text>
        <Ionicons name="chevron-forward" size={14} color={partyColour} />
      </View>
    </Pressable>
  );
}

// ─── Daily Brief ─────────────────────────────────────────────────────────────

const CIVIC_FACTS = [
  `Australia has compulsory voting — over 96% of eligible citizens voted in the 2022 federal election.`,
  `A bill must pass both the House of Representatives and the Senate before it becomes law.`,
  `The Prime Minister is not directly elected — they lead whichever party holds majority support in the House.`,
  `Australia became a federation on 1 January 1901 when six British colonies united.`,
  `The Senate has 76 senators — 12 from each state and 2 each from the ACT and NT.`,
  `The House of Representatives has 151 members, each representing one electoral division.`,
  `Senators serve six-year terms; half are elected every three years at a regular election.`,
  `The Governor-General represents the King as Australia's head of state.`,
  `A double dissolution can be called when the Senate twice rejects a bill from the House.`,
  `Australia's Constitution can only be changed by a referendum requiring a national majority in four of six states.`,
  `Australia uses preferential (instant-runoff) voting — you rank candidates from 1 to last.`,
  `The Senate uses proportional representation, making it easier for minor parties to win seats.`,
  `Question Time runs each sitting day — 45 minutes where the opposition questions the government.`,
  `Royal Assent from the Governor-General is required before a bill becomes an Act of Parliament.`,
  `The longest-serving PM was Robert Menzies — 18 years and 5 months in total.`,
  `Federal elections must be held within three years of the previous election.`,
  `The Australian Electoral Commission (AEC) independently runs all federal elections.`,
  `The Hansard is the official verbatim transcript of everything said in both chambers of Parliament.`,
  `Private members' bills introduced by non-government MPs rarely pass but drive important debates.`,
  `The Budget is typically delivered on the second Tuesday in May each year.`,
  `The "Tally Room" in Canberra was the famous election-night hub until 2004.`,
  `Tasmania has the same 12 senators as NSW — despite having roughly 1/15th the population.`,
  `Australia was among the first countries to grant women the right to vote federally, in 1902.`,
  `Crossbench senators often hold the balance of power in the Australian Senate.`,
  `The National Broadband Network and NDIS were both established through Acts of Parliament.`,
  `Australia has a bicameral (two-chamber) parliament — a structure shared with the US, UK, and Canada.`,
  `Australia signed the Paris Agreement on climate in 2016, committing to national emissions targets.`,
  `Snap elections are impossible in Australia — the Governor-General must issue a formal writ.`,
  `A bill can be introduced by any MP or Senator — not just ministers of the government.`,
  `Parliament sits in Canberra for roughly 20 weeks per year across multiple sitting periods.`,
];

function getBriefStatusLabel(status: string | null): string {
  if (!status) return '';
  const s = status.toLowerCase();
  if (s.includes('passed') || s.includes('assent')) return 'Passed';
  if (s.includes('defeated') || s.includes('withdrawn')) return 'Defeated';
  if (s.includes('introduced')) return 'Introduced';
  if (s.includes('reading')) return 'In debate';
  return 'Active';
}


export interface PersonalisedBullet {
  text: string;
  type: 'vote' | 'national';
}

function DailyBrief({
  brief,
  billsToWatch,
  loading,
  generating,
  electorate,
  personalBullets,
  navigation,
}: {
  brief: ReturnType<typeof useDailyBrief>['brief'];
  billsToWatch: Bill[];
  loading: boolean;
  generating: boolean;
  electorate: string | null;
  personalBullets: PersonalisedBullet[];
  navigation: any;
}) {
  const { colors } = useTheme();
  const [expanded, setExpanded] = React.useState(true);

  const today = new Date();
  const briefDate = brief?.date ? new Date(brief.date + 'T12:00:00') : today;
  const dateLabel = briefDate.toLocaleDateString('en-AU', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
  const dayOfYear = Math.floor(
    (today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) / 86400000,
  );
  const todayFact = CIVIC_FACTS[dayOfYear % CIVIC_FACTS.length];

  const hasAI = !!brief?.ai_text;

  const handleShare = () => {
    if (!brief) return;
    const lines = [`📰 Verity Daily Brief — ${dateLabel}`, ''];
    if (hasAI) {
      lines.push('What happened:');
      brief.ai_text!.what_happened.forEach(b => lines.push(`• ${b}`));
      lines.push('', `💡 ${brief.ai_text!.one_thing_to_know}`);
    } else {
      lines.push('Top Stories:');
      (brief.stories ?? []).slice(0, 3).forEach(s => lines.push(`• ${s.headline}`));
      lines.push('', `💡 Did you know? ${todayFact}`);
    }
    lines.push('', 'Stay informed with Verity — Australian civic intelligence.');
    Share.share({ message: lines.join('\n') });
  };

  // Shared bill list used in both render paths
  const BillsSection = billsToWatch.length > 0 ? (
    <>
      <View style={[briefStyles.section, { backgroundColor: colors.card }]}>
        <Text style={[briefStyles.sectionTitle, { color: colors.text }]}>🏛️  Bills to Watch</Text>
        {billsToWatch.map(bill => (
          <Pressable
            key={bill.id}
            style={[briefStyles.billRow, { backgroundColor: colors.surface }]}
            onPress={() => navigation.navigate('BillDetail', { bill })}
          >
            <View style={{ flex: 1 }}>
              <Text style={[briefStyles.billTitle, { color: colors.text }]} numberOfLines={2}>
                {bill.short_title || bill.title}
              </Text>
              <Text style={briefStyles.billStatus}>{getBriefStatusLabel(bill.current_status)}</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
          </Pressable>
        ))}
      </View>
      <View style={[briefStyles.divider, { backgroundColor: colors.border }]} />
    </>
  ) : null;

  // Shared How It Affects You section
  const HowItAffectsYou = (
    <View style={[briefStyles.section, { backgroundColor: colors.card }]}>
      <Text style={[briefStyles.sectionTitle, { color: colors.text }]}>📍  How It Affects You</Text>
      {personalBullets.map((bullet, i) => (
        <View key={i} style={briefStyles.personalRow}>
          <Ionicons
            name={bullet.type === 'vote' ? 'checkmark-circle-outline' : 'radio-button-on-outline'}
            size={bullet.type === 'vote' ? 16 : 14}
            color={bullet.type === 'vote' ? '#00843D' : colors.textMuted}
            style={{ marginTop: 2 }}
          />
          <Text style={[briefStyles.personalText, { color: colors.text }]}>{bullet.text}</Text>
        </View>
      ))}
      {personalBullets.length === 0 && (
        <Text style={[briefStyles.personalText, { color: colors.textMuted }]}>No updates personalised for your area yet.</Text>
      )}
    </View>
  );

  return (
    <View style={[briefStyles.card, { backgroundColor: colors.greenBg }]}>
      <Pressable style={[briefStyles.header, { backgroundColor: colors.greenBg }]} onPress={() => setExpanded(e => !e)}>
        <View style={briefStyles.headerLeft}>
          <Text style={briefStyles.headerIcon}>📰</Text>
          <View>
            <Text style={[briefStyles.headerTitle, { color: colors.text }]}>
              {brief?.is_personalised && electorate ? `${electorate} Brief` : 'Your Daily Brief'}
            </Text>
            <Text style={[briefStyles.headerDate, { color: colors.textBody }]}>{dateLabel}</Text>
          </View>
        </View>
        <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={20} color={colors.textBody} />
      </Pressable>

      {expanded && (
        <>
          {/* Personalisation-in-progress banner */}
          {generating && (
            <View style={[briefStyles.generatingRow, { backgroundColor: colors.greenBg }]}>
              <ActivityIndicator size="small" color="#00843D" />
              <Text style={[briefStyles.generatingText, { color: colors.textBody }]}>
                Personalising for {electorate}…
              </Text>
            </View>
          )}

          {!generating && (
            <Text style={[briefStyles.subheader, { color: colors.textBody, backgroundColor: colors.greenBg }]}>
              {hasAI ? 'Your personalised briefing' : 'What happened in Australian politics today'}
            </Text>
          )}

          {loading ? (
            <View style={{ padding: 16, gap: 10 }}>
              {[1, 2, 3].map(i => <SkeletonLoader key={i} height={52} borderRadius={8} />)}
            </View>
          ) : !brief ? (
            <View style={briefStyles.noBrief}>
              <Text style={[briefStyles.noBriefText, { color: colors.textMuted }]}>Today's brief isn't ready yet. Check back soon.</Text>
            </View>
          ) : hasAI ? (
            // ── Claude-generated brief ───────────────────────────────────
            <>
              {/* What Happened */}
              <View style={[briefStyles.section, { backgroundColor: colors.card }]}>
                <Text style={[briefStyles.sectionTitle, { color: colors.text }]}>🔖  What happened</Text>
                {brief.ai_text!.what_happened.map((bullet, i) => (
                  <View key={i} style={briefStyles.aiBulletRow}>
                    <Text style={briefStyles.aiBulletDot}>•</Text>
                    <Text style={[briefStyles.aiBulletText, { color: colors.text }]}>{bullet}</Text>
                  </View>
                ))}
              </View>

              <View style={[briefStyles.divider, { backgroundColor: colors.border }]} />

              {/* What It Means */}
              <View style={briefStyles.meansCard}>
                <Text style={briefStyles.meansLabel}>
                  {electorate ? `What it means for ${electorate}` : 'What it means for you'}
                </Text>
                <Text style={[briefStyles.meansText, { color: colors.text }]}>{brief.ai_text!.what_it_means}</Text>
              </View>

              <View style={[briefStyles.divider, { backgroundColor: colors.border }]} />

              {BillsSection}

              {HowItAffectsYou}

              <View style={[briefStyles.divider, { backgroundColor: colors.border }]} />

              {/* One Thing to Know */}
              <View style={[briefStyles.section, { backgroundColor: colors.card }]}>
                <Text style={[briefStyles.sectionTitle, { color: colors.text }]}>💡  One thing to know</Text>
                <View style={[briefStyles.factBox, { backgroundColor: colors.greenBg }]}>
                  <Text style={[briefStyles.factText, { color: colors.text }]}>{brief.ai_text!.one_thing_to_know}</Text>
                </View>
              </View>

              {/* AI attribution + timestamp */}
              <View style={[briefStyles.aiFooter, { backgroundColor: colors.greenBg }]}>
                <Text style={[briefStyles.aiFooterText, { color: colors.textMuted }]}>
                  {'Generated by Claude · '}
                  {new Date(brief.created_at).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>

              <Pressable style={[briefStyles.shareBtn, { backgroundColor: colors.card, borderTopColor: colors.border }]} onPress={handleShare}>
                <Ionicons name="share-outline" size={16} color="#00843D" />
                <Text style={briefStyles.shareBtnText}>Share Brief</Text>
              </Pressable>
            </>
          ) : (
            // ── Fallback: rule-based brief ────────────────────────────────
            <>
              {/* Top Stories */}
              {(brief.stories ?? []).length > 0 && (
                <>
                  <View style={[briefStyles.section, { backgroundColor: colors.card }]}>
                    <Text style={[briefStyles.sectionTitle, { color: colors.text }]}>🔖  Top Stories</Text>
                    {(brief.stories ?? []).map((story, i) => {
                      const catColour = topicAccent(story.category?.toLowerCase());
                      return (
                        <Pressable
                          key={i}
                          style={briefStyles.storyRow}
                          onPress={() => {
                            if (story.bill_id) {
                              const matched = billsToWatch.find(b => b.id === story.bill_id);
                              if (matched) navigation.navigate('BillDetail', { bill: matched });
                            }
                          }}
                        >
                          <View style={briefStyles.storyLeft}>
                            <View style={[briefStyles.catDot, { backgroundColor: catColour }]} />
                            <View style={{ flex: 1 }}>
                              <Text style={[briefStyles.storyHeadline, { color: colors.text }]}>{story.headline}</Text>
                              {!!story.summary && (
                                <Text style={[briefStyles.storySummary, { color: colors.textBody }]} numberOfLines={2}>{decodeHtml(story.summary)}</Text>
                              )}
                            </View>
                          </View>
                          <View style={[briefStyles.catTag, { backgroundColor: catColour + '18' }]}>
                            <Text style={[briefStyles.catTagText, { color: catColour }]}>{story.category}</Text>
                          </View>
                        </Pressable>
                      );
                    })}
                  </View>
                  <View style={[briefStyles.divider, { backgroundColor: colors.border }]} />
                </>
              )}

              {BillsSection}

              {HowItAffectsYou}

              <View style={[briefStyles.divider, { backgroundColor: colors.border }]} />

              {/* Did You Know */}
              <View style={[briefStyles.section, { backgroundColor: colors.card }]}>
                <Text style={[briefStyles.sectionTitle, { color: colors.text }]}>💡  Did You Know?</Text>
                <View style={[briefStyles.factBox, { backgroundColor: colors.greenBg }]}>
                  <Text style={[briefStyles.factText, { color: colors.text }]}>{todayFact}</Text>
                </View>
              </View>

              <Pressable style={[briefStyles.shareBtn, { backgroundColor: colors.card, borderTopColor: colors.border }]} onPress={handleShare}>
                <Ionicons name="share-outline" size={16} color="#00843D" />
                <Text style={briefStyles.shareBtnText}>Share Brief</Text>
              </Pressable>
            </>
          )}
        </>
      )}
    </View>
  );
}

const briefStyles = StyleSheet.create({
  card: {
    marginHorizontal: SPACING.lg + 4,
    marginBottom: SPACING.xxl - 4,
    borderRadius: BORDER_RADIUS.lg + 2,
    overflow: 'hidden',
    ...SHADOWS.md,
  },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: SPACING.lg,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  headerIcon: { fontSize: 26 },
  headerTitle: { fontSize: FONT_SIZE.subtitle - 1, fontWeight: FONT_WEIGHT.bold },
  headerDate: { fontSize: FONT_SIZE.small - 1, marginTop: 1 },
  subheader: {
    fontSize: FONT_SIZE.small, paddingHorizontal: SPACING.lg, paddingBottom: SPACING.md,
  },
  noBrief: { padding: SPACING.lg + 4, alignItems: 'center' },
  noBriefText: { fontSize: FONT_SIZE.small + 1, textAlign: 'center' },
  section: { paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md + 2 },
  sectionTitle: { fontSize: FONT_SIZE.small + 1, fontWeight: FONT_WEIGHT.bold, marginBottom: SPACING.md },
  divider: { height: 1 },
  // AI bullet list
  aiBulletRow: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.sm + 2, alignItems: 'flex-start' },
  aiBulletDot: { fontSize: FONT_SIZE.subtitle - 1, color: '#00843D', lineHeight: 21, flexShrink: 0, marginTop: -1 },
  aiBulletText: { flex: 1, fontSize: FONT_SIZE.small + 1, lineHeight: 21 },
  // What it means card
  meansCard: {
    backgroundColor: '#00843D08', paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md + 2,
    borderLeftWidth: 3, borderLeftColor: '#00843D',
  },
  meansLabel: {
    fontSize: FONT_SIZE.caption, fontWeight: FONT_WEIGHT.bold, color: '#00843D', marginBottom: SPACING.xs + 2,
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  meansText: { fontSize: FONT_SIZE.small + 1, lineHeight: 21 },
  // Generating indicator
  generatingRow: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md,
  },
  generatingText: { fontSize: FONT_SIZE.small, fontStyle: 'italic' },
  // AI footer
  aiFooter: {
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm, alignItems: 'flex-end',
  },
  aiFooterText: { fontSize: FONT_SIZE.caption },
  // Stories (fallback)
  storyRow: {
    flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between',
    gap: SPACING.sm + 2, marginBottom: SPACING.md,
  },
  storyLeft: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm + 2, flex: 1 },
  catDot: { width: 8, height: 8, borderRadius: 4, marginTop: 5, flexShrink: 0 },
  storyHeadline: { fontSize: FONT_SIZE.small, fontWeight: FONT_WEIGHT.bold, lineHeight: 18 },
  storySummary: { fontSize: FONT_SIZE.small - 1, lineHeight: 17, marginTop: 2 },
  catTag: { borderRadius: BORDER_RADIUS.sm, paddingHorizontal: SPACING.sm, paddingVertical: 3, flexShrink: 0 },
  catTagText: { fontSize: 10, fontWeight: FONT_WEIGHT.bold },
  // Bills
  billRow: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm + 2, marginBottom: SPACING.sm + 2,
    borderRadius: BORDER_RADIUS.md, padding: SPACING.md,
  },
  billTitle: { fontSize: FONT_SIZE.small, fontWeight: FONT_WEIGHT.semibold, lineHeight: 18 },
  billStatus: { fontSize: FONT_SIZE.caption, color: '#00843D', fontWeight: FONT_WEIGHT.semibold, marginTop: 3 },
  // Personalised
  personalRow: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm, marginBottom: SPACING.sm },
  personalText: { flex: 1, fontSize: FONT_SIZE.small, lineHeight: 18 },
  // Fact / one thing to know
  factBox: { borderRadius: BORDER_RADIUS.md, padding: SPACING.md + 2 },
  factText: { fontSize: FONT_SIZE.small, lineHeight: 19, fontStyle: 'italic' },
  // Share
  shareBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: SPACING.sm - 2, paddingVertical: SPACING.md + 2,
    borderTopWidth: 1,
  },
  shareBtnText: { fontSize: FONT_SIZE.small + 1, fontWeight: FONT_WEIGHT.bold, color: '#00843D' },
});

// ─── Main Screen ─────────────────────────────────────────────────────────────

export function HomeScreen({ navigation }: any) {
  const { colors } = useTheme();
  const { postcode, setPostcode, user } = useUser();
  const [postcodeInput, setPostcodeInput] = useState(postcode || '');
  const [refreshing, setRefreshing] = useState(false);
  const { requireAuth, authSheetProps } = useAuthGate();

  const greeting = getGreeting();
  const dateStr = new Date().toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' });
  const { bills: trendingBills, loading: billsLoading } = useBills({ limit: 10, activeOnly: true });
  const { divisions: recentDivisions, loading: divisionsLoading, refresh: refreshDivisions } = useRecentDivisions(5);
  const { items: newsItems, loading: newsLoading } = useNewsItems(5);
  const { stories: newsStories, loading: newsStoriesLoading, refresh: refreshNews } = useNewsStories(undefined, undefined, undefined, 15);
  const [feedMode, setFeedMode] = useState<'foryou' | 'trending' | 'latest'>('foryou');
  const { polls, loading: pollsLoading } = usePolls();
  const electorateResult = useElectorateByPostcode(postcode);
  const { member: myMP, loading: mpLoading } = electorateResult;
  const { updates: repUpdates, loading: repUpdatesLoading } = useRepresentativeUpdates();
  const { brief, billsToWatch, loading: briefLoading, generating: briefGenerating, refresh: refreshBrief } = useDailyBrief(
    electorateResult.electorate?.name ?? null,
    myMP ? `${myMP.first_name} ${myMP.last_name}` : null,
  );
  const { votes: mpVotes } = useVotes(myMP?.id ?? null);
  const mpTotalVotes = mpVotes.length;
  const mpAyeRate = mpTotalVotes > 0
    ? Math.round(mpVotes.filter(v => v.vote_cast === 'aye').length / mpTotalVotes * 100)
    : null;

  // ── Personalised feed (hook MUST be at top level, never inside JSX IIFE) ──
  const filteredStories = filterPoliticalStories(newsStories);
  const personalised = usePersonalisedFeed(filteredStories, {
    electorate: electorateResult.electorate?.name ?? null,
    mpName: myMP ? `${myMP.first_name} ${myMP.last_name}` : null,
    followedTopics: [],
  });

  const personalBullets = useMemo((): PersonalisedBullet[] => {
    const bullets: PersonalisedBullet[] = [];

    if (myMP && mpVotes.length > 0) {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString().slice(0, 10);
      const PROCEDURAL_STARTS = [
        'Business —', 'Motions —', 'Procedure', 'Adjournment',
        'Business of the Senate', 'Business of the House',
      ];

      for (const vote of mpVotes) {
        if (bullets.length >= 3) break;
        const div = vote.division;
        if (!div?.date || div.date < sevenDaysAgo) continue;
        if (PROCEDURAL_STARTS.some(p => div.name.startsWith(p))) continue;

        const cleanName = cleanDivisionName(div.name);
        if (!cleanName) continue;

        const dateStr = timeAgo(div.date + 'T00:00:00');
        const mpFullName = `${myMP.first_name} ${myMP.last_name}`;

        let text: string;
        if (vote.rebelled) {
          text = `Your MP ${mpFullName} crossed the floor on ${cleanName} (${dateStr})`;
        } else {
          const voteWord = vote.vote_cast === 'aye' ? 'YES' : vote.vote_cast === 'no' ? 'NO' : vote.vote_cast.toUpperCase();
          text = `Your MP ${mpFullName} voted ${voteWord} on ${cleanName} (${dateStr})`;
        }
        bullets.push({ text, type: 'vote' });
      }
    }

    // Pad with national updates if not enough personalised bullets
    const fallbacks = brief?.national_updates ?? [];
    for (let i = 0; bullets.length < 3 && i < fallbacks.length; i++) {
      bullets.push({ text: fallbacks[i].text, type: 'national' });
    }

    return bullets;
  }, [myMP, mpVotes, brief?.national_updates]);

  // Group recent divisions by (cleanedName, date) to collapse 2nd/3rd reading duplicates
  type GroupedDiv = { id: string; cleanedName: string; date: string; chamber: string; aye_votes: number; no_votes: number; count: number };
  const groupedDivisions: GroupedDiv[] = (() => {
    const seen = new Map<string, GroupedDiv>();
    for (const d of recentDivisions) {
      const cleanedName = cleanDivisionName(d.name);
      const key = `${cleanedName}|${d.date.slice(0, 10)}`;
      const existing = seen.get(key);
      if (existing) {
        existing.count++;
        if (d.aye_votes + d.no_votes > existing.aye_votes + existing.no_votes) {
          existing.aye_votes = d.aye_votes;
          existing.no_votes = d.no_votes;
        }
      } else {
        seen.set(key, { ...d, cleanedName, count: 1 });
      }
    }
    return Array.from(seen.values());
  })();

  const onRefresh = useCallback(async () => {
    hapticLight();
    setRefreshing(true);
    try {
      await Promise.all([refreshNews(), refreshDivisions(), refreshBrief()]);
    } catch {}
    setRefreshing(false);
  }, [refreshNews, refreshDivisions, refreshBrief]);

  const handleSetPostcode = () => {
    Keyboard.dismiss();
    const trimmed = postcodeInput.trim();
    if (trimmed.length === 4 && /^\d{4}$/.test(trimmed)) {
      setPostcode(trimmed);
    } else {
      Alert.alert('Invalid postcode', 'Please enter a valid 4-digit Australian postcode.');
    }
  };

  const clearPostcode = () => {
    setPostcode(null);
    setPostcodeInput('');
  };

  // News share card
  const newsCardRef = useRef<any>(null);
  const [shareNewsStory, setShareNewsStory] = useState<NewsStory | null>(null);
  useEffect(() => {
    if (shareNewsStory) {
      captureAndShare(newsCardRef, 'news_story', String(shareNewsStory.id), user?.id)
        .finally(() => setShareNewsStory(null));
    }
  }, [shareNewsStory]);

  // ── "What did I miss" catch-up for returning users ──────────
  const [daysMissed, setDaysMissed] = useState(0);
  const [showCatchUp, setShowCatchUp] = useState(false);
  useEffect(() => {
    AsyncStorage.getItem('last_app_open').then(val => {
      const now = Date.now();
      if (val) {
        const diff = Math.floor((now - parseInt(val, 10)) / 86400000);
        if (diff >= 3) {
          setDaysMissed(diff);
          setShowCatchUp(true);
        }
      }
      AsyncStorage.setItem('last_app_open', String(now));
    });
  }, []);

  // ── First-session notification prompt ──────────────────────
  const [showNotifPrompt, setShowNotifPrompt] = useState(false);
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set());
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    AsyncStorage.getItem('notification_prompt_shown').then(val => {
      if (!val) {
        timer = setTimeout(() => setShowNotifPrompt(true), 60000);
      }
    });
    return () => { if (timer) clearTimeout(timer); };
  }, []);

  const dismissNotifPrompt = () => {
    setShowNotifPrompt(false);
    AsyncStorage.setItem('notification_prompt_shown', 'true');
  };

  const enableNotifications = async () => {
    try {
      const Notifications = await import('expo-notifications');
      await Notifications.requestPermissionsAsync();
    } catch {}
    dismissNotifPrompt();
  };

  // Show full-page skeleton on initial mount while all critical data loads
  const initialLoading = briefLoading && newsStoriesLoading && divisionsLoading && repUpdatesLoading;

  if (initialLoading && !refreshing) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['bottom']}>
        <HomeScreenSkeleton />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['bottom']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#00843D" colors={['#00843D']} />
        }
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Hero Header ─────────────────────────────────────── */}
        <View style={styles.hero}>
          <View style={styles.heroTop}>
            <View>
              <Text style={styles.heroGreeting}>{greeting}</Text>
              <Text style={styles.heroDate}>{dateStr}</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Pressable onPress={() => navigation.navigate('Activity')} hitSlop={8}>
                <Ionicons name="notifications-outline" size={22} color="rgba(255,255,255,0.9)" />
              </Pressable>
              <View style={styles.heroLogoWrap}>
                <Ionicons name="leaf-outline" size={16} color="rgba(255,255,255,0.85)" />
                <Text style={styles.heroLogo}>Verity</Text>
              </View>
            </View>
          </View>
          <Text style={styles.heroTagline}>
            {briefLoading ? 'Loading your brief…' : 'Your daily brief is ready'}
          </Text>
          <Text style={styles.heroTrackingLine}>Tracking 225 representatives across 151 electorates</Text>
        </View>

        {/* ── "What did I miss" catch-up card ──────────────────── */}
        {showCatchUp && (
          <View style={{ marginHorizontal: 20, marginBottom: 16, backgroundColor: '#EEF2FF', borderRadius: 14, padding: 16, borderLeftWidth: 4, borderLeftColor: '#4338CA' }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 16, fontWeight: '700', color: '#1E1B4B' }}>
                  Welcome back! You missed {daysMissed} days.
                </Text>
                <Text style={{ fontSize: 14, color: '#4338CA', marginTop: 4, lineHeight: 20 }}>
                  {brief?.ai_text?.what_happened?.[0]
                    ? `Here's the biggest thing: ${brief.ai_text.what_happened[0].slice(0, 120)}${brief.ai_text.what_happened[0].length > 120 ? '...' : ''}`
                    : 'Tap your Daily Brief to catch up on what happened while you were away.'}
                </Text>
              </View>
              <Pressable onPress={() => setShowCatchUp(false)} hitSlop={12}>
                <Ionicons name="close" size={20} color="#6366F1" />
              </Pressable>
            </View>
            <Pressable
              style={{ marginTop: 12, alignSelf: 'flex-start', backgroundColor: '#4338CA', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 8 }}
              onPress={() => { setShowCatchUp(false); navigation.navigate('DailyBrief'); }}
            >
              <Text style={{ fontSize: 14, fontWeight: '600', color: '#ffffff' }}>Read your catch-up brief</Text>
            </Pressable>
          </View>
        )}

        {/* ── Your MP (postcode prompt or hero card) ──────────── */}
        {!postcode ? (
          <View style={[styles.postcodePromptCard, { backgroundColor: colors.surface }]}>
            <Ionicons name="location-outline" size={22} color="#00843D" />
            <View style={{ flex: 1 }}>
              <Text style={[styles.postcodePromptTitle, { color: colors.text }]}>Find your MP</Text>
              <Text style={[styles.postcodePromptSub, { color: colors.textMuted }]}>Enter your postcode to see who represents you</Text>
            </View>
            <View style={styles.postcodePromptRow}>
              <TextInput
                style={[styles.postcodePromptInput, { backgroundColor: colors.background, color: colors.text }]}
                value={postcodeInput}
                onChangeText={setPostcodeInput}
                placeholder="0000"
                placeholderTextColor="#9aabb8"
                keyboardType="number-pad"
                maxLength={4}
                returnKeyType="search"
                onSubmitEditing={handleSetPostcode}
              />
              <Pressable style={[styles.postcodePromptBtn, { backgroundColor: colors.green }]} onPress={handleSetPostcode}>
                <Ionicons name="search" size={16} color="#ffffff" />
              </Pressable>
            </View>
          </View>
        ) : (
          <View style={styles.myMPBanner}>
            <View style={styles.myMPSectionRow}>
              <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>YOUR REPRESENTATIVE</Text>
              <Pressable onPress={clearPostcode} hitSlop={8}>
                <Text style={[styles.changeLink, { color: colors.green }]}>Change</Text>
              </Pressable>
            </View>
            {mpLoading ? (
              <SkeletonLoader height={110} borderRadius={16} />
            ) : myMP ? (
              <View style={[styles.myMPCard, { backgroundColor: colors.card, borderLeftColor: '#00843D' }]}>
                <View style={styles.myMPCardTop}>
                  {myMP.photo_url ? (
                    <Image source={{ uri: myMP.photo_url }} style={styles.myMPPhoto} />
                  ) : (
                    <View style={[styles.myMPAvatar, { backgroundColor: (myMP.party?.colour || '#9aabb8') + '33' }]}>
                      <Text style={[styles.myMPInitials, { color: myMP.party?.colour || '#9aabb8' }]}>
                        {myMP.first_name[0]}{myMP.last_name[0]}
                      </Text>
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.myMPName, { color: colors.text }]}>{myMP.first_name} {myMP.last_name}</Text>
                    <Text style={[styles.myMPSub, { color: colors.textBody }]}>
                      {myMP.party?.short_name || myMP.party?.abbreviation || ''}{myMP.electorate ? ` · ${myMP.electorate.name}` : ''}
                    </Text>
                    {myMP.ministerial_role && (
                      <Text style={[styles.myMPRole, { color: colors.textBody }]} numberOfLines={2}>
                        {myMP.ministerial_role}
                      </Text>
                    )}
                    {mpVotes.length > 0 && mpVotes[0].division?.name && (
                      <View style={styles.myMPLastVoteRow}>
                        <Text style={[styles.myMPLastVoteLabel, { color: colors.textMuted }]}>Last voted: </Text>
                        <Text style={[styles.myMPLastVoteName, { color: colors.text }]} numberOfLines={1}>
                          {cleanDivisionName(mpVotes[0].division.name)}
                        </Text>
                        <View style={[
                          styles.myMPLastVoteBadge,
                          { backgroundColor: mpVotes[0].vote_cast === 'aye' ? '#00843D18' : '#DC354518' },
                        ]}>
                          <Text style={[
                            styles.myMPLastVoteBadgeText,
                            { color: mpVotes[0].vote_cast === 'aye' ? '#00843D' : '#DC3545' },
                          ]}>
                            {(mpVotes[0].vote_cast || '').toUpperCase()}
                          </Text>
                        </View>
                      </View>
                    )}
                  </View>
                </View>
                <View style={styles.myMPActions}>
                  <Pressable
                    style={[styles.myMPActionBtn, styles.myMPActionBtnOutline, { borderColor: '#00843D' }]}
                    onPress={() => requireAuth('write to your MP', () => navigation.navigate('WriteToMP', { member: myMP }))}
                  >
                    <Ionicons name="mail-outline" size={14} color="#00843D" />
                    <Text style={[styles.myMPActionText, { color: '#00843D' }]}>Write to MP</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.myMPActionBtn, { backgroundColor: '#00843D' }]}
                    onPress={() => navigation.navigate('MemberProfile', { member: myMP })}
                  >
                    <Text style={[styles.myMPActionText, { color: '#fff' }]}>View Profile</Text>
                    <Ionicons name="chevron-forward" size={14} color="#fff" />
                  </Pressable>
                </View>
              </View>
            ) : electorateResult?.electorate ? (
              <View style={[styles.myMPFallback, { backgroundColor: colors.cardAlt }]}>
                <Ionicons name="location-outline" size={18} color="#00843D" />
                <Text style={[styles.myMPFallbackText, { color: colors.textMuted }]}>
                  {electorateResult.electorate.name} ({electorateResult.electorate.state}) — MP data loading soon.
                </Text>
                <Pressable onPress={clearPostcode} hitSlop={8}>
                  <Text style={[styles.changeLink, { color: colors.green }]}>Change</Text>
                </Pressable>
              </View>
            ) : (
              <View style={[styles.myMPFallback, { backgroundColor: colors.cardAlt }]}>
                <Ionicons name="information-circle-outline" size={18} color={colors.textMuted} />
                <Text style={[styles.myMPFallbackText, { color: colors.textMuted }]}>No electorate found for {postcode}.</Text>
                <Pressable onPress={clearPostcode} hitSlop={8}>
                  <Text style={[styles.changeLink, { color: colors.green }]}>Change</Text>
                </Pressable>
              </View>
            )}
          </View>
        )}

        {/* ── Daily Brief Card — GREEN HERO ──────────────── */}
        <Pressable
          style={{ backgroundColor: '#00843D', marginHorizontal: 20, borderRadius: 14, padding: 20, marginBottom: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 3, flexDirection: 'row', alignItems: 'center' }}
          onPress={() => { hapticLight(); track('daily_brief_read', {}, 'Home'); navigation.navigate('DailyBrief'); }}
        >
          <View style={{ flex: 1 }}>
            <Text style={{ color: '#FFFFFF', fontSize: 17, fontWeight: '700' }}>
              {briefLoading ? 'Preparing your brief…' : 'Your daily brief is ready'}
            </Text>
            {!briefLoading && brief?.ai_text?.what_happened?.[0] && (
              <Text style={{ color: '#FFFFFF', fontSize: 14, opacity: 0.9, marginTop: 8 }} numberOfLines={2}>
                {brief.ai_text.what_happened[0]}
              </Text>
            )}
            {!briefLoading && !brief?.ai_text && brief?.stories?.[0] && (
              <Text style={{ color: '#FFFFFF', fontSize: 14, opacity: 0.9, marginTop: 8 }} numberOfLines={2}>
                {brief.stories[0].headline}
              </Text>
            )}
            <Text style={{ color: '#FFFFFF', fontSize: 15, fontWeight: '700', marginTop: 12 }}>Read your brief →</Text>
          </View>
          <Ionicons name="chevron-forward" size={22} color="rgba(255,255,255,0.7)" style={{ marginLeft: 12 }} />
        </Pressable>

        {/* ── Stale content warning ──────────────────────────── */}
        {newsStories.length > 0 && Date.now() - new Date(newsStories[0].first_seen).getTime() > 48 * 60 * 60 * 1000 && (
          <View style={{ backgroundColor: '#FFF3CD', padding: 12, marginHorizontal: 20, borderRadius: 8, marginBottom: 12 }}>
            <Text style={{ fontSize: 13, color: '#856404' }}>News is updating. Latest stories may be delayed.</Text>
          </View>
        )}

        {/* ── From Your Representatives ───────────────────────── */}
        <View style={[styles.section, { backgroundColor: colors.background }]}>
          <View style={[styles.sectionHeader, { marginBottom: 16 }]}>
            <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>FROM YOUR REPRESENTATIVES</Text>
          </View>
          {repUpdatesLoading ? (
            [1, 2].map(i => <SkeletonLoader key={i} height={88} borderRadius={12} style={{ marginBottom: 10 }} />)
          ) : repUpdates.length === 0 ? (
            <View style={[styles.repUpdatesEmptyCard, { backgroundColor: colors.surface }]}>
              <View style={styles.repUpdatesEmptyIcon}>
                <Ionicons name="megaphone-outline" size={28} color="#00843D" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.repUpdatesEmptyTitle, { color: colors.text }]}>
                  No posts yet from your representatives
                </Text>
                <Text style={[styles.repUpdatesEmptyText, { color: colors.textBody }]}>
                  Verity is building tools for MPs to share updates directly with constituents.
                </Text>
                {myMP && (
                  <Pressable
                    style={styles.writeToMPBtn}
                    onPress={() => navigation.navigate('WriteToMP', { member: myMP })}
                  >
                    <Text style={[styles.writeToMPBtnText, { color: colors.green }]}>Write to {myMP.first_name} {myMP.last_name} →</Text>
                  </Pressable>
                )}
              </View>
            </View>
          ) : (
            repUpdates.slice(0, 4).map(update => {
              const m = update.member;
              const partyColour = m?.party?.colour || '#9aabb8';
              const initials = m ? `${m.first_name[0]}${m.last_name[0]}` : '??';
              const timeAgoStr = timeAgo(update.published_at);
              const sourceLabel: Record<string, string> = {
                twitter: 'Twitter', facebook: 'Facebook',
                media_release: 'Media Release', parliament: 'Parliament', manual: 'Statement',
              };
              return (
                <Pressable
                  key={update.id}
                  style={[styles.repUpdateCard, { backgroundColor: colors.surface }]}
                  onPress={() => m && navigation.navigate('MemberProfile', { member: m })}
                >
                  <View style={styles.repUpdateHeader}>
                    <View style={[styles.repUpdateAvatar, { backgroundColor: partyColour + '22' }]}>
                      {m?.photo_url ? (
                        <Image source={{ uri: m.photo_url }} style={styles.repUpdateAvatarImg} />
                      ) : (
                        <Text style={[styles.repUpdateInitials, { color: partyColour }]}>{initials}</Text>
                      )}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.repUpdateName, { color: colors.text }]}>
                        {m ? `${m.first_name} ${m.last_name}` : 'MP'}
                        {m?.party ? ` · ${m.party.short_name || m.party.name}` : ''}
                      </Text>
                      <Text style={[styles.repUpdateTime, { color: colors.textMuted }]}>{timeAgoStr}</Text>
                    </View>
                    <View style={[styles.repSourceBadge, { backgroundColor: colors.cardAlt }]}>
                      <Text style={[styles.repSourceBadgeText, { color: colors.textBody }]}>{sourceLabel[update.source] ?? update.source}</Text>
                    </View>
                  </View>
                  <Text style={[styles.repUpdateContent, { color: colors.text }]} numberOfLines={3}>{update.content}</Text>
                  {update.source_url && (
                    <Pressable
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', marginTop: 8 }}
                      onPress={(e) => {
                        e.stopPropagation();
                        Linking.openURL(update.source_url!);
                      }}
                      hitSlop={8}
                    >
                      <Text style={{ color: '#00843D', fontSize: 13, fontWeight: '600' }}>View source →</Text>
                    </Pressable>
                  )}
                </Pressable>
              );
            })
          )}
        </View>

        {/* ── Recent Votes ───────────────────────────────────── */}
        <View style={[styles.section, { backgroundColor: colors.background }]}>
          <View style={[styles.sectionHeader, { marginBottom: 16 }]}>
            <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>RECENT VOTES</Text>
          </View>
          {divisionsLoading
            ? [1, 2, 3].map(i => (
                <SkeletonLoader key={i} height={76} borderRadius={12} style={{ marginBottom: 10 }} />
              ))
            : (
              <>
                {groupedDivisions.slice(0, 3).map(d => {
                  const passed = d.aye_votes > d.no_votes;
                  const chamber = d.chamber?.toLowerCase().includes('senate') ? 'Senate' : 'House';
                  return (
                    <Pressable
                      key={d.id}
                      style={({ pressed }) => [styles.voteCard, { backgroundColor: colors.surface, opacity: pressed ? 0.85 : 1 }]}
                      onPress={() => navigation.navigate('BillDetail', { billId: d.id })}
                    >
                      <View style={[styles.voteCardIcon, { backgroundColor: passed ? colors.greenBg : colors.redBg }]}>
                        <Ionicons
                          name={passed ? 'checkmark' : 'close'}
                          size={18}
                          color={passed ? '#00843D' : '#d32f2f'}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.voteCardTitle, { color: colors.text }]} numberOfLines={2}>{d.cleanedName}</Text>
                        <View style={styles.voteCardMeta}>
                          <Text style={[styles.voteCardDate, { color: colors.textMuted }]}>
                            {timeAgo(d.date)}
                          </Text>
                          <View style={[styles.voteCardChamber, { backgroundColor: colors.cardAlt }]}>
                            <Text style={[styles.voteCardChamberText, { color: colors.textMuted }]}>{chamber}</Text>
                          </View>
                          {d.count > 1 && (
                            <View style={[styles.divCountBadge, { backgroundColor: colors.greenLight }]}>
                              <Text style={[styles.divCountText, { color: colors.green }]}>{d.count} votes</Text>
                            </View>
                          )}
                        </View>
                      </View>
                      <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                    </Pressable>
                  );
                })}
              </>
            )
          }
        </View>

        {/* ── Today's News ───────────────────────────────────── */}
        {(() => {
          const state = electorateResult.electorate?.state ?? null;
          const electorateName = electorateResult.electorate?.name ?? null;
          const mpName = myMP ? `${myMP.first_name} ${myMP.last_name}` : null;

          function isLocalStory(headline: string): boolean {
            const lower = headline.toLowerCase();
            if (state && lower.includes(state.toLowerCase())) return true;
            if (electorateName && lower.includes(electorateName.toLowerCase())) return true;
            if (mpName && lower.includes(mpName.toLowerCase())) return true;
            return false;
          }

          const sorted = feedMode === 'foryou'
            ? personalised
            : feedMode === 'latest'
            ? [...filteredStories].sort((a, b) => new Date(b.first_seen).getTime() - new Date(a.first_seen).getTime())
            : filteredStories; // trending = default DB order (article_count DESC)

          const preview = sorted.slice(0, 5);

          return (
            <View style={[styles.section, { backgroundColor: colors.background }]}>
              <View style={[styles.sectionHeader, { marginBottom: 16 }]}>
                <View>
                  <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>TODAY'S NEWS</Text>
                  {postcode && electorateName && (
                    <Text style={[styles.sectionSubtitle, { color: colors.textMuted }]}>{electorateName}</Text>
                  )}
                </View>
                <Pressable onPress={() => navigation.navigate('News')} hitSlop={8}>
                  <Text style={[styles.seeAll, { color: colors.green }]}>See all →</Text>
                </Pressable>
              </View>

              {/* Feed mode pills */}
              <View style={styles.feedPills}>
                {(['foryou', 'trending', 'latest'] as const).map(mode => (
                  <Pressable
                    key={mode}
                    style={[
                      styles.feedPill,
                      { backgroundColor: feedMode === mode ? colors.green : colors.cardAlt },
                    ]}
                    onPress={() => setFeedMode(mode)}
                  >
                    <Text style={[
                      styles.feedPillText,
                      { color: feedMode === mode ? '#fff' : colors.textBody },
                    ]}>
                      {mode === 'foryou' ? 'For You' : mode === 'trending' ? 'Trending' : 'Latest'}
                    </Text>
                  </Pressable>
                ))}
              </View>
              {newsStoriesLoading
                ? [1, 2, 3].map(i => (
                    <SkeletonLoader key={i} height={100} borderRadius={12} style={{ marginBottom: 8 }} />
                  ))
                : preview.length === 0 ? (
                  <View style={styles.newsEmptyState}>
                    <Text style={[styles.newsEmptyText, { color: colors.textBody }]}>Checking sources…</Text>
                    <Text style={styles.newsEmptySubText}>
                      Stories appear here once multiple outlets have covered them.
                    </Text>
                  </View>
                ) : (
                  <View style={[styles.newsListCard, { backgroundColor: colors.surface }]}>
                    {preview.map((story, idx) => {
                      const local = postcode ? isLocalStory(story.headline) : false;
                      return (
                        <Pressable
                          key={story.id}
                          style={{ padding: 16, backgroundColor: colors.card }}
                          onPress={() => navigation.navigate('NewsStoryDetail', { story })}
                        >
                          {/* Header: badge + date + share */}
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                              <View style={{ backgroundColor: categoryColor(story.category ?? 'politics'), borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 }}>
                                <Text style={{ fontSize: 10, fontWeight: '700', color: colors.textBody, letterSpacing: 0.4 }}>{(story.category ?? 'politics').toUpperCase()}</Text>
                              </View>
                              {local && (
                                <View style={{ backgroundColor: '#00843D', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 }}>
                                  <Text style={{ fontSize: 9, fontWeight: '800', color: '#fff', letterSpacing: 0.5 }}>LOCAL</Text>
                                </View>
                              )}
                            </View>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                              <Text style={{ fontSize: 11, color: colors.textMuted }}>{timeAgo(story.first_seen)}</Text>
                              <Pressable onPress={e => { e.stopPropagation(); setShareNewsStory(story); }} hitSlop={10}>
                                <Ionicons name="share-outline" size={18} color="#00843D" />
                              </Pressable>
                            </View>
                          </View>

                          {/* Body: [left: headline + summary + bar + count] [right: thumbnail] */}
                          <View style={{ flexDirection: 'row', gap: 12 }}>
                            <View style={{ flex: 1 }}>
                              <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text, lineHeight: 20 }} numberOfLines={2}>{story.headline}</Text>
                              {story.ai_summary && (
                                <Text style={{ fontSize: 13, color: colors.textBody, marginTop: 4, fontStyle: 'italic', lineHeight: 18 }} numberOfLines={2}>
                                  {decodeHtml(story.ai_summary.replace(/^#+\s*/, ''))}
                                </Text>
                              )}
                              {/* Coverage mini-bar */}
                              <View style={{ flexDirection: 'row', height: 4, borderRadius: 2, overflow: 'hidden', marginTop: 10 }}>
                                <View style={{ flex: story.left_count || 0.01, backgroundColor: '#2563EB' }} />
                                <View style={{ flex: story.center_count || 0.01, backgroundColor: '#9CA3AF' }} />
                                <View style={{ flex: story.right_count || 0.01, backgroundColor: '#DC2626' }} />
                              </View>
                              {/* Source count */}
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 }}>
                                {story.article_count >= 5 && (
                                  <View style={{ backgroundColor: '#FFF3CD', borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2 }}>
                                    <Text style={{ fontSize: 9, fontWeight: '800', color: '#856404' }}>TRENDING</Text>
                                  </View>
                                )}
                                <Text style={{ fontSize: 11, color: story.article_count >= 3 ? '#00843D' : colors.textMuted, fontWeight: story.article_count >= 3 ? '700' : '400' }}>
                                  {story.article_count} source{story.article_count !== 1 ? 's' : ''}
                                </Text>
                              </View>
                            </View>
                            {/* Thumbnail */}
                            {story.image_url && !failedImages.has(story.image_url) ? (
                              <Image
                                source={{ uri: story.image_url }}
                                style={{ width: 64, height: 64, borderRadius: 8, backgroundColor: '#f3f4f6' }}
                                onError={() => setFailedImages(prev => new Set(prev).add(story.image_url!))}
                              />
                            ) : (
                              <View style={{ width: 64, height: 64, borderRadius: 8, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' }}>
                                <Ionicons name="newspaper-outline" size={24} color="#9CA3AF" />
                              </View>
                            )}
                          </View>
                          {idx < preview.length - 1 && <View style={{ height: 1, backgroundColor: colors.border, marginTop: 16 }} />}
                        </Pressable>
                      );
                    })}
                  </View>
                )
              }
            </View>
          );
        })()}

        {/* ── Your Community ──────────────────────────────────────── */}
        {postcode && (
          <Pressable
            style={[styles.communityPreviewCard, { backgroundColor: colors.surface }]}
            onPress={() => navigation.navigate('Community')}
          >
            <View style={styles.communityPreviewHeader}>
              <Ionicons name="people-outline" size={18} color="#00843D" />
              <Text style={[styles.communityPreviewTitle, { color: colors.text }]}>
                {electorateResult.electorate ? `${electorateResult.electorate.name} Community` : 'Your Community'}
              </Text>
              <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
            </View>
            <Text style={[styles.communityPreviewSub, { color: colors.textBody }]}>
              {electorateResult.electorate
                ? 'Discuss local issues with people in your electorate'
                : 'Be the first to start a discussion in your area'}
            </Text>
          </Pressable>
        )}

        {/* ── Trending Bills ─────────────────────────────────── */}
        <View style={[styles.section, { backgroundColor: colors.background }]}>
          <View style={[styles.sectionHeader, { marginBottom: 16 }]}>
            <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>TRENDING BILLS</Text>
            <Pressable onPress={() => navigation.navigate('BillList')} hitSlop={8}>
              <Text style={styles.seeAll}>See all →</Text>
            </Pressable>
          </View>

          {billsLoading ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hScroll}>
              {[1, 2, 3].map(i => (
                <SkeletonLoader
                  key={i}
                  width={280}
                  height={150}
                  borderRadius={12}
                  style={{ marginRight: 12 }}
                />
              ))}
            </ScrollView>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.hScroll}
              decelerationRate="fast"
              snapToInterval={292}
              snapToAlignment="start"
            >
              {trendingBills.map(bill => (
                <BillCard
                  key={bill.id}
                  bill={bill}
                  horizontal
                  onPress={() => navigation.navigate('BillDetail', { bill })}
                />
              ))}
            </ScrollView>
          )}
        </View>

        {/* ── Active Polls ───────────────────────────────────── */}
        {!pollsLoading && polls.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Active Polls</Text>
            {polls.slice(0, 2).map(poll => (
              <PollCard key={poll.id} poll={poll} requireAuth={requireAuth} />
            ))}
          </View>
        )}

        {/* Daily Brief moved to top as tappable card */}

        {/* ── First-session notification prompt ────────────── */}
        {showNotifPrompt && (
          <View style={{ marginHorizontal: 20, marginBottom: 20, backgroundColor: '#E8F5EE', borderRadius: 14, padding: 16, borderLeftWidth: 4, borderLeftColor: '#00843D' }}>
            <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 4 }}>
              Stay informed
            </Text>
            <Text style={{ fontSize: 13, color: colors.textBody, lineHeight: 19, marginBottom: 12 }}>
              {myMP
                ? `Enable notifications to know when ${myMP.first_name} ${myMP.last_name} votes on legislation.`
                : 'Enable notifications to get your daily brief and breaking political news.'}
            </Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Pressable
                style={{ flex: 1, backgroundColor: '#00843D', borderRadius: 10, height: 40, justifyContent: 'center', alignItems: 'center' }}
                onPress={enableNotifications}
              >
                <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>Enable</Text>
              </Pressable>
              <Pressable
                style={{ flex: 1, borderRadius: 10, height: 40, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: colors.border }}
                onPress={dismissNotifPrompt}
              >
                <Text style={{ color: colors.textBody, fontSize: 14, fontWeight: '600' }}>Not now</Text>
              </Pressable>
            </View>
          </View>
        )}

        <View style={styles.bottomPad} />
      </ScrollView>

      {/* Hidden news share card */}
      <View style={{ position: 'absolute', left: -9999, top: 0 }} pointerEvents="none">
        <View ref={newsCardRef}>
          {shareNewsStory && (
            <NewsShareCard
              headline={shareNewsStory.headline}
              category={shareNewsStory.category}
              articleCount={shareNewsStory.article_count}
              leftCount={shareNewsStory.left_count}
              centerCount={shareNewsStory.center_count}
              rightCount={shareNewsStory.right_count}
            />
          )}
        </View>
      </View>
      <AuthPromptSheet {...authSheetProps} />
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { flex: 1 },
  content: { paddingTop: 0 },

  // Hero header — branded green, the only hardcoded-color exception
  hero: {
    backgroundColor: '#00843D',
    paddingHorizontal: SPACING.lg + 4,
    paddingTop: 56,
    paddingBottom: SPACING.xxl - 4,
    marginBottom: SPACING.xl,
  },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  heroGreeting: { fontSize: 30, fontWeight: FONT_WEIGHT.bold, color: '#ffffff', letterSpacing: -0.5 },
  heroDate: { fontSize: FONT_SIZE.small, color: 'rgba(255,255,255,0.72)', marginTop: 3 },
  heroTagline: { fontSize: FONT_SIZE.small + 1, color: 'rgba(255,255,255,0.82)', marginTop: SPACING.md + 2 },
  heroTrackingLine: { fontSize: FONT_SIZE.caption, color: 'rgba(255,255,255,0.55)', marginTop: SPACING.xs },
  heroLogoWrap: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingTop: SPACING.xs },
  heroLogo: { fontSize: FONT_SIZE.subtitle + 1, fontWeight: FONT_WEIGHT.bold, color: '#ffffff' },

  // Postcode prompt card (above stats, no postcode set)
  postcodePromptCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    marginHorizontal: SPACING.lg + 4,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md + 2,
    marginBottom: SPACING.lg,
    ...SHADOWS.sm,
  },
  postcodePromptTitle: { fontSize: FONT_SIZE.small + 1, fontWeight: FONT_WEIGHT.bold },
  postcodePromptSub: { fontSize: FONT_SIZE.small - 1, marginTop: 2 },
  postcodePromptRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs + 2 },
  postcodePromptInput: {
    width: 64,
    borderRadius: BORDER_RADIUS.sm + 2,
    paddingHorizontal: SPACING.sm + 2,
    paddingVertical: SPACING.sm,
    fontSize: FONT_SIZE.body,
    textAlign: 'center',
  },
  postcodePromptBtn: {
    borderRadius: BORDER_RADIUS.sm + 2,
    width: 34,
    height: 34,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // My MP banner
  myMPBanner: { marginHorizontal: SPACING.lg + 4, marginBottom: SPACING.xl },
  myMPSectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.sm + 2 },
  myMPCard: {
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
    ...SHADOWS.md,
  },
  myMPCardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.md + 2, padding: SPACING.lg },
  myMPActions: {
    flexDirection: 'row', gap: SPACING.sm + 2, paddingHorizontal: SPACING.lg, paddingBottom: SPACING.md + 2,
    paddingTop: SPACING.md,
  },
  myMPActionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: SPACING.xs + 2, borderRadius: BORDER_RADIUS.md, height: 40,
  },
  myMPActionBtnOutline: {},
  myMPActionText: { fontSize: FONT_SIZE.small, fontWeight: FONT_WEIGHT.bold },
  myMPPhoto: {
    width: 64,
    height: 64,
    borderRadius: 32,
    flexShrink: 0,
  },
  myMPAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  myMPInitials: { fontSize: 22, fontWeight: FONT_WEIGHT.bold },
  myMPName: { fontSize: FONT_SIZE.subtitle, fontWeight: FONT_WEIGHT.bold },
  myMPSub: { fontSize: FONT_SIZE.small, marginTop: 3 },
  myMPRole: { fontSize: FONT_SIZE.small, marginTop: SPACING.xs, lineHeight: 18, fontStyle: 'italic' },
  myMPLastVoteRow: { flexDirection: 'row', alignItems: 'center', marginTop: SPACING.sm, gap: SPACING.xs },
  myMPLastVoteLabel: { fontSize: FONT_SIZE.caption, fontWeight: FONT_WEIGHT.semibold },
  myMPLastVoteName: { flex: 1, fontSize: FONT_SIZE.caption, fontWeight: FONT_WEIGHT.semibold },
  myMPLastVoteBadge: { borderRadius: BORDER_RADIUS.sm - 2, paddingHorizontal: SPACING.xs + 2, paddingVertical: 2, marginLeft: SPACING.xs },
  myMPLastVoteBadgeText: { fontSize: 9, fontWeight: FONT_WEIGHT.bold, letterSpacing: 0.5 },
  myMPStats: { flexDirection: 'row', marginTop: 3 },
  myMPStatText: { fontSize: FONT_SIZE.caption },
  myMPRight: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs + 2, flexShrink: 0 },
  myMPFallback: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md + 2,
  },
  myMPFallbackText: { flex: 1, fontSize: FONT_SIZE.small, lineHeight: 18 },
  changeLink: { fontSize: FONT_SIZE.small - 1, fontWeight: FONT_WEIGHT.semibold },

  // Daily Brief card — premium green hero (branded exception)
  briefCard: {
    marginHorizontal: SPACING.lg + 4,
    marginBottom: SPACING.xl,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg + 4,
    backgroundColor: '#00843D',
    overflow: 'hidden',
    minHeight: 140,
    shadowColor: '#00843D',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
    elevation: 6,
  },
  briefCardGlow: {
    position: 'absolute',
    top: -40, right: -40,
    width: 160, height: 160, borderRadius: 80,
    backgroundColor: '#ffffff15',
  },
  briefCardContent: { gap: SPACING.sm },
  briefCardTopRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm + 2 },
  briefCardIconBubble: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#ffffff25',
    justifyContent: 'center', alignItems: 'center',
  },
  briefCardLabel: {
    fontSize: FONT_SIZE.caption, fontWeight: FONT_WEIGHT.bold, letterSpacing: 1.2,
    color: '#ffffff',
  },
  briefCardTitleNew: {
    fontSize: FONT_SIZE.subtitle, fontWeight: FONT_WEIGHT.bold, color: '#ffffff',
    marginTop: SPACING.xs + 2, lineHeight: 24,
  },
  briefCardPreviewNew: {
    fontSize: FONT_SIZE.small + 1, color: '#ffffffe6', lineHeight: 20, marginTop: 2,
  },
  briefCardCta: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.xs + 2,
    marginTop: SPACING.md, alignSelf: 'flex-start',
    backgroundColor: '#ffffff20',
    paddingHorizontal: SPACING.md + 2, paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.xl,
  },
  briefCardCtaText: { fontSize: FONT_SIZE.small, fontWeight: FONT_WEIGHT.bold, color: '#ffffff' },

  // Feed mode pills
  feedPills: {
    flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.md + 2, paddingHorizontal: 0,
  },
  feedPill: {
    paddingHorizontal: SPACING.md + 2, paddingVertical: SPACING.xs + 2, borderRadius: BORDER_RADIUS.xl,
  },
  feedPillText: { fontSize: FONT_SIZE.small, fontWeight: FONT_WEIGHT.semibold },

  // MP card (kept for legacy MPCard sub-component)
  mpCard: {
    borderRadius: BORDER_RADIUS.md + 2,
    padding: SPACING.md + 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    ...SHADOWS.sm,
  },
  mpAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  mpInitials: { fontSize: FONT_SIZE.subtitle, fontWeight: FONT_WEIGHT.bold },
  mpInfo: { flex: 1, gap: 5 },
  mpName: { fontSize: FONT_SIZE.subtitle - 1, fontWeight: FONT_WEIGHT.bold },
  mpElectorate: { fontSize: FONT_SIZE.small - 1, marginTop: 2 },
  mpArrow: { flexDirection: 'row', alignItems: 'center', gap: 2, flexShrink: 0 },
  mpArrowText: { fontSize: FONT_SIZE.small - 1, fontWeight: FONT_WEIGHT.semibold },

  // Section
  section: { marginTop: SPACING.xl, marginBottom: SPACING.xxl, paddingHorizontal: SPACING.lg + 4 },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  sectionLabel: { fontSize: FONT_SIZE.caption, fontWeight: FONT_WEIGHT.semibold, letterSpacing: 0.8, textTransform: 'uppercase' },
  sectionTitle: { fontSize: FONT_SIZE.subtitle + 1, fontWeight: FONT_WEIGHT.bold },
  seeAll: { fontSize: FONT_SIZE.small, fontWeight: FONT_WEIGHT.semibold },
  hScroll: { paddingBottom: SPACING.xs, paddingRight: SPACING.xs },
  livePill: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: BORDER_RADIUS.md + 2, paddingHorizontal: SPACING.sm + 2, paddingVertical: SPACING.xs },
  liveDot: { width: 6, height: 6, borderRadius: 3 },
  liveText: { fontSize: 10, fontWeight: FONT_WEIGHT.bold, letterSpacing: 1 },
  emptyFeed: { alignItems: 'center', gap: SPACING.sm + 2, paddingVertical: SPACING.xxl },
  emptyFeedText: { fontSize: FONT_SIZE.small + 1, textAlign: 'center' },

  // Vote cards (Recent Votes)
  voteCard: {
    borderRadius: BORDER_RADIUS.md + 2,
    padding: SPACING.md + 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    marginBottom: SPACING.sm + 2,
    ...SHADOWS.sm,
  },
  voteCardIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  voteCardTitle: { fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.semibold, lineHeight: 21 },
  voteCardMeta: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs + 2, marginTop: SPACING.xs, flexWrap: 'wrap' },
  voteCardDate: { fontSize: FONT_SIZE.small - 1 },
  voteCardChamber: { borderRadius: BORDER_RADIUS.sm - 2, paddingHorizontal: SPACING.xs + 2, paddingVertical: 2 },
  voteCardChamberText: { fontSize: FONT_SIZE.caption, fontWeight: FONT_WEIGHT.medium },
  divCountBadge: { borderRadius: BORDER_RADIUS.sm - 2, paddingHorizontal: SPACING.xs + 2, paddingVertical: 2 },
  divCountText: { fontSize: 10, fontWeight: FONT_WEIGHT.semibold },

  // Activity (legacy/dead)
  activityCard: {
    borderRadius: BORDER_RADIUS.md + 2,
    overflow: 'hidden',
    ...SHADOWS.sm,
  },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md + 1,
    gap: SPACING.md,
  },
  activityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    flexShrink: 0,
  },
  activityInfo: { flex: 1 },
  activityTitle: { fontSize: FONT_SIZE.small, fontWeight: FONT_WEIGHT.medium, lineHeight: 18 },
  activityDate: { fontSize: FONT_SIZE.caption, marginTop: 2 },
  activityChamberBadge: {
    borderRadius: BORDER_RADIUS.sm,
    paddingHorizontal: 7,
    paddingVertical: 3,
    flexShrink: 0,
  },
  activityChamberText: { fontSize: 10, fontWeight: FONT_WEIGHT.medium },
  activityDivider: { height: 1, marginLeft: 36 },
  activitySkeleton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.lg,
    gap: SPACING.md,
  },

  bottomPad: { height: SPACING.lg + 4 },

  // Representative Updates
  repUpdateCard: {
    borderRadius: BORDER_RADIUS.md + 2,
    padding: SPACING.md + 2,
    marginBottom: SPACING.sm + 2,
    ...SHADOWS.sm,
    gap: SPACING.sm,
  },
  repUpdateHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm + 2 },
  repUpdateAvatar: {
    width: 36, height: 36, borderRadius: 18,
    justifyContent: 'center', alignItems: 'center', overflow: 'hidden',
  },
  repUpdateAvatarImg: { width: 36, height: 36, borderRadius: 18 },
  repUpdateInitials: { fontSize: FONT_SIZE.small, fontWeight: FONT_WEIGHT.bold },
  repUpdateName: { fontSize: FONT_SIZE.small, fontWeight: FONT_WEIGHT.bold },
  repUpdateTime: { fontSize: FONT_SIZE.caption, marginTop: 1 },
  repSourceBadge: {
    borderRadius: BORDER_RADIUS.sm,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  repSourceBadgeText: { fontSize: 10, fontWeight: FONT_WEIGHT.semibold },
  repUpdateContent: { fontSize: FONT_SIZE.small, lineHeight: 19 },
  repUpdateSourceLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    alignSelf: 'flex-start',
    marginTop: SPACING.xs,
  },
  repUpdateSourceLinkText: {
    fontSize: FONT_SIZE.small - 1,
    fontWeight: FONT_WEIGHT.semibold,
  },
  repUpdatesEmptyCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.md + 2,
    borderRadius: BORDER_RADIUS.lg, padding: SPACING.lg,
    ...SHADOWS.sm,
  },
  repUpdatesEmptyIcon: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: '#E8F5EE', justifyContent: 'center', alignItems: 'center', flexShrink: 0,
  },
  repUpdatesEmptyTitle: { fontSize: FONT_SIZE.small + 1, fontWeight: FONT_WEIGHT.bold, marginBottom: SPACING.xs, lineHeight: 20 },
  repUpdatesEmptyText: { fontSize: FONT_SIZE.small, lineHeight: 19 },
  writeToMPBtn: { marginTop: SPACING.sm + 2, alignSelf: 'flex-start' },
  writeToMPBtnText: { fontSize: FONT_SIZE.small, fontWeight: FONT_WEIGHT.bold },

  // Today's News
  newsListCard: {
    borderRadius: BORDER_RADIUS.md + 2,
    overflow: 'hidden',
    ...SHADOWS.sm,
  },
  newsItem: {
    padding: SPACING.lg,
  },
  newsItemSeparator: { height: 1, marginLeft: SPACING.lg },
  newsEmptyState: { alignItems: 'center', paddingVertical: SPACING.xl, gap: SPACING.xs + 2 },
  newsEmptyText: { fontSize: FONT_SIZE.small + 1, fontWeight: FONT_WEIGHT.bold },
  newsEmptySubText: { fontSize: FONT_SIZE.small - 1, textAlign: 'center', paddingHorizontal: SPACING.lg },
  newsCardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACING.xs + 2 },
  newsCategoryBadge: { borderRadius: BORDER_RADIUS.sm, paddingHorizontal: SPACING.sm, paddingVertical: 3 },
  newsCategoryText: { fontSize: 10, fontWeight: FONT_WEIGHT.bold, letterSpacing: 0.4 },
  newsDate: { fontSize: FONT_SIZE.caption },
  newsDateRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs + 2 },
  newsShareBtn: { padding: 2 },
  newsBody: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm + 2, marginBottom: SPACING.xs + 2 },
  newsHeadline: { fontSize: FONT_SIZE.small + 1, fontWeight: FONT_WEIGHT.bold, lineHeight: 20 },
  newsThumbnail: { width: 60, height: 60, borderRadius: BORDER_RADIUS.md, flexShrink: 0 },
  newsAiSnippet: { fontSize: FONT_SIZE.small, lineHeight: 18, fontStyle: 'italic' },
  newsSummary: { fontSize: FONT_SIZE.small - 1, lineHeight: 17 },
  newsCardBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs + 2 },
  newsCoverageRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  newsSourceCount: { fontSize: FONT_SIZE.caption, flexShrink: 0 },
  newsSourceCountHot: { color: '#00843D', fontWeight: FONT_WEIGHT.bold },
  newsSourceMeta: { flexDirection: 'row', alignItems: 'center', gap: 5, flexShrink: 0 },
  trendingBadge: { backgroundColor: '#FFF3CD', borderRadius: BORDER_RADIUS.sm - 2, paddingHorizontal: 5, paddingVertical: 2 },
  trendingBadgeText: { fontSize: 9, fontWeight: FONT_WEIGHT.bold, color: '#856404', letterSpacing: 0.3 },
  localBadge: { backgroundColor: '#00843D', borderRadius: BORDER_RADIUS.sm - 2, paddingHorizontal: SPACING.xs + 2, paddingVertical: 2 },
  localBadgeText: { fontSize: 9, fontWeight: FONT_WEIGHT.bold, color: '#ffffff', letterSpacing: 0.5 },
  sectionSubtitle: { fontSize: FONT_SIZE.caption, marginTop: 1 },

  // Did You Know (legacy/unused)
  funFactCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    ...SHADOWS.sm,
  },
  funFactEmoji: { fontSize: 22, marginTop: 2 },
  funFactLabel: { fontSize: FONT_SIZE.small - 1, fontWeight: FONT_WEIGHT.bold, color: '#00843D', marginBottom: SPACING.xs, textTransform: 'uppercase', letterSpacing: 0.5 },
  funFactText: { fontSize: FONT_SIZE.small + 1, lineHeight: 21, marginBottom: SPACING.xs + 2 },
  funFactSource: { fontSize: FONT_SIZE.caption },

  // Community Preview Card
  communityPreviewCard: {
    marginHorizontal: SPACING.lg + 4,
    marginBottom: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    ...SHADOWS.sm,
  },
  communityPreviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.xs,
  },
  communityPreviewTitle: {
    flex: 1,
    fontSize: FONT_SIZE.body,
    fontWeight: FONT_WEIGHT.bold,
  },
  communityPreviewSub: {
    fontSize: FONT_SIZE.small,
  },
});
