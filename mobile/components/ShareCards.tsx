/**
 * Share card components — rendered offscreen at 360×640 (9:16) and captured
 * as PNG via react-native-view-shot. At 3× device density → 1080×1920.
 */
import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { topicAccent } from '../constants/topicColors';

const GREEN = '#00843D';
const DARK  = '#1a2332';
const GREY  = '#9aabb8';
const CARD_W = 360;
const CARD_H = 640;

// ─── Shared header / footer ───────────────────────────────────────────────────

function CardHeader({ subtitle }: { subtitle?: string }) {
  return (
    <View style={s.header}>
      <Text style={s.logoV}>V</Text>
      <View>
        <Text style={s.logoText}>VERITY</Text>
        {subtitle ? <Text style={s.logoSub}>{subtitle}</Text> : null}
      </View>
    </View>
  );
}

function CardFooter({ cta }: { cta: string }) {
  return (
    <View style={s.footer}>
      <Text style={s.footerCta}>{cta}</Text>
      <Text style={s.footerUrl}>verity.au</Text>
    </View>
  );
}

// ─── 1. Vote Share Card ───────────────────────────────────────────────────────

interface VoteShareCardProps {
  mpName: string;
  mpPhotoUrl: string | null;
  partyName: string;
  partyColour: string;
  divisionName: string;
  voteCast: string;
  date: string | null;
}

export function VoteShareCard({
  mpName, mpPhotoUrl, partyName, partyColour, divisionName, voteCast, date,
}: VoteShareCardProps) {
  const isAye = voteCast === 'aye';
  const isNo  = voteCast === 'no';
  const voteLabel  = isAye ? 'AYE' : isNo ? 'NO' : voteCast.toUpperCase();
  const voteBg     = isAye ? '#E8F5EE' : isNo ? '#FDECEA' : '#F5F5F5';
  const voteColour = isAye ? GREEN : isNo ? '#DC3545' : GREY;
  const formattedDate = date
    ? new Date(date).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })
    : '';

  return (
    <View style={s.card}>
      <CardHeader subtitle="VOTE RECORD" />

      {/* MP identity */}
      <View style={s.mpRow}>
        {mpPhotoUrl ? (
          <Image source={{ uri: mpPhotoUrl }} style={s.mpPhoto} />
        ) : (
          <View style={[s.mpPhotoPlaceholder, { backgroundColor: partyColour + '33' }]}>
            <Text style={[s.mpInitials, { color: partyColour }]}>
              {mpName.split(' ').map(n => n[0]).join('').slice(0, 2)}
            </Text>
          </View>
        )}
        <View style={s.mpInfo}>
          <Text style={s.mpName}>{mpName}</Text>
          <View style={[s.partyBadge, { backgroundColor: partyColour + '22' }]}>
            <Text style={[s.partyBadgeText, { color: partyColour }]}>{partyName}</Text>
          </View>
        </View>
      </View>

      {/* Division name */}
      <View style={s.divisionBox}>
        <Text style={s.divisionLabel}>VOTED ON</Text>
        <Text style={s.divisionName} numberOfLines={4}>{divisionName}</Text>
      </View>

      {/* Vote badge */}
      <View style={[s.voteBadge, { backgroundColor: voteBg }]}>
        <Text style={[s.voteBadgeText, { color: voteColour }]}>{voteLabel}</Text>
      </View>

      {/* Date */}
      {formattedDate ? <Text style={s.voteDate}>{formattedDate}</Text> : null}

      <CardFooter cta="Check your MP's voting record on Verity" />
    </View>
  );
}

// ─── 2. News Story Share Card ─────────────────────────────────────────────────

interface NewsShareCardProps {
  headline: string;
  category: string | null;
  articleCount: number;
  leftCount: number;
  centerCount: number;
  rightCount: number;
}

export function NewsShareCard({
  headline, category, articleCount, leftCount, centerCount, rightCount,
}: NewsShareCardProps) {
  const total = leftCount + centerCount + rightCount || 1;
  const cat = category ?? 'politics';
  const catColour = topicAccent(cat);

  return (
    <View style={s.card}>
      <CardHeader subtitle="TODAY'S NEWS" />

      {/* Category */}
      <View style={[s.catChip, { backgroundColor: catColour + '18' }]}>
        <Text style={[s.catChipText, { color: catColour }]}>{cat.toUpperCase()}</Text>
      </View>

      {/* Headline */}
      <Text style={s.newsHeadline} numberOfLines={5}>{headline}</Text>

      {/* Source count */}
      <Text style={s.sourceCount}>
        Covered by <Text style={s.sourceCountBold}>{articleCount}</Text> source{articleCount !== 1 ? 's' : ''}
      </Text>

      {/* Coverage bar */}
      <View style={s.coverageSection}>
        <View style={s.coverageBar}>
          {leftCount   > 0 && <View style={[s.seg, { flex: leftCount,   backgroundColor: '#4C9BE8' }]} />}
          {centerCount > 0 && <View style={[s.seg, { flex: centerCount, backgroundColor: '#9aabb8' }]} />}
          {rightCount  > 0 && <View style={[s.seg, { flex: rightCount,  backgroundColor: '#DC3545' }]} />}
        </View>
        <View style={s.coverageLegend}>
          {leftCount   > 0 && <Text style={[s.legendItem, { color: '#4C9BE8' }]}>● Left {Math.round(leftCount/total*100)}%</Text>}
          {centerCount > 0 && <Text style={[s.legendItem, { color: '#9aabb8' }]}>● Centre {Math.round(centerCount/total*100)}%</Text>}
          {rightCount  > 0 && <Text style={[s.legendItem, { color: '#DC3545' }]}>● Right {Math.round(rightCount/total*100)}%</Text>}
        </View>
      </View>

      <CardFooter cta="See the full picture on Verity" />
    </View>
  );
}

