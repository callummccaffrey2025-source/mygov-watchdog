import React, { useMemo } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useUser } from '../context/UserContext';
import { useTheme } from '../context/ThemeContext';
import { useElectorateByPostcode } from '../hooks/useElectorateByPostcode';
import { useVotes } from '../hooks/useVotes';
import { useHansard } from '../hooks/useHansard';
import { useIndividualDonations } from '../hooks/useIndividualDonations';
import { PartyBadge } from '../components/PartyBadge';
import { SkeletonLoader } from '../components/SkeletonLoader';
import { timeAgo } from '../lib/timeAgo';
import { decodeHtml } from '../utils/decodeHtml';

// ── Topic keywords for vote categorisation ──────────────────────────────────

const TOPIC_KEYWORDS: Record<string, string[]> = {
  'Economy': ['budget', 'tax', 'treasury', 'economic', 'inflation', 'financial', 'revenue', 'appropriation'],
  'Health': ['health', 'medical', 'hospital', 'medicare', 'pharmaceutical', 'aged care'],
  'Defence': ['defence', 'defense', 'military', 'veteran', 'security', 'aukus'],
  'Education': ['education', 'university', 'school', 'student', 'tafe', 'training'],
  'Climate': ['climate', 'energy', 'emissions', 'renewable', 'environment', 'carbon'],
  'Housing': ['housing', 'home', 'rent', 'property', 'build-to-rent'],
  'Immigration': ['immigration', 'migration', 'visa', 'refugee', 'asylum', 'citizenship'],
  'Technology': ['technology', 'digital', 'cyber', 'data', 'telecom', 'broadband'],
};

function cleanDivisionName(raw: string): string {
  return raw
    .replace(/^[A-Za-z\s]+\s*[—–]\s*/i, '')
    .replace(/\s*[-;]\s*(first|second|third|fourth|consideration|agree|pass|against|final|bill as passed).*$/i, '')
    .trim();
}

// ── Main Screen ─────────────────────────────────────────────────────────────

