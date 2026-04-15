import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  Linking,
  Platform,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';
import { NewsStory } from '../hooks/useNewsStories';
import { useNewsStoryArticles, StoryArticle } from '../hooks/useNewsStoryArticles';
import { CoverageBar } from '../components/CoverageBar';
import { SkeletonLoader } from '../components/SkeletonLoader';
import { useUser } from '../context/UserContext';
import { useElectorateByPostcode } from '../hooks/useElectorateByPostcode';
import { useVotes, DivisionVote } from '../hooks/useVotes';
import { supabase } from '../lib/supabase';
import { NewsShareCard } from '../components/ShareCards';
import { captureAndShare } from '../utils/shareContent';
import { decodeHtml } from '../utils/decodeHtml';
import { useTheme } from '../context/ThemeContext';
import { useSave } from '../hooks/useSaves';
import { AuthPromptSheet } from '../components/AuthPromptSheet';
import { useAuthGate } from '../hooks/useAuthGate';
import { track } from '../lib/analytics';
import { SPACING, FONT_SIZE, FONT_WEIGHT, BORDER_RADIUS, SHADOWS } from '../constants/design';

// ── Leaning config ─────────────────────────────────────────────────────────────

const LEANING_DOT_COLOR: Record<string, string> = {
  'left':         '#4C9BE8',
  'center-left':  '#7EB8F0',
  'center':       '#9aabb8',
  'center-right': '#E8A87C',
  'right':        '#DC3545',
};

const LEANING_LABEL: Record<string, string> = {
  'left':         'Left-leaning',
  'center-left':  'Centre-left',
  'center':       'Centre',
  'center-right': 'Centre-right',
  'right':        'Right-leaning',
};

const FACTUALITY_LABEL: Record<number, string> = {
  4: 'Very High',
  3: 'High',
  2: 'Mixed',
  1: 'Low',
};

const FACTUALITY_COLOR: Record<number, string> = {
  4: '#00843D',
  3: '#2E7D32',
  2: '#856404',
  1: '#DC3545',
};

// Articles are already sorted left→right by the hook; we group them into 3 buckets
function groupByLeaning(articles: StoryArticle[]): { label: string; color: string; items: StoryArticle[] }[] {
  const left   = articles.filter(a => a.source?.leaning === 'left' || a.source?.leaning === 'center-left');
  const center = articles.filter(a => a.source?.leaning === 'center');
  const right  = articles.filter(a => a.source?.leaning === 'center-right' || a.source?.leaning === 'right');
  const groups: { label: string; color: string; items: StoryArticle[] }[] = [];
  if (left.length)   groups.push({ label: 'Left-leaning',  color: '#4C9BE8', items: left });
  if (center.length) groups.push({ label: 'Centre',        color: '#9aabb8', items: center });
  if (right.length)  groups.push({ label: 'Right-leaning', color: '#DC3545', items: right });
  return groups;
}

// ── Story category → party_policies category map ──────────────────────────────

const STORY_TO_POLICY_CAT: Record<string, string> = {
  climate:     'climate',
  economy:     'economy',
  health:      'healthcare',
  housing:     'housing',
  defence:     'defence',
  immigration: 'immigration',
};

// ── Personalisation helpers ────────────────────────────────────────────────────

const VOTE_STOP = new Set([
  "the","a","an","in","to","for","on","and","of","is","at","by","from",
  "with","as","its","it","that","this","are","was","has","have","be",
  "will","not","but","bills","bill","amendment","act",
]);

function storyKeywords(headline: string): Set<string> {
  const words = headline.toLowerCase().match(/[a-z]{4,}/g) || [];
  return new Set(words.filter(w => !VOTE_STOP.has(w)));
}

