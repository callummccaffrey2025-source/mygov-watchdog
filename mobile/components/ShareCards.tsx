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

// ─── 4. Bill Share Card ───────────────────────────────────────────────────────

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
});
