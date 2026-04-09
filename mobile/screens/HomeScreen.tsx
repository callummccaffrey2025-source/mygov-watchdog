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

              <View style={briefStyles.divider} />

              {BillsSection}

              {HowItAffectsYou}

              <View style={briefStyles.divider} />

              {/* One Thing to Know */}
              <View style={[briefStyles.section, { backgroundColor: colors.card }]}>
                <Text style={[briefStyles.sectionTitle, { color: colors.text }]}>💡  One thing to know</Text>
                <View style={[briefStyles.factBox, { backgroundColor: colors.greenBg }]}>
                  <Text style={[briefStyles.factText, { color: colors.text }]}>{brief.ai_text!.one_thing_to_know}</Text>
                </View>
              </View>

              {/* AI attribution + timestamp */}
              <View style={[briefStyles.aiFooter, { backgroundColor: colors.greenBg }]}>
                <Text style={briefStyles.aiFooterText}>
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
    marginHorizontal: 20,
    marginBottom: 28,
    backgroundColor: '#F0FFF4',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 3,
  },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 16, backgroundColor: '#F0FFF4',
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerIcon: { fontSize: 26 },
  headerTitle: { fontSize: 16, fontWeight: '800', color: '#1a2332' },
  headerDate: { fontSize: 12, color: '#5a6a7a', marginTop: 1 },
  subheader: {
    fontSize: 13, color: '#5a6a7a', paddingHorizontal: 16, paddingBottom: 12,
    backgroundColor: '#F0FFF4',
  },
  noBrief: { padding: 20, alignItems: 'center' },
  noBriefText: { fontSize: 14, color: '#9aabb8', textAlign: 'center' },
  section: { backgroundColor: '#ffffff', paddingHorizontal: 16, paddingVertical: 14 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: '#1a2332', marginBottom: 12 },
  divider: { height: 1, backgroundColor: '#e8ecf0' },
  // AI bullet list
  aiBulletRow: { flexDirection: 'row', gap: 8, marginBottom: 10, alignItems: 'flex-start' },
  aiBulletDot: { fontSize: 16, color: '#00843D', lineHeight: 21, flexShrink: 0, marginTop: -1 },
  aiBulletText: { flex: 1, fontSize: 14, color: '#1a2332', lineHeight: 21 },
  // What it means card
  meansCard: {
    backgroundColor: '#00843D08', paddingHorizontal: 16, paddingVertical: 14,
    borderLeftWidth: 3, borderLeftColor: '#00843D',
  },
  meansLabel: {
    fontSize: 11, fontWeight: '700', color: '#00843D', marginBottom: 6,
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  meansText: { fontSize: 14, color: '#1a2332', lineHeight: 21 },
  // Generating indicator
  generatingRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#F0FFF4',
  },
  generatingText: { fontSize: 13, color: '#5a6a7a', fontStyle: 'italic' },
  // AI footer
  aiFooter: {
    paddingHorizontal: 16, paddingVertical: 8, backgroundColor: '#F0FFF4', alignItems: 'flex-end',
  },
  aiFooterText: { fontSize: 11, color: '#9aabb8' },
  // Stories (fallback)
  storyRow: {
    flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between',
    gap: 10, marginBottom: 12,
  },
  storyLeft: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, flex: 1 },
  catDot: { width: 8, height: 8, borderRadius: 4, marginTop: 5, flexShrink: 0 },
  storyHeadline: { fontSize: 13, fontWeight: '700', color: '#1a2332', lineHeight: 18 },
  storySummary: { fontSize: 12, color: '#5a6a7a', lineHeight: 17, marginTop: 2 },
  catTag: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, flexShrink: 0 },
  catTagText: { fontSize: 10, fontWeight: '700' },
  // Bills
  billRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10,
    backgroundColor: '#f8f9fa', borderRadius: 10, padding: 12,
  },
  billTitle: { fontSize: 13, fontWeight: '600', color: '#1a2332', lineHeight: 18 },
  billStatus: { fontSize: 11, color: '#00843D', fontWeight: '600', marginTop: 3 },
  // Personalised
  personalRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 8 },
  personalText: { flex: 1, fontSize: 13, color: '#1a2332', lineHeight: 18 },
  // Fact / one thing to know
  factBox: { backgroundColor: '#F0FFF4', borderRadius: 10, padding: 14 },
  factText: { fontSize: 13, color: '#1a2332', lineHeight: 19, fontStyle: 'italic' },
  // Share
  shareBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 14, backgroundColor: '#ffffff',
    borderTopWidth: 1, borderTopColor: '#e8ecf0',
  },
  shareBtnText: { fontSize: 14, fontWeight: '700', color: '#00843D' },
});