// ─── 3. MP Report Card ────────────────────────────────────────────────────────

interface MPReportCardProps {
  mpName: string;
  mpPhotoUrl: string | null;
  partyName: string;
  partyColour: string;
  electorateName: string | null;
  ministerialRole: string | null;
  totalVotes: number;
  ayeRate: number | null;
  committeeCount: number;
  topDonors: string[];
}

export function MPReportCard({
  mpName, mpPhotoUrl, partyName, partyColour, electorateName,
  ministerialRole, totalVotes, ayeRate, committeeCount, topDonors,
}: MPReportCardProps) {
  return (
    <View style={s.card}>
      <CardHeader subtitle="MP REPORT CARD" />

      {/* MP identity */}
      <View style={s.mpRow}>
        {mpPhotoUrl ? (
          <Image source={{ uri: mpPhotoUrl }} style={s.mpPhotoLg} />
        ) : (
          <View style={[s.mpPhotoLgPlaceholder, { backgroundColor: partyColour + '33' }]}>
            <Text style={[s.mpInitialsLg, { color: partyColour }]}>
              {mpName.split(' ').map(n => n[0]).join('').slice(0, 2)}
            </Text>
          </View>
        )}
        <View style={s.mpInfo}>
          <Text style={s.mpNameLg}>{mpName}</Text>
          <View style={[s.partyBadge, { backgroundColor: partyColour + '22' }]}>
            <Text style={[s.partyBadgeText, { color: partyColour }]}>{partyName}</Text>
          </View>
          {electorateName ? <Text style={s.electorateText}>{electorateName}</Text> : null}
        </View>
      </View>

      {/* Role */}
      {ministerialRole ? (
        <View style={s.roleRow}>
          <Text style={s.roleText}>{ministerialRole}</Text>
        </View>
      ) : null}

      {/* Stats grid */}
      <View style={s.statsGrid}>
        <View style={s.statCell}>
          <Text style={s.statValue}>{totalVotes}</Text>
          <Text style={s.statLabel}>Bills Voted</Text>
        </View>
        <View style={[s.statCell, s.statCellBorder]}>
          <Text style={s.statValue}>{ayeRate !== null ? `${ayeRate}%` : '—'}</Text>
          <Text style={s.statLabel}>Aye Rate</Text>
        </View>
        <View style={[s.statCell, s.statCellBorder]}>
          <Text style={s.statValue}>{committeeCount}</Text>
          <Text style={s.statLabel}>Committees</Text>
        </View>
      </View>

      {/* Top donors */}
      {topDonors.length > 0 ? (
        <View style={s.donorsBox}>
          <Text style={s.donorsLabel}>TOP DONORS</Text>
          {topDonors.slice(0, 3).map((name, i) => (
            <Text key={i} style={s.donorName} numberOfLines={1}>· {name}</Text>
          ))}
        </View>
      ) : null}

      <CardFooter cta="How does your MP stack up? Check Verity" />
    </View>
  );
}

// ─── 4. Coverage Share Card ──────────────────────────────────────────────────

interface CoverageShareCardProps {
  headline: string;
  leftCount: number;
  centerCount: number;
  rightCount: number;
  articleCount: number;
  blindspot: string | null;
  category: string | null;
}

export function CoverageShareCard({
  headline, leftCount, centerCount, rightCount, articleCount, blindspot, category,
}: CoverageShareCardProps) {
  const total = leftCount + centerCount + rightCount || 1;
  const cat = category ?? 'politics';
  const catColour = topicAccent(cat);

  const BLUE = '#2563EB';
  const MID  = '#6B7280';
  const RED  = '#DC3545';

  return (
    <View style={s.card}>
      <CardHeader subtitle="COVERAGE ANALYSIS" />

      {/* Category */}
      <View style={[s.catChip, { backgroundColor: catColour + '18' }]}>
        <Text style={[s.catChipText, { color: catColour }]}>{cat.toUpperCase()}</Text>
      </View>

      {/* Headline */}
      <Text style={s.newsHeadline} numberOfLines={3}>{headline}</Text>

      {/* Large coverage bar */}
      <View style={s.coverageLargeSection}>
        <View style={s.coverageLargeBar}>
          {leftCount   > 0 && <View style={[s.seg, { flex: leftCount,   backgroundColor: BLUE }]} />}
          {centerCount > 0 && <View style={[s.seg, { flex: centerCount, backgroundColor: MID }]} />}
          {rightCount  > 0 && <View style={[s.seg, { flex: rightCount,  backgroundColor: RED }]} />}
        </View>
        <View style={s.coverageLargeLegend}>
          <View style={s.coverageLegendItem}>
            <View style={[s.coverageLegendDot, { backgroundColor: BLUE }]} />
            <Text style={[s.coverageLegendCount, { color: BLUE }]}>{leftCount}</Text>
            <Text style={s.coverageLegendLabel}>left</Text>
          </View>
          <View style={s.coverageLegendItem}>
            <View style={[s.coverageLegendDot, { backgroundColor: MID }]} />
            <Text style={[s.coverageLegendCount, { color: MID }]}>{centerCount}</Text>
            <Text style={s.coverageLegendLabel}>centre</Text>
          </View>
          <View style={s.coverageLegendItem}>
            <View style={[s.coverageLegendDot, { backgroundColor: RED }]} />
            <Text style={[s.coverageLegendCount, { color: RED }]}>{rightCount}</Text>
            <Text style={s.coverageLegendLabel}>right</Text>
          </View>
        </View>
      </View>

      {/* Blindspot callout */}
      {blindspot ? (
        <View style={s.blindspotBox}>
          <Text style={[s.blindspotLabel, { color: blindspot === 'left' ? BLUE : RED }]}>BLINDSPOT</Text>
          <Text style={s.blindspotDesc}>
            0 {blindspot}-leaning outlets have reported on this story
          </Text>
          <Text style={s.blindspotDesc}>
            while {blindspot === 'left' ? rightCount : leftCount} {blindspot === 'left' ? 'right' : 'left'}-leaning outlets have
          </Text>
        </View>
      ) : null}

      {/* Source attribution */}
      <Text style={[s.sourceCount, { marginTop: blindspot ? 10 : 14 }]}>
        Based on <Text style={s.sourceCountBold}>{articleCount}</Text> source{articleCount !== 1 ? 's' : ''} across the political spectrum
      </Text>

      <CardFooter cta="See full coverage on Verity" />
    </View>
  );
}