export function YourMPScreen({ navigation }: any) {
  const { colors } = useTheme();
  const { postcode } = useUser();
  const { electorate, member: myMP, loading: mpLoading } = useElectorateByPostcode(postcode);
  const { votes, loading: votesLoading } = useVotes(myMP?.id ?? null);
  const { entries: hansardEntries, loading: hansardLoading } = useHansard(myMP?.id);
  const { donations, loading: donationsLoading } = useIndividualDonations(myMP?.id);

  const totalVotes = votes.length;
  const ayeCount = votes.filter(v => v.vote_cast === 'aye').length;
  const ayeRate = totalVotes > 0 ? Math.round((ayeCount / totalVotes) * 100) : 0;

  // ── Topic breakdown ────────────────────────────────────────────────────

  const topicBreakdown = useMemo(() => {
    if (!votes.length) return [];
    const results: { topic: string; aye: number; no: number; total: number }[] = [];
    for (const [topic, keywords] of Object.entries(TOPIC_KEYWORDS)) {
      let aye = 0;
      let no = 0;
      for (const v of votes) {
        const name = (v.division?.name || '').toLowerCase();
        if (keywords.some(kw => name.includes(kw))) {
          if (v.vote_cast === 'aye') aye++;
          else if (v.vote_cast === 'no') no++;
        }
      }
      if (aye + no > 0) results.push({ topic, aye, no, total: aye + no });
    }
    return results.sort((a, b) => b.total - a.total);
  }, [votes]);

  // ── Recent activity (votes + speeches merged, sorted by date) ──────────

  const recentActivity = useMemo(() => {
    const items: { type: 'vote' | 'speech'; title: string; date: string }[] = [];
    for (const v of votes.slice(0, 20)) {
      if (v.division?.name && v.division?.date) {
        items.push({
          type: 'vote',
          title: `Voted ${v.vote_cast === 'aye' ? 'YES' : 'NO'} on ${cleanDivisionName(v.division.name)}`,
          date: v.division.date,
        });
      }
    }
    for (const h of hansardEntries.slice(0, 10)) {
      items.push({
        type: 'speech',
        title: h.debate_topic ? decodeHtml(h.debate_topic) : 'Parliamentary speech',
        date: h.date,
      });
    }
    return items.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
  }, [votes, hansardEntries]);

  // ── Top donors ─────────────────────────────────────────────────────────

  const topDonors = useMemo(() => {
    const grouped = new Map<string, number>();
    for (const d of donations) {
      grouped.set(d.donor_name, (grouped.get(d.donor_name) ?? 0) + Number(d.amount));
    }
    return Array.from(grouped.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
  }, [donations]);

  // ── No postcode state ──────────────────────────────────────────────────

  if (!postcode) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
          <Ionicons name="person-outline" size={56} color={colors.textMuted} />
          <Text style={{ fontSize: 20, fontWeight: '700', color: colors.text, marginTop: 16, textAlign: 'center' }}>
            Set your postcode to see your MP
          </Text>
          <Text style={{ fontSize: 15, color: colors.textBody, marginTop: 8, textAlign: 'center', lineHeight: 22 }}>
            Go to your Profile and enter your postcode to track your representative's voting record.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── Loading state ──────────────────────────────────────────────────────

  if (mpLoading || !myMP) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
        <ScrollView contentContainerStyle={{ padding: 20 }}>
          <SkeletonLoader width="60%" height={16} borderRadius={6} style={{ marginBottom: 12 }} />
          <SkeletonLoader width="100%" height={90} borderRadius={14} style={{ marginBottom: 24 }} />
          <SkeletonLoader width="50%" height={20} borderRadius={6} style={{ marginBottom: 16 }} />
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <SkeletonLoader width={0} height={90} borderRadius={14} style={{ flex: 1 }} />
            <SkeletonLoader width={0} height={90} borderRadius={14} style={{ flex: 1 }} />
            <SkeletonLoader width={0} height={90} borderRadius={14} style={{ flex: 1 }} />
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  const partyColour = myMP.party?.colour || '#9aabb8';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false}>

        {/* ── Header ──────────────────────────────────────────── */}
        <View style={{ paddingHorizontal: 20, paddingTop: 16 }}>
          <Text style={{ fontSize: 14, fontWeight: '500', color: '#6B7280', marginBottom: 12 }}>
            Your Electorate: {electorate?.name ?? 'Unknown'}
          </Text>

          {/* MP Card */}
          <Pressable
            style={{ backgroundColor: colors.card, borderRadius: 14, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 }}
            onPress={() => navigation.navigate('MemberProfile', { member: myMP })}
          >
            {myMP.photo_url ? (
              <Image source={{ uri: myMP.photo_url }} style={{ width: 56, height: 56, borderRadius: 28 }} />
            ) : (
              <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: partyColour + '22', justifyContent: 'center', alignItems: 'center' }}>
                <Text style={{ fontSize: 20, fontWeight: '700', color: partyColour }}>{myMP.first_name[0]}{myMP.last_name[0]}</Text>
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 17, fontWeight: '700', color: colors.text }}>{myMP.first_name} {myMP.last_name}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                {myMP.party && <PartyBadge name={myMP.party.short_name || myMP.party.name} colour={myMP.party.colour} size="sm" />}
                {myMP.electorate && <Text style={{ fontSize: 13, color: '#6B7280' }}>{myMP.electorate.name}</Text>}
              </View>
              {myMP.ministerial_role && (
                <Text style={{ fontSize: 13, color: partyColour, fontStyle: 'italic', marginTop: 4 }} numberOfLines={1}>{myMP.ministerial_role}</Text>
              )}
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </Pressable>
        </View>

        {/* ── Accountability Snapshot ─────────────────────────── */}
        <View style={{ paddingHorizontal: 20, marginTop: 24 }}>
          <Text style={{ fontSize: 20, fontWeight: '700', color: '#1A1A1A', marginBottom: 16 }}>Accountability Snapshot</Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1, backgroundColor: '#F9FAFB', borderRadius: 14, padding: 16, alignItems: 'center' }}>
              <Text style={{ fontSize: 28, fontWeight: '800', color: '#00843D' }}>{totalVotes}</Text>
              <Text style={{ fontSize: 12, fontWeight: '500', color: '#6B7280', marginTop: 4 }}>Bills Voted</Text>
            </View>
            <View style={{ flex: 1, backgroundColor: '#F9FAFB', borderRadius: 14, padding: 16, alignItems: 'center' }}>
              <Text style={{ fontSize: 28, fontWeight: '800', color: '#00843D' }}>{ayeRate}%</Text>
              <Text style={{ fontSize: 12, fontWeight: '500', color: '#6B7280', marginTop: 4 }}>Aye Rate</Text>
            </View>
            <View style={{ flex: 1, backgroundColor: '#F9FAFB', borderRadius: 14, padding: 16, alignItems: 'center' }}>
              <Text style={{ fontSize: 28, fontWeight: '800', color: '#00843D' }}>{hansardEntries.length}</Text>
              <Text style={{ fontSize: 12, fontWeight: '500', color: '#6B7280', marginTop: 4 }}>Speeches</Text>
            </View>
          </View>
        </View>

        {/* ── How They Vote by Topic ─────────────────────────── */}
        {topicBreakdown.length > 0 && (
          <View style={{ paddingHorizontal: 20, marginTop: 28 }}>
            <Text style={{ fontSize: 18, fontWeight: '700', color: '#1A1A1A', marginBottom: 16 }}>How They Vote by Topic</Text>
            {topicBreakdown.map(t => {
              const ayePct = t.total > 0 ? t.aye / t.total : 0;
              return (
                <View key={t.topic} style={{ marginBottom: 16 }}>
                  <Text style={{ fontSize: 15, fontWeight: '600', color: '#1A1A1A' }}>{t.topic}</Text>
                  <Text style={{ fontSize: 13, color: '#6B7280', marginTop: 2 }}>{t.aye} aye · {t.no} no · {t.total} votes</Text>
                  <View style={{ flexDirection: 'row', height: 8, borderRadius: 4, overflow: 'hidden', marginTop: 6, backgroundColor: '#E5E7EB' }}>
                    <View style={{ flex: ayePct, backgroundColor: '#00843D', borderRadius: 4 }} />
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* ── Recent Activity ────────────────────────────────── */}
        {recentActivity.length > 0 && (
          <View style={{ paddingHorizontal: 20, marginTop: 28 }}>
            <Text style={{ fontSize: 18, fontWeight: '700', color: '#1A1A1A', marginBottom: 16 }}>Recent Activity</Text>
            {recentActivity.map((item, i) => {
              const badgeStyle = item.type === 'vote'
                ? { backgroundColor: '#EEF2FF', color: '#4338CA' }
                : { backgroundColor: '#FEF3C7', color: '#92400E' };
              return (
                <View key={i} style={{ paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' }}>
                  <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, backgroundColor: badgeStyle.backgroundColor, alignSelf: 'flex-start' }}>
                    <Text style={{ fontSize: 11, fontWeight: '600', color: badgeStyle.color }}>{item.type === 'vote' ? 'VOTE' : 'SPEECH'}</Text>
                  </View>
                  <Text style={{ fontSize: 15, fontWeight: '500', color: '#1A1A1A', marginTop: 6 }} numberOfLines={2}>{item.title}</Text>
                  <Text style={{ fontSize: 13, color: '#9CA3AF', marginTop: 2 }}>{timeAgo(item.date)}</Text>
                </View>
              );
            })}
          </View>
        )}

        {/* ── Top Donors ─────────────────────────────────────── */}
        {topDonors.length > 0 && (
          <View style={{ paddingHorizontal: 20, marginTop: 28, marginBottom: 40 }}>
            <Text style={{ fontSize: 18, fontWeight: '700', color: '#1A1A1A', marginBottom: 16 }}>Top Donors</Text>
            {topDonors.map(([name, amount], i) => (
              <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' }}>
                <Text style={{ fontSize: 15, fontWeight: '500', color: '#1A1A1A', flex: 1 }} numberOfLines={1}>{name}</Text>
                <Text style={{ fontSize: 15, fontWeight: '700', color: '#1A1A1A' }}>${amount.toLocaleString('en-AU')}</Text>
              </View>
            ))}
            <Text style={{ fontSize: 12, color: '#9CA3AF', marginTop: 8, textAlign: 'center' }}>Source: AEC annual returns</Text>
          </View>
        )}

        {topDonors.length === 0 && !donationsLoading && (
          <View style={{ paddingHorizontal: 20, marginTop: 28, marginBottom: 40 }}>
            <Text style={{ fontSize: 18, fontWeight: '700', color: '#1A1A1A', marginBottom: 8 }}>Donations</Text>
            <Text style={{ fontSize: 14, color: '#6B7280' }}>No individual donation records found for this MP. Most donations are made to parties directly.</Text>
          </View>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}