// ─── Main Screen ─────────────────────────────────────────────────────────────

export function HomeScreen({ navigation }: any) {
  const { colors } = useTheme();
  const { postcode, setPostcode, user } = useUser();
  const [postcodeInput, setPostcodeInput] = useState(postcode || '');
  const [refreshKey, setRefreshKey] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const greeting = getGreeting();
  const dateStr = new Date().toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' });
  const { bills: trendingBills, loading: billsLoading } = useBills({ limit: 10, activeOnly: true });
  const { divisions: recentDivisions, loading: divisionsLoading } = useRecentDivisions(5);
  const { items: newsItems, loading: newsLoading } = useNewsItems(5);
  const { stories: newsStories, loading: newsStoriesLoading } = useNewsStories();
  const [feedMode, setFeedMode] = useState<'foryou' | 'trending' | 'latest'>('foryou');
  const { polls, loading: pollsLoading } = usePolls();
  const electorateResult = useElectorateByPostcode(postcode);
  const { member: myMP, loading: mpLoading } = electorateResult;
  const { updates: repUpdates, loading: repUpdatesLoading } = useRepresentativeUpdates();
  const { brief, billsToWatch, loading: briefLoading, generating: briefGenerating } = useDailyBrief(
    electorateResult.electorate?.name ?? null,
    myMP ? `${myMP.first_name} ${myMP.last_name}` : null,
  );
  const { votes: mpVotes } = useVotes(myMP?.id ?? null);
  const mpTotalVotes = mpVotes.length;
  const mpAyeRate = mpTotalVotes > 0
    ? Math.round(mpVotes.filter(v => v.vote_cast === 'aye').length / mpTotalVotes * 100)
    : null;

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

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setRefreshKey(k => k + 1);
    setTimeout(() => setRefreshing(false), 1200);
  }, []);

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

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['bottom']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#ffffff" colors={['#ffffff']} />
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
                style={[styles.postcodePromptInput, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                value={postcodeInput}
                onChangeText={setPostcodeInput}
                placeholder="0000"
                placeholderTextColor="#9aabb8"
                keyboardType="number-pad"
                maxLength={4}
                returnKeyType="search"
                onSubmitEditing={handleSetPostcode}
              />
              <Pressable style={styles.postcodePromptBtn} onPress={handleSetPostcode}>
                <Ionicons name="search" size={16} color="#ffffff" />
              </Pressable>
            </View>
          </View>
        ) : (
          <View style={styles.myMPBanner}>
            <View style={styles.myMPSectionRow}>
              <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>YOUR REPRESENTATIVE</Text>
              <Pressable onPress={clearPostcode} hitSlop={8}>
                <Text style={styles.changeLink}>Change</Text>
              </Pressable>
            </View>
            {mpLoading ? (
              <SkeletonLoader height={110} borderRadius={16} />
            ) : myMP ? (
              <View style={[styles.myMPCard, { backgroundColor: colors.card }]}>
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
                    {mpTotalVotes > 0 && (
                      <View style={styles.myMPStats}>
                        <Text style={[styles.myMPStatText, { color: colors.textMuted }]}>{mpTotalVotes} votes · {mpAyeRate !== null ? `${mpAyeRate}% aye` : ''}</Text>
                      </View>
                    )}
                  </View>
                </View>
                <View style={[styles.myMPActions, { borderTopColor: colors.border }]}>
                  <Pressable
                    style={[styles.myMPActionBtn, styles.myMPActionBtnOutline, { borderColor: '#00843D' }]}
                    onPress={() => navigation.navigate('WriteToMP', { member: myMP })}
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
              <View style={styles.myMPFallback}>
                <Ionicons name="location-outline" size={18} color="#00843D" />
                <Text style={styles.myMPFallbackText}>
                  {electorateResult.electorate.name} ({electorateResult.electorate.state}) — MP data loading soon.
                </Text>
                <Pressable onPress={clearPostcode} hitSlop={8}>
                  <Text style={styles.changeLink}>Change</Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.myMPFallback}>
                <Ionicons name="information-circle-outline" size={18} color="#9aabb8" />
                <Text style={styles.myMPFallbackText}>No electorate found for {postcode}.</Text>
                <Pressable onPress={clearPostcode} hitSlop={8}>
                  <Text style={styles.changeLink}>Change</Text>
                </Pressable>
              </View>
            )}
          </View>
        )}

        {/* ── Daily Brief Card ─────────────────────────────────── */}
        <Pressable
          style={({ pressed }) => [
            styles.briefCard,
            { backgroundColor: colors.greenBg, opacity: pressed ? 0.92 : 1 },
          ]}
          onPress={() => navigation.navigate('DailyBrief')}
        >
          <View style={styles.briefCardLeft}>
            <Ionicons name="newspaper-outline" size={28} color="#00843D" />
            <View style={{ flex: 1 }}>
              <Text style={[styles.briefCardTitle, { color: colors.text }]}>
                {briefLoading ? 'Your brief is being prepared...' : 'Your Daily Brief is ready'}
              </Text>
              {!briefLoading && brief?.ai_text?.what_happened?.[0] && (
                <Text style={[styles.briefCardPreview, { color: colors.textBody }]} numberOfLines={1}>
                  {brief.ai_text.what_happened[0]}
                </Text>
              )}
              {!briefLoading && !brief?.ai_text && brief?.stories?.[0] && (
                <Text style={[styles.briefCardPreview, { color: colors.textBody }]} numberOfLines={1}>
                  {brief.stories[0].headline}
                </Text>
              )}
            </View>
          </View>
          <View style={styles.briefCardRight}>
            <Text style={styles.briefCardLink}>Read your brief</Text>
            <Ionicons name="chevron-forward" size={14} color="#00843D" />
          </View>
        </Pressable>

        {/* ── From Your Representatives ───────────────────────── */}
        <View style={[styles.section, { backgroundColor: colors.background }]}>
          <View style={styles.sectionHeader}>
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
                    <Text style={styles.writeToMPBtnText}>Write to {myMP.first_name} {myMP.last_name} →</Text>
                  </Pressable>
                )}
              </View>
            </View>
          ) : (
            repUpdates.slice(0, 4).map(update => {
              const m = update.member;
              const partyColour = m?.party?.colour || '#9aabb8';
              const initials = m ? `${m.first_name[0]}${m.last_name[0]}` : '??';
              const timeAgoStr = (() => {
                const diff = Date.now() - new Date(update.published_at).getTime();
                const mins = Math.floor(diff / 60000);
                if (mins < 60) return `${mins}m ago`;
                const hours = Math.floor(mins / 60);
                if (hours < 24) return `${hours}h ago`;
                return `${Math.floor(hours / 24)}d ago`;
              })();
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
                      <Text style={styles.repUpdateTime}>{timeAgoStr}</Text>
                    </View>
                    <View style={styles.repSourceBadge}>
                      <Text style={styles.repSourceBadgeText}>{sourceLabel[update.source] ?? update.source}</Text>
                    </View>
                  </View>
                  <Text style={[styles.repUpdateContent, { color: colors.text }]} numberOfLines={3}>{update.content}</Text>
                </Pressable>
              );
            })
          )}
        </View>

        {/* ── Recent Votes ───────────────────────────────────── */}
        <View style={[styles.section, { backgroundColor: colors.background }]}>
          <View style={styles.sectionHeader}>
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
                    <View key={d.id} style={[styles.voteCard, { backgroundColor: colors.surface }]}>
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
                    </View>
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

          // Filter non-political content (crime, sport, lifestyle) from ALL feed modes
          const filteredStories = filterPoliticalStories(newsStories);

          const personalised = usePersonalisedFeed(filteredStories, {
            electorate: electorateName,
            mpName,
            followedTopics: [],
          });

          const sorted = feedMode === 'foryou'
            ? personalised
            : feedMode === 'latest'
            ? [...filteredStories].sort((a, b) => new Date(b.first_seen).getTime() - new Date(a.first_seen).getTime())
            : filteredStories; // trending = default DB order (article_count DESC)

          const preview = sorted.slice(0, 5);

          return (
            <View style={[styles.section, { backgroundColor: colors.background }]}>
              <View style={styles.sectionHeader}>
                <View>
                  <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>TODAY'S NEWS</Text>
                  {postcode && electorateName && (
                    <Text style={[styles.sectionSubtitle, { color: colors.textMuted }]}>{electorateName}</Text>
                  )}
                </View>
                <Pressable onPress={() => navigation.navigate('News')} hitSlop={8}>
                  <Text style={styles.seeAll}>See all →</Text>
                </Pressable>
              </View>

              {/* Feed mode pills */}
              <View style={styles.feedPills}>
                {(['foryou', 'trending', 'latest'] as const).map(mode => (
                  <Pressable
                    key={mode}
                    style={[
                      styles.feedPill,
                      feedMode === mode && styles.feedPillActive,
                    ]}
                    onPress={() => setFeedMode(mode)}
                  >
                    <Text style={[
                      styles.feedPillText,
                      feedMode === mode && styles.feedPillTextActive,
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
                          style={[styles.newsItem, { borderLeftColor: categoryBorderColor(story.category ?? 'politics') }]}
                          onPress={() => navigation.navigate('NewsStoryDetail', { story })}
                        >
                          <View style={styles.newsCardHeader}>
                            <View style={styles.newsCardBadgeRow}>
                              <View style={[styles.newsCategoryBadge, { backgroundColor: categoryColor(story.category ?? 'politics') }]}>
                                <Text style={[styles.newsCategoryText, { color: colors.textBody }]}>{(story.category ?? 'politics').toUpperCase()}</Text>
                              </View>
                              {local && (
                                <View style={styles.localBadge}>
                                  <Text style={styles.localBadgeText}>LOCAL</Text>
                                </View>
                              )}
                            </View>
                            <View style={styles.newsDateRow}>
                            <Text style={styles.newsDate}>{timeAgo(story.first_seen)}</Text>
                            <Pressable
                              onPress={e => { e.stopPropagation(); setShareNewsStory(story); }}
                              hitSlop={8}
                              style={styles.newsShareBtn}
                            >
                              <Ionicons name="share-outline" size={14} color="#9aabb8" />
                            </Pressable>
                          </View>
                          </View>

                          <View style={styles.newsBody}>
                            <Text style={[styles.newsHeadline, { color: colors.text, flex: story.image_url ? 1 : undefined }]} numberOfLines={2}>{story.headline}</Text>
                            {story.image_url && (
                              <Image source={{ uri: story.image_url }} style={styles.newsThumbnail} />
                            )}
                          </View>
                          <View style={styles.newsCoverageRow}>
                            <CoverageBar
                              left={story.left_count}
                              center={story.center_count}
                              right={story.right_count}
                              height={4}
                            />
                            <View style={styles.newsSourceMeta}>
                              {story.article_count >= 5 && (
                                <View style={styles.trendingBadge}>
                                  <Text style={styles.trendingBadgeText}>TRENDING</Text>
                                </View>
                              )}
                              <Text style={[
                                styles.newsSourceCount,
                                story.article_count >= 3 && styles.newsSourceCountHot,
                              ]}>
                                {story.article_count} source{story.article_count !== 1 ? 's' : ''}
                              </Text>
                            </View>
                          </View>
                          {idx < preview.length - 1 && <View style={styles.newsItemSeparator} />}
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
            style={[styles.communityPreviewCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
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
          <View style={styles.sectionHeader}>
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
            <Text style={styles.sectionTitle}>Active Polls</Text>
            {polls.slice(0, 2).map(poll => (
              <PollCard key={poll.id} poll={poll} />
            ))}
          </View>
        )}

        {/* Daily Brief moved to top as tappable card */}

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
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FAFBFC' },
  scroll: { flex: 1 },
  content: { paddingTop: 0 },

  // Hero header
  hero: {
    backgroundColor: '#00843D',
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 28,
    marginBottom: 24,
  },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  heroGreeting: { fontSize: 30, fontWeight: '800', color: '#ffffff', letterSpacing: -0.5 },
  heroDate: { fontSize: 13, color: 'rgba(255,255,255,0.72)', marginTop: 3 },
  heroTagline: { fontSize: 14, color: 'rgba(255,255,255,0.82)', marginTop: 14 },
  heroTrackingLine: { fontSize: 11, color: 'rgba(255,255,255,0.55)', marginTop: 4 },
  heroLogoWrap: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingTop: 4 },
  heroLogo: { fontSize: 18, fontWeight: '700', color: '#ffffff' },

  // Postcode prompt card (above stats, no postcode set)
  postcodePromptCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#F0FFF4',
    marginHorizontal: 20,
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#D1FAE5',
  },
  postcodePromptTitle: { fontSize: 14, fontWeight: '700', color: '#1a2332' },
  postcodePromptSub: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  postcodePromptRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  postcodePromptInput: {
    width: 64,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1FAE5',
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 15,
    color: '#1a2332',
    textAlign: 'center',
  },
  postcodePromptBtn: {
    backgroundColor: '#00843D',
    borderRadius: 8,
    width: 34,
    height: 34,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // My MP banner
  myMPBanner: { marginHorizontal: 20, marginBottom: 24 },
  myMPSectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  myMPCard: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  myMPCardTop: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16 },
  myMPActions: {
    flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingBottom: 14,
    borderTopWidth: 1,
    paddingTop: 12,
  },
  myMPActionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, borderRadius: 10, height: 38,
  },
  myMPActionBtnOutline: { borderWidth: 1.5 },
  myMPActionText: { fontSize: 13, fontWeight: '700' },
  myMPPhoto: {
    width: 52,
    height: 52,
    borderRadius: 26,
    flexShrink: 0,
  },
  myMPAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  myMPInitials: { fontSize: 18, fontWeight: '800' },
  myMPName: { fontSize: 15, fontWeight: '700', color: '#1a2332' },
  myMPSub: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  myMPStats: { flexDirection: 'row', marginTop: 3 },
  myMPStatText: { fontSize: 11, color: '#9aabb8' },
  myMPRight: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 0 },
  myMPFallback: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F9FAFB',
    borderRadius: 14,
    padding: 14,
  },
  myMPFallbackText: { flex: 1, fontSize: 13, color: '#9aabb8', lineHeight: 18 },
  changeLink: { fontSize: 12, fontWeight: '600', color: '#00843D' },

  // Daily Brief card
  briefCard: {
    flexDirection: 'column',
    marginHorizontal: 20,
    marginBottom: 24,
    borderRadius: 14,
    padding: 16,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 2,
  },
  briefCardLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  briefCardTitle: { fontSize: 15, fontWeight: '700' },
  briefCardPreview: { fontSize: 13, marginTop: 2 },
  briefCardRight: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-end' },
  briefCardLink: { fontSize: 13, fontWeight: '700', color: '#00843D' },

  // Feed mode pills
  feedPills: {
    flexDirection: 'row', gap: 8, marginBottom: 14, paddingHorizontal: 0,
  },
  feedPill: {
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20,
    backgroundColor: '#f3f4f6',
  },
  feedPillActive: { backgroundColor: '#00843D' },
  feedPillText: { fontSize: 13, fontWeight: '600' },
  feedPillTextActive: { color: '#ffffff' },

  // MP card (kept for MPCard component used in MemberProfileScreen nav)
  mpCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  mpAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  mpInitials: { fontSize: 17, fontWeight: '700' },
  mpInfo: { flex: 1, gap: 5 },
  mpName: { fontSize: 16, fontWeight: '700', color: '#1a2332' },
  mpElectorate: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  mpArrow: { flexDirection: 'row', alignItems: 'center', gap: 2, flexShrink: 0 },
  mpArrowText: { fontSize: 12, fontWeight: '600' },

  // Section
  section: { marginBottom: 32, paddingHorizontal: 20 },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionLabel: { fontSize: 11, fontWeight: '600', color: '#9aabb8', letterSpacing: 0.8, textTransform: 'uppercase' },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#1a2332' },
  seeAll: { fontSize: 13, color: '#00843D', fontWeight: '600' },
  hScroll: { paddingBottom: 4, paddingRight: 4 },
  livePill: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#FDECEA', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#DC3545' },
  liveText: { fontSize: 10, fontWeight: '800', color: '#DC3545', letterSpacing: 1 },
  emptyFeed: { alignItems: 'center', gap: 10, paddingVertical: 32 },
  emptyFeedText: { fontSize: 14, color: '#9aabb8', textAlign: 'center' },

  // Vote cards (Recent Votes)
  voteCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  voteCardIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  voteCardTitle: { fontSize: 15, fontWeight: '600', color: '#1a2332', lineHeight: 21 },
  voteCardMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4, flexWrap: 'wrap' },
  voteCardDate: { fontSize: 12, color: '#9aabb8' },
  voteCardChamber: { backgroundColor: '#F3F4F6', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  voteCardChamberText: { fontSize: 11, color: '#6B7280', fontWeight: '500' },
  divCountBadge: { backgroundColor: '#EFF6FF', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  divCountText: { fontSize: 10, fontWeight: '600', color: '#2563EB' },

  // Activity
  activityCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 13,
    gap: 12,
  },
  activityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    flexShrink: 0,
  },
  activityInfo: { flex: 1 },
  activityTitle: { fontSize: 13, fontWeight: '500', color: '#1a2332', lineHeight: 18 },
  activityDate: { fontSize: 11, color: '#9aabb8', marginTop: 2 },
  activityChamberBadge: {
    backgroundColor: '#F3F4F6',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
    flexShrink: 0,
  },
  activityChamberText: { fontSize: 10, color: '#6B7280', fontWeight: '500' },
  activityDivider: { height: 1, backgroundColor: '#F3F4F6', marginLeft: 36 },
  activitySkeleton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },

  bottomPad: { height: 20 },

  // Representative Updates
  repUpdateCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.07,
    shadowRadius: 3,
    elevation: 2,
    gap: 8,
  },
  repUpdateHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  repUpdateAvatar: {
    width: 36, height: 36, borderRadius: 18,
    justifyContent: 'center', alignItems: 'center', overflow: 'hidden',
  },
  repUpdateAvatarImg: { width: 36, height: 36, borderRadius: 18 },
  repUpdateInitials: { fontSize: 13, fontWeight: '700' },
  repUpdateName: { fontSize: 13, fontWeight: '700', color: '#1a2332' },
  repUpdateTime: { fontSize: 11, color: '#9aabb8', marginTop: 1 },
  repSourceBadge: {
    backgroundColor: '#F3F4F6',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  repSourceBadgeText: { fontSize: 10, fontWeight: '600', color: '#5a6a7a' },
  repUpdateContent: { fontSize: 13, color: '#2d3748', lineHeight: 19 },
  repUpdatesEmptyCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 14,
    borderRadius: 14, padding: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 3, elevation: 1,
  },
  repUpdatesEmptyIcon: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: '#E8F5EE', justifyContent: 'center', alignItems: 'center', flexShrink: 0,
  },
  repUpdatesEmptyTitle: { fontSize: 14, fontWeight: '700', marginBottom: 4, lineHeight: 20 },
  repUpdatesEmptyText: { fontSize: 13, lineHeight: 19 },
  writeToMPBtn: { marginTop: 10, alignSelf: 'flex-start' },
  writeToMPBtnText: { fontSize: 13, fontWeight: '700', color: '#00843D' },

  // Today's News
  newsListCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  newsItem: {
    padding: 16,
    borderLeftWidth: 3,
  },
  newsItemSeparator: { height: 1, backgroundColor: '#F3F4F6', marginLeft: 16 },
  newsEmptyState: { alignItems: 'center', paddingVertical: 24, gap: 6 },
  newsEmptyText: { fontSize: 14, fontWeight: '700', color: '#5a6a7a' },
  newsEmptySubText: { fontSize: 12, color: '#9aabb8', textAlign: 'center', paddingHorizontal: 16 },
  newsCardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  newsCategoryBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  newsCategoryText: { fontSize: 10, fontWeight: '700', color: '#374151', letterSpacing: 0.4 },
  newsDate: { fontSize: 11, color: '#9aabb8' },
  newsDateRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  newsShareBtn: { padding: 2 },
  newsBody: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 6 },
  newsHeadline: { fontSize: 14, fontWeight: '700', color: '#1a2332', lineHeight: 20 },
  newsThumbnail: { width: 56, height: 56, borderRadius: 6, flexShrink: 0, backgroundColor: '#f3f4f6' },
  newsSummary: { fontSize: 12, color: '#6B7280', lineHeight: 17 },
  newsCardBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  newsCoverageRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  newsSourceCount: { fontSize: 11, color: '#9aabb8', flexShrink: 0 },
  newsSourceCountHot: { color: '#00843D', fontWeight: '700' },
  newsSourceMeta: { flexDirection: 'row', alignItems: 'center', gap: 5, flexShrink: 0 },
  trendingBadge: { backgroundColor: '#FFF3CD', borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2 },
  trendingBadgeText: { fontSize: 9, fontWeight: '800', color: '#856404', letterSpacing: 0.3 },
  localBadge: { backgroundColor: '#00843D', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  localBadgeText: { fontSize: 9, fontWeight: '800', color: '#ffffff', letterSpacing: 0.5 },
  sectionSubtitle: { fontSize: 11, color: '#9aabb8', marginTop: 1 },

  // Did You Know
  funFactCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: '#F0FFF4',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#D1FAE5',
  },
  funFactEmoji: { fontSize: 22, marginTop: 2 },
  funFactLabel: { fontSize: 12, fontWeight: '700', color: '#00843D', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  funFactText: { fontSize: 14, color: '#1a2332', lineHeight: 21, marginBottom: 6 },
  funFactSource: { fontSize: 11, color: '#9aabb8' },

  // Community Preview Card
  communityPreviewCard: {
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    backgroundColor: '#f8f9fb',
    borderColor: '#e8ecf0',
  },
  communityPreviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  communityPreviewTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: '#1a2332',
  },
  communityPreviewSub: {
    fontSize: 13,
    color: '#5a6a7a',
  },
});