// ─── 5. Rebellion Share Card ─────────────────────────────────────────────────

interface RebellionShareCardProps {
  memberName: string;
  partyName: string;
  rebellionCount: number;
  rebellionRate: number;
  biggestRebellion: { divisionName: string; date: string; voteCast: string };
}

export function RebellionShareCard({
  memberName, partyName, rebellionCount, rebellionRate, biggestRebellion,
}: RebellionShareCardProps) {
  const formattedDate = biggestRebellion.date
    ? new Date(biggestRebellion.date).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })
    : '';
  const voteLabel = biggestRebellion.voteCast === 'aye' ? 'AYE' : biggestRebellion.voteCast === 'no' ? 'NO' : biggestRebellion.voteCast.toUpperCase();
  const voteColour = biggestRebellion.voteCast === 'aye' ? GREEN : biggestRebellion.voteCast === 'no' ? '#DC3545' : GREY;

  return (
    <View style={s.card}>
      <CardHeader subtitle="INDEPENDENCE REPORT" />

      {/* Hero stat */}
      <View style={s.rebellionHero}>
        <Text style={s.rebellionCount}>{rebellionCount}</Text>
        <Text style={s.rebellionLabel}>
          time{rebellionCount !== 1 ? 's' : ''} {memberName} voted against {partyName}
        </Text>
      </View>

      {/* Rate bar */}
      <View style={s.rebellionRateSection}>
        <Text style={s.rebellionRateText}>{rebellionRate}% independence rate</Text>
        <View style={s.rebellionBar}>
          <View style={[s.rebellionBarFill, { width: `${Math.min(rebellionRate, 100)}%` }]} />
        </View>
      </View>

      {/* Biggest break */}
      <View style={s.rebellionBreakBox}>
        <Text style={s.rebellionBreakLabel}>MOST SIGNIFICANT BREAK</Text>
        <Text style={s.rebellionBreakName} numberOfLines={3}>
          {biggestRebellion.divisionName.replace(/^Bills?\s*[—\-]\s*/i, '').trim()}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 }}>
          {formattedDate ? <Text style={s.rebellionBreakDate}>{formattedDate}</Text> : null}
          <View style={[s.rebellionVoteBadge, { backgroundColor: voteColour + '18' }]}>
            <Text style={[s.rebellionVoteBadgeText, { color: voteColour }]}>Voted {voteLabel}</Text>
          </View>
        </View>
      </View>

      <CardFooter cta="See full voting record on Verity" />
    </View>
  );
}

// ─── 6. Bill Share Card ───────────────────────────────────────────────────────

interface BillShareCardProps {
  title: string;
  status: string | null;
  summaryPlain: string | null;
  ayeVotes: number;
  noVotes: number;
}

export function BillShareCard({ title, status, summaryPlain, ayeVotes, noVotes }: BillShareCardProps) {
  const total = ayeVotes + noVotes || 1;

  return (
    <View style={s.card}>
      <CardHeader subtitle="BILL TRACKER" />

      {/* Status badge */}
      {status ? (
        <View style={s.statusBadge}>
          <Text style={s.statusBadgeText}>{status}</Text>
        </View>
      ) : null}

      {/* Title */}
      <Text style={s.billTitle} numberOfLines={4}>{title}</Text>

      {/* Summary */}
      {summaryPlain ? (
        <Text style={s.billSummary} numberOfLines={3}>{summaryPlain}</Text>
      ) : null}

      {/* Vote bar */}
      {(ayeVotes + noVotes) > 0 ? (
        <View style={s.billVoteSection}>
          <Text style={s.billVoteLabel}>HOW PARLIAMENT VOTED</Text>
          <View style={s.billVoteBar}>
            <View style={[s.seg, { flex: ayeVotes, backgroundColor: GREEN }]} />
            {noVotes > 0 && <View style={[s.seg, { flex: noVotes, backgroundColor: '#DC3545' }]} />}
          </View>
          <View style={s.billVoteLegend}>
            <Text style={[s.legendItem, { color: GREEN }]}>Aye {ayeVotes} ({Math.round(ayeVotes/total*100)}%)</Text>
            <Text style={[s.legendItem, { color: '#DC3545' }]}>No {noVotes} ({Math.round(noVotes/total*100)}%)</Text>
          </View>
        </View>
      ) : null}

      <CardFooter cta="Track this bill on Verity" />
    </View>
  );
}

// ─── 7. Hypocrisy Index Share Card ───────────────────────────────────────────

interface HypocrisyShareCardProps {
  mpName: string;
  mpPhotoUrl: string | null;
  partyName: string;
  partyColour: string;
  electorate: string;
  score: number;
  rank: number;
  totalMps: number;
  topTopic: { policy_name: string; stated_position: number; voting_position: number; speech_excerpt: string | null } | null;
}