function findRelatedVote(votes: DivisionVote[], headline: string): DivisionVote | null {
  const storyWords = storyKeywords(headline);
  for (const vote of votes) {
    if (!vote.division?.name) continue;
    const divWords = storyKeywords(vote.division.name);
    const overlap = [...storyWords].filter(w => divWords.has(w)).length;
    if (overlap >= 2) return vote;
  }
  return null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractDomain(url: string | undefined): string | null {
  if (!url) return null;
  try {
    const hostname = new URL(url).hostname;
    return hostname;
  } catch {
    return null;
  }
}

// ── Article card ───────────────────────────────────────────────────────────────

function ArticleCard({ article }: { article: StoryArticle }) {
  const { colors } = useTheme();
  const [faviconFailed, setFaviconFailed] = useState(false);
  const leaning = article.source?.leaning ?? 'center';
  const dotColor = LEANING_DOT_COLOR[leaning] ?? '#9aabb8';
  const leaningLabel = LEANING_LABEL[leaning] ?? leaning;
  const factNum = article.source?.factuality_numeric ?? null;
  const owner = article.source?.owner ?? null;

  const sourceDomain = extractDomain(article.source?.website_url) ?? extractDomain(article.url);
  const sourceName = article.source?.name ?? 'Unknown';
  const faviconUrl = sourceDomain
    ? `https://www.google.com/s2/favicons?domain=${sourceDomain}&sz=32`
    : null;

  const handleOpen = async () => {
    try {
      const supported = await Linking.canOpenURL(article.url);
      if (supported) Linking.openURL(article.url);
    } catch {}
  };

  return (
    <View style={[styles.articleCard, { backgroundColor: colors.background }]}>
      <View style={styles.articleSourceRow}>
        <View style={[styles.leaningDot, { backgroundColor: dotColor }]} />
        <View style={{ flex: 1 }}>
          <View style={styles.sourceNameRow}>
            {faviconUrl && !faviconFailed ? (
              <ExpoImage
                source={{ uri: faviconUrl }}
                style={{ width: 16, height: 16, borderRadius: 3 }}
                onError={() => setFaviconFailed(true)}
              />
            ) : (
              <View style={{
                width: 16, height: 16, borderRadius: 8,
                backgroundColor: '#D1D5DB',
                justifyContent: 'center', alignItems: 'center',
              }}>
                <Text style={{ fontSize: 9, fontWeight: '700', color: '#6B7280' }}>
                  {sourceName.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
            <Text style={[styles.sourceName, { color: colors.text }]}>{sourceName}</Text>
            <Text style={[styles.leaningLabel, { color: colors.textMuted }]}>{leaningLabel}</Text>
          </View>
          {(owner || factNum) ? (
            <View style={styles.sourceMeta}>
              {owner ? (
                <Text style={[styles.ownerText, { color: colors.textMuted }]}>{owner}</Text>
              ) : null}
              {factNum && FACTUALITY_LABEL[factNum] ? (
                <View style={[styles.factBadge, { backgroundColor: FACTUALITY_COLOR[factNum] + '18' }]}>
                  <Text style={[styles.factBadgeText, { color: FACTUALITY_COLOR[factNum] }]}>
                    {FACTUALITY_LABEL[factNum]} factuality
                  </Text>
                </View>
              ) : null}
            </View>
          ) : null}
        </View>
      </View>
      <Text style={[styles.articleTitle, { color: colors.text }]} numberOfLines={2}>{article.title}</Text>
      {article.description ? (
        <Text style={[styles.articleDesc, { color: colors.textBody }]} numberOfLines={3}>{decodeHtml(article.description)}</Text>
      ) : null}
      <Pressable style={styles.readLink} onPress={handleOpen}>
        <Text style={styles.readLinkText}>Read full article</Text>
        <Ionicons name="arrow-forward" size={13} color="#00843D" />
      </Pressable>
    </View>
  );
}

// ── Main screen ────────────────────────────────────────────────────────────────

export function NewsStoryDetailScreen({ route, navigation }: any) {
  const { colors } = useTheme();
  const { story: storyParam, storyId } = route.params as { story?: NewsStory; storyId?: number };
  const [story, setStory] = useState<NewsStory | null>(storyParam ?? null);

  useEffect(() => {
    if (!story && storyId) {
      supabase.from('news_stories').select('*').eq('id', storyId).single()
        .then(({ data }) => { if (data) setStory(data as NewsStory); });
    }
  }, [storyId]);

  useEffect(() => {
    if (story) track('news_story_view', { story_id: story.id, headline: story.headline, category: story.category }, 'NewsStoryDetail');
  }, [story?.id]);

  const { articles, loading } = useNewsStoryArticles(story?.id ?? 0);
  const { saved: bookmarked, toggle: toggleBookmark } = useSave('news_story', String(story?.id ?? ''));
  const { requireAuth, authSheetProps } = useAuthGate();

  const { postcode, user } = useUser();

  const newsCardRef = useRef<any>(null);
  const [capturing, setCapturing] = useState(false);

  useEffect(() => {
    if (capturing && story) {
      captureAndShare(newsCardRef, 'news_story', String(story.id), user?.id)
        .finally(() => setCapturing(false));
    }
  }, [capturing]);
  const { electorate, member: myMP } = useElectorateByPostcode(postcode);
  const { votes: mpVotes } = useVotes(myMP?.id ?? null);

  const relatedVote = myMP && story ? findRelatedVote(mpVotes, story.headline) : null;

  // Fetch party policy for this story's category (fallback when no vote match)
  const [partyPolicySummary, setPartyPolicySummary] = useState<string | null>(null);
  useEffect(() => {
    if (!myMP?.party_id || relatedVote || !story) { setPartyPolicySummary(null); return; }
    const policyCat = STORY_TO_POLICY_CAT[story.category ?? ''];
    if (!policyCat) { setPartyPolicySummary(null); return; }
    supabase
      .from('party_policies')
      .select('summary_plain')
      .eq('party_id', myMP.party_id)
      .eq('category', policyCat)
      .single()
      .then(({ data }) => {
        setPartyPolicySummary((data as any)?.summary_plain ?? null);
      });
  }, [myMP?.party_id, story?.category, relatedVote]);

  if (!story) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
        <SkeletonLoader width="100%" height={200} />
      </SafeAreaView>
    );
  }

  const total = story.left_count + story.center_count + story.right_count;

  // Blindspot: prefer DB value, fall back to client-side computation
  const blindspotSide: string | null =
    story.blindspot ??
    (story.article_count >= 3
      ? story.left_count === 0 && story.right_count > 0
        ? 'left'
        : story.right_count === 0 && story.left_count > 0
        ? 'right'
        : null
      : null);

  const articleGroups = groupByLeaning(articles);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
      {/* Nav bar */}
      <View style={styles.navBar}>
        <Pressable style={[styles.navBtn, { backgroundColor: colors.cardAlt }]} onPress={() => navigation.goBack()} hitSlop={8}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Pressable>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Pressable style={[styles.navBtn, { backgroundColor: colors.cardAlt }]} onPress={() => requireAuth('save this story', toggleBookmark)} hitSlop={8}>
            <Ionicons name={bookmarked ? 'bookmark' : 'bookmark-outline'} size={20} color={bookmarked ? '#00843D' : colors.text} />
          </Pressable>
          <Pressable style={[styles.navBtn, { backgroundColor: colors.cardAlt }]} onPress={() => setCapturing(true)} hitSlop={8}>
            <Ionicons name={Platform.OS === 'ios' ? 'share-outline' : 'share-social-outline'} size={22} color={colors.text} />
          </Pressable>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => { if (story?.id) { supabase.from('news_stories').select('*').eq('id', story.id).single().then(({ data }) => { if (data) setStory(data as NewsStory); }); } }} tintColor="#00843D" />}
      >
        {/* Headline */}
        <Text style={[styles.headline, { color: colors.text }]}>{story.headline}</Text>

        {/* AI Summary */}
        {story.ai_summary ? (
          <View style={[styles.summaryCard, { backgroundColor: colors.greenBg }]}>
            <View style={styles.summaryHeader}>
              <Ionicons name="sparkles" size={14} color="#00843D" />
              <Text style={styles.summaryLabel}>AI SUMMARY</Text>
            </View>
            <Text style={[styles.summaryText, { color: colors.text }]}>{story.ai_summary}</Text>
            <Text style={[styles.summaryFooter, { color: colors.textBody }]}>Powered by Verity AI</Text>
          </View>
        ) : null}

        {/* Coverage bar */}
        <View style={styles.barWrap}>
          <CoverageBar
            left={story.left_count}
            center={story.center_count}
            right={story.right_count}
            height={14}
            showLabel
          />
        </View>

        {/* Leaning breakdown */}
        <View style={styles.breakdownRow}>
          {story.left_count > 0 && (
            <Text style={[styles.breakdownCount, { color: '#4C9BE8' }]}>
              {story.left_count} Left
            </Text>
          )}
          {story.center_count > 0 && (
            <>
              {story.left_count > 0 && <Text style={[styles.breakdownSep, { color: colors.textMuted }]}> · </Text>}
              <Text style={[styles.breakdownCount, { color: '#9aabb8' }]}>
                {story.center_count} Centre
              </Text>
            </>
          )}
          {story.right_count > 0 && (
            <>
              {(story.left_count > 0 || story.center_count > 0) && (
                <Text style={[styles.breakdownSep, { color: colors.textMuted }]}> · </Text>
              )}
              <Text style={[styles.breakdownCount, { color: '#DC3545' }]}>
                {story.right_count} Right
              </Text>
            </>
          )}
          {total > 0 && (
            <Text style={[styles.breakdownTotal, { color: colors.textMuted }]}> · {total} source{total !== 1 ? 's' : ''}</Text>
          )}
        </View>

        {/* Legend */}
        <View style={styles.legend}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#4C9BE8' }]} />
            <Text style={[styles.legendLabel, { color: colors.textBody }]}>Left</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#9aabb8' }]} />
            <Text style={[styles.legendLabel, { color: colors.textBody }]}>Centre</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#DC3545' }]} />
            <Text style={[styles.legendLabel, { color: colors.textBody }]}>Right</Text>
          </View>
        </View>

        {/* Blindspot alert */}
        {blindspotSide ? (
          <View style={[styles.blindspotCard, { backgroundColor: colors.cardAlt }]}>
            <Ionicons name="warning-outline" size={16} color="#D97706" />
            <Text style={[styles.blindspotText, { color: colors.textBody }]}>
              <Text style={styles.blindspotBold}>Blindspot: </Text>
              {blindspotSide === 'left'
                ? 'No left-leaning outlets have covered this story.'
                : 'No right-leaning outlets have covered this story.'}
            </Text>
          </View>
        ) : null}

        <View style={[styles.divider, { backgroundColor: colors.border }]} />

        {/* Coverage section */}
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Coverage</Text>

        {loading ? (
          [1, 2, 3].map(i => (
            <SkeletonLoader key={i} height={110} borderRadius={12} style={{ marginBottom: 10 }} />
          ))
        ) : articles.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>No articles found for this story.</Text>
          </View>
        ) : articleGroups.length > 1 ? (
          // Grouped by leaning
          articleGroups.map(group => (
            <View key={group.label}>
              <View style={styles.groupHeaderRow}>
                <View style={[styles.groupDot, { backgroundColor: group.color }]} />
                <Text style={[styles.groupLabel, { color: colors.textBody }]}>{group.label}</Text>
                <View style={[styles.groupCount, { backgroundColor: group.color + '18' }]}>
                  <Text style={[styles.groupCountText, { color: group.color }]}>{group.items.length}</Text>
                </View>
              </View>
              {group.items.map(a => <ArticleCard key={a.id} article={a} />)}
            </View>
          ))
        ) : (
          // Flat list when only one leaning group
          articles.map(a => <ArticleCard key={a.id} article={a} />)
        )}

        {/* How this affects you */}
        {myMP && electorate && (
          <>
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <Text style={[styles.sectionTitle, { color: colors.text }]}>How this affects you</Text>
            <View style={[styles.affectsCard, { backgroundColor: colors.greenBg }]}>
              <Ionicons name="location-outline" size={18} color="#00843D" style={{ marginTop: 1 }} />
              <View style={{ flex: 1 }}>
                {relatedVote ? (
                  <Text style={[styles.affectsText, { color: colors.text }]}>
                    You're in <Text style={styles.affectsBold}>{electorate.name}</Text>.
                    Your MP <Text style={styles.affectsBold}>{myMP.first_name} {myMP.last_name}</Text>{' '}
                    voted <Text style={[styles.affectsVote, { color: relatedVote.vote_cast === 'aye' ? '#00843D' : '#DC3545' }]}>
                      {relatedVote.vote_cast === 'aye' ? 'FOR' : relatedVote.vote_cast === 'no' ? 'AGAINST' : relatedVote.vote_cast.toUpperCase()}
                    </Text> on related legislation ({relatedVote.division?.name
                      ? relatedVote.division.name.replace(/^Bills?\s*[—\-]\s*/i, '').trim().slice(0, 60)
                      : 'a related bill'}).
                  </Text>
                ) : partyPolicySummary ? (
                  <Text style={[styles.affectsText, { color: colors.text }]}>
                    You're in <Text style={styles.affectsBold}>{electorate.name}</Text>.
                    Your MP is <Text style={styles.affectsBold}>{myMP.first_name} {myMP.last_name}</Text>
                    {myMP.party ? ` (${myMP.party.short_name || myMP.party.name})` : ''}.
                    {'\n\n'}
                    <Text style={styles.affectsBold}>{myMP.party?.short_name || myMP.party?.name || 'Their party'} position: </Text>
                    {partyPolicySummary.length > 160
                      ? partyPolicySummary.slice(0, 157) + '…'
                      : partyPolicySummary}
                  </Text>
                ) : (
                  <Text style={[styles.affectsText, { color: colors.text }]}>
                    You're in <Text style={styles.affectsBold}>{electorate.name}</Text>.
                    Your MP is <Text style={styles.affectsBold}>{myMP.first_name} {myMP.last_name}</Text>
                    {myMP.party ? ` (${myMP.party.short_name || myMP.party.name})` : ''}.
                    No direct vote record found for this story.
                  </Text>
                )}
              </View>
            </View>
          </>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>

      {/* Hidden news share card */}
      <View style={{ position: 'absolute', left: -9999, top: 0 }} pointerEvents="none">
        <View ref={newsCardRef}>
          {capturing && (
            <NewsShareCard
              headline={story.headline}
              category={story.category}
              articleCount={story.article_count}
              leftCount={story.left_count}
              centerCount={story.center_count}
              rightCount={story.right_count}
            />
          )}
        </View>
      </View>
      <AuthPromptSheet {...authSheetProps} />
    </SafeAreaView>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { flex: 1 },
  content: { paddingHorizontal: SPACING.lg + 4, paddingBottom: SPACING.lg + 4 },

  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg + 4,
    paddingVertical: SPACING.md,
  },
  navBtn: {
    width: 40, height: 40, borderRadius: 20,
    justifyContent: 'center', alignItems: 'center',
  },

  headline: {
    fontSize: 22, fontWeight: FONT_WEIGHT.bold,
    lineHeight: 30, marginBottom: SPACING.lg,
  },

  summaryCard: {
    borderRadius: BORDER_RADIUS.lg, padding: SPACING.lg, marginBottom: SPACING.lg,
    borderLeftWidth: 3, borderLeftColor: '#00843D',
    gap: SPACING.sm,
  },
  summaryHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs + 2 },
  summaryLabel: { fontSize: FONT_SIZE.caption, fontWeight: FONT_WEIGHT.bold, color: '#00843D', letterSpacing: 0.8 },
  summaryText: { fontSize: FONT_SIZE.body, lineHeight: 22 },
  summaryFooter: { fontSize: FONT_SIZE.caption, marginTop: SPACING.xs },

  barWrap: { marginBottom: SPACING.sm + 2 },
  breakdownRow: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.md, flexWrap: 'wrap' },
  breakdownCount: { fontSize: FONT_SIZE.small, fontWeight: FONT_WEIGHT.bold },
  breakdownSep: { fontSize: FONT_SIZE.small },
  breakdownTotal: { fontSize: FONT_SIZE.small },

  legend: {
    flexDirection: 'row',
    gap: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendLabel: { fontSize: FONT_SIZE.small - 1 },

  divider: { height: 1, marginBottom: SPACING.lg },
  sectionTitle: { fontSize: FONT_SIZE.subtitle - 1, fontWeight: FONT_WEIGHT.bold, marginBottom: SPACING.md },

  groupHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
    marginTop: SPACING.xs,
  },
  groupDot: { width: 8, height: 8, borderRadius: 4 },
  groupLabel: { fontSize: FONT_SIZE.small - 1, fontWeight: FONT_WEIGHT.bold, flex: 1 },
  groupCount: { borderRadius: BORDER_RADIUS.md, paddingHorizontal: 7, paddingVertical: 2 },
  groupCountText: { fontSize: FONT_SIZE.caption, fontWeight: FONT_WEIGHT.bold },

  articleCard: {
    borderRadius: BORDER_RADIUS.md + 2,
    padding: SPACING.md + 2,
    marginBottom: SPACING.sm + 2,
    ...SHADOWS.sm,
    gap: SPACING.xs + 2,
  },
  articleSourceRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
  },
  leaningDot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0, marginTop: SPACING.xs },
  sourceNameRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs + 2, flexWrap: 'wrap' },
  sourceName: { fontSize: FONT_SIZE.small - 1, fontWeight: FONT_WEIGHT.bold },
  leaningLabel: { fontSize: FONT_SIZE.caption },
  sourceMeta: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginTop: 2, flexWrap: 'wrap' },
  ownerText: { fontSize: FONT_SIZE.caption },
  factBadge: { borderRadius: BORDER_RADIUS.sm - 2, paddingHorizontal: SPACING.xs + 2, paddingVertical: 2 },
  factBadgeText: { fontSize: 10, fontWeight: FONT_WEIGHT.bold },
  articleTitle: { fontSize: FONT_SIZE.small + 1, fontWeight: FONT_WEIGHT.semibold, lineHeight: 20 },
  articleDesc: { fontSize: FONT_SIZE.small, lineHeight: 19 },
  readLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginTop: 2,
  },
  readLinkText: { fontSize: FONT_SIZE.small, fontWeight: FONT_WEIGHT.semibold, color: '#00843D' },

  emptyState: { padding: SPACING.lg, alignItems: 'center' },
  emptyText: { fontSize: FONT_SIZE.small + 1 },

  blindspotCard: {
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  blindspotText: { flex: 1, fontSize: FONT_SIZE.small, lineHeight: 18 },
  blindspotBold: { fontWeight: FONT_WEIGHT.bold },

  affectsCard: {
    borderRadius: BORDER_RADIUS.md + 2,
    padding: SPACING.md + 2,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm + 2,
  },
  affectsText: { fontSize: FONT_SIZE.small, lineHeight: 20 },
  affectsBold: { fontWeight: FONT_WEIGHT.bold },
  affectsVote: { fontWeight: FONT_WEIGHT.bold },
});