export function HypocrisyShareCard({
  mpName, mpPhotoUrl, partyName, partyColour, electorate,
  score, rank, totalMps, topTopic,
}: HypocrisyShareCardProps) {
  const scoreColour = score > 66 ? '#DC3545' : score > 33 ? '#F59E0B' : '#00843D';

  return (
    <View style={s.card}>
      <CardHeader subtitle="HYPOCRISY INDEX" />

      {/* MP identity */}
      <View style={s.mpRow}>
        {mpPhotoUrl ? (
          <Image source={{ uri: mpPhotoUrl }} style={s.mpPhoto} />
        ) : (
          <View style={[s.mpPhotoPlaceholder, { backgroundColor: partyColour + '33' }]}>
            <Text style={[s.mpInitials, { color: partyColour }]}>
              {mpName.split(' ').map(n => n[0]).join('').slice(0, 2)}
            </Text>
          </View>
        )}
        <View style={s.mpInfo}>
          <Text style={s.mpName}>{mpName}</Text>
          <View style={[s.partyBadge, { backgroundColor: partyColour + '22' }]}>
            <Text style={[s.partyBadgeText, { color: partyColour }]}>{partyName}</Text>
          </View>
          <Text style={{ fontSize: 11, color: GREY, marginTop: 2 }}>{electorate}</Text>
        </View>
      </View>

      {/* Big score */}
      <View style={s.hypocrisyHero}>
        <Text style={[s.hypocrisyScore, { color: scoreColour }]}>{score}</Text>
        <Text style={s.hypocrisyLabel}>out of 100</Text>
        <Text style={s.hypocrisyRank}>Ranks #{rank} of {totalMps} MPs scored</Text>
      </View>

      {/* Top disconnect topic */}
      {topTopic && (
        <View style={s.hypocrisyTopicBox}>
          <Text style={s.hypocrisyTopicLabel}>BIGGEST GAP</Text>
          <Text style={s.hypocrisyTopicName} numberOfLines={2}>{topTopic.policy_name}</Text>

          {/* Position bar */}
          <View style={s.hypocrisyBar}>
            <View style={s.hypocrisyBarTrack}>
              <View style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 1, backgroundColor: '#D1D5DB' }} />
              <View style={{
                position: 'absolute',
                left: `${((topTopic.stated_position + 1) / 2) * 100}%`,
                top: -4, width: 16, height: 16, borderRadius: 8,
                backgroundColor: '#2563EB', borderWidth: 2, borderColor: '#fff', marginLeft: -8,
              }} />
              <View style={{
                position: 'absolute',
                left: `${((topTopic.voting_position + 1) / 2) * 100}%`,
                top: -4, width: 16, height: 16, borderRadius: 8,
                backgroundColor: '#DC3545', borderWidth: 2, borderColor: '#fff', marginLeft: -8,
              }} />
            </View>
            <View style={s.hypocrisyBarLegend}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#2563EB' }} />
                <Text style={{ fontSize: 10, color: GREY }}>What they said</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#DC3545' }} />
                <Text style={{ fontSize: 10, color: GREY }}>How they voted</Text>
              </View>
            </View>
          </View>

          {/* Excerpt */}
          {topTopic.speech_excerpt && (
            <Text style={s.hypocrisyExcerpt} numberOfLines={2}>
              "{topTopic.speech_excerpt}"
            </Text>
          )}
        </View>
      )}

      <CardFooter cta="Check your MP's Hypocrisy Index on Verity" />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  card: {
    width: CARD_W,
    height: CARD_H,
    backgroundColor: '#ffffff',
    borderRadius: 0,
    overflow: 'hidden',
  },

  // Header
  header: {
    backgroundColor: GREEN,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 10,
  },
  logoV: {
    fontSize: 22,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: -1,
    lineHeight: 26,
    marginTop: -1,
  },
  logoText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: 3,
    lineHeight: 18,
  },
  logoSub: {
    fontSize: 9,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.8)',
    letterSpacing: 2,
    marginTop: 1,
  },

  // Footer
  footer: {
    backgroundColor: GREEN,
    paddingHorizontal: 20,
    paddingVertical: 14,
    marginTop: 'auto',
    gap: 2,
  },
  footerCta: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.9)',
  },
  footerUrl: {
    fontSize: 14,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: 0.5,
  },

  // MP row (small)
  mpRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 4,
  },
  mpPhoto: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: '#e8ecf0',
  },
  mpPhotoPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mpInitials: { fontSize: 18, fontWeight: '800' },
  mpInfo: { flex: 1, gap: 4 },
  mpName: { fontSize: 16, fontWeight: '800', color: DARK },
  partyBadge: { alignSelf: 'flex-start', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  partyBadgeText: { fontSize: 11, fontWeight: '700' },

  // MP row (large, report card)
  mpPhotoLg: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 2,
    borderColor: '#e8ecf0',
  },
  mpPhotoLgPlaceholder: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mpInitialsLg: { fontSize: 22, fontWeight: '800' },
  mpNameLg: { fontSize: 18, fontWeight: '800', color: DARK },
  electorateText: { fontSize: 12, color: GREY, marginTop: 2 },

  // Division box (vote card)
  divisionBox: {
    marginHorizontal: 20,
    marginTop: 16,
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 16,
    gap: 6,
    minHeight: 80,
  },
  divisionLabel: { fontSize: 9, fontWeight: '700', color: GREY, letterSpacing: 1.5 },
  divisionName: { fontSize: 15, fontWeight: '700', color: DARK, lineHeight: 22 },

  // Vote badge
  voteBadge: {
    alignSelf: 'center',
    borderRadius: 16,
    paddingHorizontal: 32,
    paddingVertical: 16,
    marginTop: 16,
  },
  voteBadgeText: { fontSize: 36, fontWeight: '900', letterSpacing: 4 },
  voteDate: { textAlign: 'center', color: GREY, fontSize: 12, marginTop: 10 },

  // News card
  catChip: {
    alignSelf: 'flex-start',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginHorizontal: 20,
    marginTop: 20,
  },
  catChipText: { fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  newsHeadline: {
    fontSize: 20,
    fontWeight: '800',
    color: DARK,
    lineHeight: 28,
    marginHorizontal: 20,
    marginTop: 12,
  },
  sourceCount: { fontSize: 13, color: GREY, marginHorizontal: 20, marginTop: 10 },
  sourceCountBold: { fontWeight: '700', color: DARK },
  coverageSection: { marginHorizontal: 20, marginTop: 12, gap: 8 },
  coverageBar: { height: 8, borderRadius: 4, overflow: 'hidden', flexDirection: 'row' },
  seg: { height: '100%' },
  coverageLegend: { flexDirection: 'row', gap: 12 },
  legendItem: { fontSize: 11, fontWeight: '600' },

  // Report card
  roleRow: {
    marginHorizontal: 20,
    marginTop: 8,
    backgroundColor: '#F0FBF4',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  roleText: { fontSize: 12, fontWeight: '600', color: GREEN },
  statsGrid: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginTop: 16,
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    overflow: 'hidden',
  },
  statCell: { flex: 1, alignItems: 'center', paddingVertical: 14, gap: 4 },
  statCellBorder: { borderLeftWidth: 1, borderLeftColor: '#E8ECF0' },
  statValue: { fontSize: 20, fontWeight: '900', color: DARK },
  statLabel: { fontSize: 10, color: GREY, fontWeight: '600', letterSpacing: 0.5 },
  donorsBox: { marginHorizontal: 20, marginTop: 14, gap: 4 },
  donorsLabel: { fontSize: 9, fontWeight: '700', color: GREY, letterSpacing: 1.5, marginBottom: 2 },
  donorName: { fontSize: 13, color: DARK, fontWeight: '600' },

  // Bill card
  statusBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#E8F5EE',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginHorizontal: 20,
    marginTop: 20,
  },
  statusBadgeText: { fontSize: 11, fontWeight: '700', color: GREEN },
  billTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: DARK,
    lineHeight: 26,
    marginHorizontal: 20,
    marginTop: 12,
  },
  billSummary: {
    fontSize: 13,
    color: '#5a6a7a',
    lineHeight: 20,
    marginHorizontal: 20,
    marginTop: 10,
  },
  billVoteSection: { marginHorizontal: 20, marginTop: 16, gap: 8 },
  billVoteLabel: { fontSize: 9, fontWeight: '700', color: GREY, letterSpacing: 1.5 },
  billVoteBar: { height: 10, borderRadius: 5, overflow: 'hidden', flexDirection: 'row' },
  billVoteLegend: { flexDirection: 'row', gap: 16 },

  // Coverage card
  coverageLargeSection: { marginHorizontal: 20, marginTop: 16, gap: 10 },
  coverageLargeBar: { height: 16, borderRadius: 8, overflow: 'hidden', flexDirection: 'row' },
  coverageLargeLegend: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 4 },
  coverageLegendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  coverageLegendDot: { width: 8, height: 8, borderRadius: 4 },
  coverageLegendCount: { fontSize: 16, fontWeight: '800' },
  coverageLegendLabel: { fontSize: 12, color: GREY, fontWeight: '600' },
  blindspotBox: {
    marginHorizontal: 20,
    marginTop: 14,
    backgroundColor: '#FFF8F0',
    borderRadius: 10,
    padding: 14,
    gap: 4,
  },
  blindspotLabel: { fontSize: 11, fontWeight: '900', letterSpacing: 1.5 },
  blindspotDesc: { fontSize: 13, color: '#5a6a7a', lineHeight: 20 },

  // Rebellion card
  rebellionHero: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 8,
    alignItems: 'center',
  },
  rebellionCount: {
    fontSize: 64,
    fontWeight: '900',
    color: '#b45309',
    lineHeight: 72,
  },
  rebellionLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: DARK,
    textAlign: 'center',
    lineHeight: 22,
    marginTop: 4,
  },
  rebellionRateSection: {
    marginHorizontal: 20,
    marginTop: 16,
    gap: 6,
  },
  rebellionRateText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#92400E',
    textAlign: 'center',
  },
  rebellionBar: {
    height: 8,
    backgroundColor: '#FEF3C7',
    borderRadius: 4,
    overflow: 'hidden',
  },
  rebellionBarFill: {
    height: 8,
    backgroundColor: '#b45309',
    borderRadius: 4,
  },
  rebellionBreakBox: {
    marginHorizontal: 20,
    marginTop: 20,
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    padding: 16,
    gap: 4,
  },
  rebellionBreakLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#92400E',
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  rebellionBreakName: {
    fontSize: 15,
    fontWeight: '700',
    color: DARK,
    lineHeight: 22,
  },
  rebellionBreakDate: {
    fontSize: 12,
    color: '#92400E',
  },
  rebellionVoteBadge: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  rebellionVoteBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },

  // Hypocrisy card
  hypocrisyHero: {
    alignItems: 'center',
    paddingTop: 16,
    paddingBottom: 8,
  },
  hypocrisyScore: {
    fontSize: 72,
    fontWeight: '900',
    lineHeight: 80,
  },
  hypocrisyLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: GREY,
    marginTop: -4,
  },
  hypocrisyRank: {
    fontSize: 12,
    color: GREY,
    marginTop: 4,
  },
  hypocrisyTopicBox: {
    marginHorizontal: 20,
    marginTop: 8,
    backgroundColor: '#FFF8E7',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#F3E8D0',
  },
  hypocrisyTopicLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#92400E',
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  hypocrisyTopicName: {
    fontSize: 15,
    fontWeight: '700',
    color: DARK,
    lineHeight: 22,
    marginBottom: 8,
  },
  hypocrisyBar: {
    gap: 6,
  },
  hypocrisyBarTrack: {
    height: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: 4,
    position: 'relative' as const,
  },
  hypocrisyBarLegend: {
    flexDirection: 'row' as const,
    gap: 16,
  },
  hypocrisyExcerpt: {
    fontSize: 12,
    fontStyle: 'italic' as const,
    color: '#5a6a7a',
    lineHeight: 18,
    marginTop: 8,
  },

  // Mirror (prediction) card
  mirrorHero: {
    alignItems: 'center' as const,
    paddingTop: 20,
    paddingBottom: 8,
    gap: 4,
  },
  mirrorEmoji: { fontSize: 48, lineHeight: 56 },
  mirrorResult: { fontSize: 20, fontWeight: '800' as const, color: DARK, marginTop: 4 },
  mirrorCompare: {
    flexDirection: 'row' as const,
    justifyContent: 'space-around' as const,
    marginHorizontal: 20,
    marginTop: 16,
    paddingVertical: 14,
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
  },
  mirrorCompareCol: { alignItems: 'center' as const, gap: 4 },
  mirrorCompareLabel: { fontSize: 9, fontWeight: '700' as const, color: GREY, letterSpacing: 1 },
  mirrorCompareValue: { fontSize: 22, fontWeight: '900' as const },
  mirrorArrow: { alignSelf: 'center' as const },

  // Representation Index card
  repIdxHero: {
    alignItems: 'center' as const,
    paddingTop: 20,
    paddingBottom: 8,
  },
  repIdxScore: { fontSize: 56, fontWeight: '900' as const, lineHeight: 64 },
  repIdxLabel: { fontSize: 14, fontWeight: '600' as const, color: GREY, marginTop: 2 },
  repIdxRank: { fontSize: 12, color: GREY, marginTop: 4 },
  repIdxIssues: {
    marginHorizontal: 20,
    marginTop: 12,
    gap: 6,
  },
  repIdxIssueRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingVertical: 4,
  },
  repIdxIssueName: { fontSize: 13, fontWeight: '600' as const, color: DARK, flex: 1 },
  repIdxIssueBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  repIdxCoverage: {
    fontSize: 11,
    color: GREY,
    textAlign: 'center' as const,
    marginHorizontal: 20,
    marginTop: 12,
  },
});

// ─── 10. Match Flex Share Card ────────────────────────────────────────────────

interface MatchFlexShareCardProps {
  matchPct: number;
  mpName: string;
  mpPhotoUrl: string | null;
  partyName: string;
  partyColour: string;
  electorate: string;
  topAligned: string[];
  topGaps: string[];
}

export function MatchFlexShareCard({
  matchPct, mpName, mpPhotoUrl, partyName, partyColour, electorate,
  topAligned, topGaps,
}: MatchFlexShareCardProps) {
  const scoreColour = matchPct >= 70 ? GREEN : matchPct >= 40 ? '#EAB308' : '#DC3545';

  return (
    <View style={s.card}>
      <CardHeader subtitle="VERITY MATCH" />

      {/* MP identity */}
      <View style={s.mpRow}>
        {mpPhotoUrl ? (
          <Image source={{ uri: mpPhotoUrl }} style={s.mpPhoto} />
        ) : (
          <View style={[s.mpPhotoPlaceholder, { backgroundColor: partyColour + '33' }]}>
            <Text style={[s.mpInitials, { color: partyColour }]}>
              {mpName.split(' ').map(n => n[0]).join('').slice(0, 2)}
            </Text>
          </View>
        )}
        <View style={s.mpInfo}>
          <Text style={s.mpName}>{mpName}</Text>
          <View style={[s.partyBadge, { backgroundColor: partyColour + '22' }]}>
            <Text style={[s.partyBadgeText, { color: partyColour }]}>{partyName}</Text>
          </View>
          <Text style={{ fontSize: 11, color: GREY, marginTop: 2 }}>{electorate}</Text>
        </View>
      </View>

      {/* Big score */}
      <View style={{ alignItems: 'center', paddingTop: 20, paddingBottom: 8 }}>
        <Text style={{ fontSize: 72, fontWeight: '900', color: scoreColour, lineHeight: 80 }}>{matchPct}%</Text>
        <Text style={{ fontSize: 14, fontWeight: '600', color: GREY }}>aligned on what matters to me</Text>
      </View>

      {/* Aligned + gap chips */}
      <View style={{ paddingHorizontal: 20, gap: 8, marginTop: 8 }}>
        {topAligned.length > 0 && (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {topAligned.slice(0, 3).map(issue => (
              <View key={issue} style={{ backgroundColor: GREEN + '15', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 }}>
                <Text style={{ fontSize: 11, fontWeight: '700', color: GREEN }}>{issue}</Text>
              </View>
            ))}
          </View>
        )}
        {topGaps.length > 0 && (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {topGaps.slice(0, 2).map(issue => (
              <View key={issue} style={{ backgroundColor: '#DC354515', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 }}>
                <Text style={{ fontSize: 11, fontWeight: '700', color: '#DC3545' }}>Gap: {issue}</Text>
              </View>
            ))}
          </View>
        )}
      </View>

      <CardFooter cta="Find your match on Verity" />
    </View>
  );
}

// ─── 11. The Receipt Share Card ──────────────────────────────────────────────

interface ReceiptShareCardProps {
  mpName: string;
  mpPhotoUrl: string | null;
  partyName: string;
  partyColour: string;
  billTitle: string;
  voteCast: string;
  date: string;
  issueTag: string | null;
}

export function ReceiptShareCard({
  mpName, mpPhotoUrl, partyName, partyColour, billTitle, voteCast, date, issueTag,
}: ReceiptShareCardProps) {
  const isFor = voteCast === 'aye';
  const voteLabel = isFor ? 'FOR' : 'AGAINST';
  const voteColour = isFor ? GREEN : '#DC3545';
  const voteBg = isFor ? '#E8F5EE' : '#FDECEA';
  const formattedDate = date
    ? new Date(date).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })
    : '';

  return (
    <View style={s.card}>
      <CardHeader subtitle="THE RECEIPT" />

      {/* MP identity */}
      <View style={s.mpRow}>
        {mpPhotoUrl ? (
          <Image source={{ uri: mpPhotoUrl }} style={s.mpPhoto} />
        ) : (
          <View style={[s.mpPhotoPlaceholder, { backgroundColor: partyColour + '33' }]}>
            <Text style={[s.mpInitials, { color: partyColour }]}>
              {mpName.split(' ').map(n => n[0]).join('').slice(0, 2)}
            </Text>
          </View>
        )}
        <View style={s.mpInfo}>
          <Text style={s.mpName}>{mpName}</Text>
          <View style={[s.partyBadge, { backgroundColor: partyColour + '22' }]}>
            <Text style={[s.partyBadgeText, { color: partyColour }]}>{partyName}</Text>
          </View>
        </View>
      </View>

      {/* "Your MP voted..." */}
      <View style={{ paddingHorizontal: 20, paddingTop: 16 }}>
        <Text style={{ fontSize: 13, fontWeight: '600', color: GREY, letterSpacing: 0.5 }}>YOUR MP VOTED</Text>
      </View>

      {/* Vote badge */}
      <View style={[s.voteBadge, { backgroundColor: voteBg }]}>
        <Text style={[s.voteBadgeText, { color: voteColour }]}>{voteLabel}</Text>
      </View>

      {/* Bill title */}
      <View style={[s.divisionBox, { marginTop: 12 }]}>
        {issueTag && (
          <View style={{ alignSelf: 'flex-start', backgroundColor: GREEN + '15', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2, marginBottom: 6 }}>
            <Text style={{ fontSize: 9, fontWeight: '700', color: GREEN, letterSpacing: 1 }}>{issueTag.toUpperCase()}</Text>
          </View>
        )}
        <Text style={s.divisionName} numberOfLines={3}>{billTitle}</Text>
      </View>

      {/* Date */}
      {formattedDate ? <Text style={s.voteDate}>{formattedDate}</Text> : null}

      <CardFooter cta="Every vote recorded. Every MP accountable." />
    </View>
  );
}

// ─── 12. Representation Gap Share Card ───────────────────────────────────────

interface RepGapShareCardProps {
  electorate: string;
  issueName: string;
  electorateStance: string;
  mpName: string;
  mpVoteDirection: string;
  gapPct: number;
  sampleSize: number;
}

export function RepGapShareCard({
  electorate, issueName, electorateStance, mpName, mpVoteDirection, gapPct, sampleSize,
}: RepGapShareCardProps) {
  return (
    <View style={s.card}>
      <CardHeader subtitle="REPRESENTATION GAP" />

      {/* Electorate name */}
      <View style={{ paddingHorizontal: 20, paddingTop: 24 }}>
        <Text style={{ fontSize: 12, fontWeight: '700', color: GREEN, letterSpacing: 2 }}>{electorate.toUpperCase()}</Text>
      </View>

      {/* Gap stat */}
      <View style={{ alignItems: 'center', paddingTop: 16, paddingBottom: 12 }}>
        <Text style={{ fontSize: 64, fontWeight: '900', color: '#DC3545', lineHeight: 72 }}>{gapPct}%</Text>
        <Text style={{ fontSize: 15, fontWeight: '600', color: DARK, textAlign: 'center', lineHeight: 22, paddingHorizontal: 20 }}>
          of {electorate} wanted {electorateStance.toLowerCase()}
        </Text>
      </View>

      {/* "But their MP..." */}
      <View style={{
        marginHorizontal: 20, backgroundColor: '#FDECEA', borderRadius: 12,
        padding: 16, borderLeftWidth: 4, borderLeftColor: '#DC3545',
      }}>
        <Text style={{ fontSize: 13, fontWeight: '700', color: '#DC3545', letterSpacing: 1, marginBottom: 6 }}>
          BUT THEIR MP
        </Text>
        <Text style={{ fontSize: 16, fontWeight: '800', color: DARK, lineHeight: 24 }}>
          {mpName} voted {mpVoteDirection.toLowerCase()}
        </Text>
        <Text style={{ fontSize: 15, fontWeight: '700', color: DARK, marginTop: 4 }}>
          on {issueName}
        </Text>
      </View>

      {/* Sample size */}
      <Text style={{ fontSize: 11, color: GREY, textAlign: 'center', marginTop: 12, paddingHorizontal: 20 }}>
        Based on {sampleSize}+ local respondents
      </Text>

      <CardFooter cta="Is your MP representing you? Check on Verity" />
    </View>
  );
}

// ─── 8. Mirror (Prediction) Share Card ────────────────────────────────────────

interface MirrorShareCardProps {
  mpName: string;
  mpPhotoUrl: string | null;
  partyName: string;
  partyColour: string;
  divisionName: string;
  userGuess: string;
  actualVote: string;
}

export function MirrorShareCard({
  mpName, mpPhotoUrl, partyName, partyColour, divisionName,
  userGuess, actualVote,
}: MirrorShareCardProps) {
  const wasCorrect = userGuess === actualVote;
  const guessLabel = userGuess === 'aye' ? 'FOR' : userGuess === 'no' ? 'AGAINST' : 'ABSENT';
  const actualLabel = actualVote === 'aye' ? 'FOR' : actualVote === 'no' ? 'AGAINST' : 'ABSENT';
  const guessColour = userGuess === 'aye' ? GREEN : userGuess === 'no' ? '#DC3545' : GREY;
  const actualColour = actualVote === 'aye' ? GREEN : actualVote === 'no' ? '#DC3545' : GREY;

  return (
    <View style={s.card}>
      <CardHeader subtitle="THE MIRROR" />

      <View style={s.mpRow}>
        {mpPhotoUrl ? (
          <Image source={{ uri: mpPhotoUrl }} style={s.mpPhoto} />
        ) : (
          <View style={[s.mpPhotoPlaceholder, { backgroundColor: partyColour + '33' }]}>
            <Text style={[s.mpInitials, { color: partyColour }]}>
              {mpName.split(' ').map(n => n[0]).join('').slice(0, 2)}
            </Text>
          </View>
        )}
        <View style={s.mpInfo}>
          <Text style={s.mpName}>{mpName}</Text>
          <View style={[s.partyBadge, { backgroundColor: partyColour + '22' }]}>
            <Text style={[s.partyBadgeText, { color: partyColour }]}>{partyName}</Text>
          </View>
        </View>
      </View>

      <View style={s.divisionBox}>
        <Text style={s.divisionLabel}>VOTED ON</Text>
        <Text style={s.divisionName} numberOfLines={3}>{divisionName}</Text>
      </View>

      <View style={s.mirrorHero}>
        <Text style={s.mirrorEmoji}>{wasCorrect ? '\u2705' : '\u{1F62E}'}</Text>
        <Text style={s.mirrorResult}>
          {wasCorrect ? 'I knew it!' : 'I was wrong about my MP'}
        </Text>
      </View>

      <View style={s.mirrorCompare}>
        <View style={s.mirrorCompareCol}>
          <Text style={s.mirrorCompareLabel}>I GUESSED</Text>
          <Text style={[s.mirrorCompareValue, { color: guessColour }]}>{guessLabel}</Text>
        </View>
        <Text style={[s.mirrorArrow, { color: GREY, fontSize: 18 }]}>{'\u2192'}</Text>
        <View style={s.mirrorCompareCol}>
          <Text style={s.mirrorCompareLabel}>THEY VOTED</Text>
          <Text style={[s.mirrorCompareValue, { color: actualColour }]}>{actualLabel}</Text>
        </View>
      </View>

      <CardFooter cta="How well do you know your MP? Find out on Verity" />
    </View>
  );
}

// ─── 9. Representation Index Share Card ──────────────────────────────────────

interface RepIndexShareCardProps {
  mpName: string;
  mpPhotoUrl: string | null;
  partyName: string;
  partyColour: string;
  electorate: string;
  score: number;
  rank: number;
  totalRanked: number;
  issues: { name: string; aligned: boolean }[];
  sampleSize: number;
}

export function RepIndexShareCard({
  mpName, mpPhotoUrl, partyName, partyColour, electorate,
  score, rank, totalRanked, issues, sampleSize,
}: RepIndexShareCardProps) {
  const scoreColour = score >= 70 ? GREEN : score >= 40 ? '#EAB308' : '#DC3545';

  return (
    <View style={s.card}>
      <CardHeader subtitle="REPRESENTATION INDEX" />

      <View style={s.mpRow}>
        {mpPhotoUrl ? (
          <Image source={{ uri: mpPhotoUrl }} style={s.mpPhoto} />
        ) : (
          <View style={[s.mpPhotoPlaceholder, { backgroundColor: partyColour + '33' }]}>
            <Text style={[s.mpInitials, { color: partyColour }]}>
              {mpName.split(' ').map(n => n[0]).join('').slice(0, 2)}
            </Text>
          </View>
        )}
        <View style={s.mpInfo}>
          <Text style={s.mpName}>{mpName}</Text>
          <View style={[s.partyBadge, { backgroundColor: partyColour + '22' }]}>
            <Text style={[s.partyBadgeText, { color: partyColour }]}>{partyName}</Text>
          </View>
          <Text style={{ fontSize: 11, color: GREY, marginTop: 2 }}>{electorate}</Text>
        </View>
      </View>

      <View style={s.repIdxHero}>
        <Text style={[s.repIdxScore, { color: scoreColour }]}>{score}%</Text>
        <Text style={s.repIdxLabel}>votes with {electorate}</Text>
        <Text style={s.repIdxRank}>#{rank} of {totalRanked} MPs scored</Text>
      </View>

      <View style={s.repIdxIssues}>
        {issues.slice(0, 6).map((issue, i) => (
          <View key={i} style={s.repIdxIssueRow}>
            <Text style={s.repIdxIssueName}>{issue.name}</Text>
            <View style={[s.repIdxIssueBadge, {
              backgroundColor: issue.aligned ? GREEN + '15' : '#DC3545' + '15',
            }]}>
              <Text style={{ fontSize: 12, color: issue.aligned ? GREEN : '#DC3545' }}>
                {issue.aligned ? '\u2713' : '\u2717'}
              </Text>
            </View>
          </View>
        ))}
      </View>

      <Text style={s.repIdxCoverage}>
        Based on {sampleSize}+ local respondents across {issues.length} issues
      </Text>

      <CardFooter cta="Does your MP represent you? Check on Verity" />
    </View>
  );
}
