import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, TextInput, Share } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useMembers, Member } from '../hooks/useMembers';
import { useVotes } from '../hooks/useVotes';
import { useHansard } from '../hooks/useHansard';
import { useCommittees } from '../hooks/useCommittees';
import { useIndividualDonations } from '../hooks/useIndividualDonations';
import { useParticipationIndex } from '../hooks/useAccountabilityScore';
import { SkeletonLoader } from '../components/SkeletonLoader';
import { track } from '../lib/analytics';

// ── MP Picker ────────────────────────────────────────────────────────────────

function MPPicker({ label, selected, onSelect, colors }: {
  label: string;
  selected: Member | null;
  onSelect: (m: Member) => void;
  colors: any;
}) {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const { members } = useMembers(search.length > 1 ? { search, limit: 8 } : { limit: 0 });

  if (selected && !open) {
    return (
      <Pressable
        style={{ flex: 1, backgroundColor: colors.surface, borderRadius: 12, padding: 12, alignItems: 'center', gap: 8 }}
        onPress={() => { setOpen(true); setSearch(''); }}
      >
        {selected.photo_url ? (
          <Image source={{ uri: selected.photo_url }} style={{ width: 48, height: 48, borderRadius: 24 }} />
        ) : (
          <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: (selected.party?.colour || '#9CA3AF') + '22', justifyContent: 'center', alignItems: 'center' }}>
            <Text style={{ fontSize: 18, fontWeight: '700', color: selected.party?.colour || '#9CA3AF' }}>{selected.first_name[0]}{selected.last_name[0]}</Text>
          </View>
        )}
        <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text, textAlign: 'center' }} numberOfLines={1}>{selected.first_name} {selected.last_name}</Text>
        <Text style={{ fontSize: 11, color: '#6B7280' }}>{selected.party?.short_name || ''}</Text>
        <Text style={{ fontSize: 10, color: '#00843D', fontWeight: '600' }}>Change</Text>
      </Pressable>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface, borderRadius: 12, padding: 12 }}>
      <Text style={{ fontSize: 12, fontWeight: '600', color: '#6B7280', marginBottom: 6 }}>{label}</Text>
      <TextInput
        style={{ backgroundColor: colors.background, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 14, color: colors.text, borderWidth: 1, borderColor: colors.border }}
        value={search}
        onChangeText={setSearch}
        placeholder="Search MP..."
        placeholderTextColor="#9CA3AF"
        autoFocus={open}
      />
      {members.map(m => (
        <Pressable
          key={m.id}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border }}
          onPress={() => { onSelect(m); setOpen(false); setSearch(''); }}
        >
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: m.party?.colour || '#9CA3AF' }} />
          <Text style={{ fontSize: 14, color: colors.text, flex: 1 }} numberOfLines={1}>{m.first_name} {m.last_name}</Text>
          <Text style={{ fontSize: 11, color: '#6B7280' }}>{m.party?.short_name || ''}</Text>
        </Pressable>
      ))}
    </View>
  );
}

// ── Stat Row ─────────────────────────────────────────────────────────────────

function StatRow({ label, left, right, suffix, higherIsBetter = true }: {
  label: string; left: number; right: number; suffix?: string; higherIsBetter?: boolean;
}) {
  const leftWins = higherIsBetter ? left > right : left < right;
  const rightWins = higherIsBetter ? right > left : right < left;
  const tie = left === right;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' }}>
      <Text style={{ flex: 1, fontSize: 15, fontWeight: leftWins ? '700' : '400', color: leftWins ? '#1A1A2E' : '#6B7280', textAlign: 'center' }}>
        {left}{suffix || ''}
      </Text>
      <Text style={{ width: 100, fontSize: 12, fontWeight: '500', color: '#9CA3AF', textAlign: 'center' }}>{label}</Text>
      <Text style={{ flex: 1, fontSize: 15, fontWeight: rightWins ? '700' : '400', color: rightWins ? '#1A1A2E' : '#6B7280', textAlign: 'center' }}>
        {right}{suffix || ''}
      </Text>
    </View>
  );
}

// ── Comparison Panel ─────────────────────────────────────────────────────────

function ComparisonPanel({ left, right, navigation, colors }: {
  left: Member; right: Member; navigation: any; colors: any;
}) {
  const { votes: lVotes } = useVotes(left.id);
  const { votes: rVotes } = useVotes(right.id);
  const { entries: lSpeeches } = useHansard(left.id);
  const { entries: rSpeeches } = useHansard(right.id);
  const { current: lComm } = useCommittees(left.id);
  const { current: rComm } = useCommittees(right.id);
  const { donations: lDonations } = useIndividualDonations(left.id);
  const { donations: rDonations } = useIndividualDonations(right.id);

  const lIdx = useParticipationIndex(lVotes, lSpeeches, lComm);
  const rIdx = useParticipationIndex(rVotes, rSpeeches, rComm);

  const lLoyalty = lVotes.length > 0 ? Math.round(((lVotes.length - lVotes.filter(v => v.rebelled).length) / lVotes.length) * 100) : 0;
  const rLoyalty = rVotes.length > 0 ? Math.round(((rVotes.length - rVotes.filter(v => v.rebelled).length) / rVotes.length) * 100) : 0;

  // Top donors
  const topDonors = (donations: any[]) => {
    const agg = new Map<string, number>();
    for (const d of donations) agg.set(d.donor_name, (agg.get(d.donor_name) ?? 0) + Number(d.amount));
    return Array.from(agg.entries()).sort((a, b) => b[1] - a[1]).slice(0, 3);
  };
  const lTopDonors = topDonors(lDonations);
  const rTopDonors = topDonors(rDonations);

  const handleShare = () => {
    const lName = `${left.first_name} ${left.last_name}`;
    const rName = `${right.first_name} ${right.last_name}`;
    Share.share({
      message:
        `MP Comparison on Verity:\n\n` +
        `${lName} (${left.party?.short_name || ''})\n` +
        `  Attendance: ${lIdx.attendanceRate}% · Activity: ${lIdx.parliamentaryActivity} · Independence: ${lIdx.independenceRate}% · Committees: ${lIdx.committeeCount}\n\n` +
        `${rName} (${right.party?.short_name || ''})\n` +
        `  Attendance: ${rIdx.attendanceRate}% · Activity: ${rIdx.parliamentaryActivity} · Independence: ${rIdx.independenceRate}% · Committees: ${rIdx.committeeCount}\n\n` +
        `Each dimension is reported separately — Verity does not collapse MPs into a single score.\n` +
        `Compare any two MPs at verity.run`,
    });
  };

  const lMinister = (left as any).ministerial_role;
  const rMinister = (right as any).ministerial_role;

  return (
    <View style={{ paddingHorizontal: 20, paddingTop: 16 }}>
      {/* Low-sample / minister callouts */}
      {(lIdx.isLowSample || rIdx.isLowSample || lMinister || rMinister) && (
        <View style={{ backgroundColor: '#FEF3C7', borderRadius: 10, padding: 12, marginBottom: 16, flexDirection: 'row', gap: 8 }}>
          <Ionicons name="information-circle" size={16} color="#D97706" style={{ marginTop: 1 }} />
          <Text style={{ flex: 1, fontSize: 12, color: '#92400E', lineHeight: 17 }}>
            {lIdx.isLowSample || rIdx.isLowSample
              ? 'One or both MPs have fewer than 20 recorded votes — numbers will shift as more data accrues. '
              : ''}
            {lMinister || rMinister
              ? 'Ministers typically give fewer speeches because they run departments; attendance can also be lower due to cabinet duties.'
              : ''}
          </Text>
        </View>
      )}

      {/* Stats comparison — no composite score, each dimension separate */}
      <View style={{ backgroundColor: colors.card, borderRadius: 12, padding: 16, marginBottom: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 3, elevation: 1 }}>
        <StatRow label="Attendance" left={lIdx.attendanceRate} right={rIdx.attendanceRate} suffix="%" />
        <StatRow label="Votes Recorded" left={lIdx.totalVotes} right={rIdx.totalVotes} />
        <StatRow label="Activity" left={lIdx.parliamentaryActivity} right={rIdx.parliamentaryActivity} />
        <StatRow label="Speeches" left={lIdx.speechesCount} right={rIdx.speechesCount} />
        <StatRow label="Questions" left={lIdx.questionsCount} right={rIdx.questionsCount} />
        <StatRow label="Party Loyalty" left={lLoyalty} right={rLoyalty} suffix="%" />
        <StatRow label="Independence" left={lIdx.independenceRate} right={rIdx.independenceRate} suffix="%" />
        <StatRow label="Committees" left={lIdx.committeeCount} right={rIdx.committeeCount} />
      </View>
      <Text style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 12, fontStyle: 'italic' }}>
        Each row is a separate dimension. Verity does not collapse MPs into a single comparable score.
      </Text>

      {/* Top donors side by side */}
      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
        {[lTopDonors, rTopDonors].map((donors, side) => (
          <View key={side} style={{ flex: 1, backgroundColor: colors.surface, borderRadius: 10, padding: 12 }}>
            <Text style={{ fontSize: 10, fontWeight: '600', color: '#9CA3AF', letterSpacing: 0.5, marginBottom: 6 }}>TOP DONORS</Text>
            {donors.length === 0 ? (
              <Text style={{ fontSize: 12, color: '#9CA3AF', fontStyle: 'italic' }}>No records</Text>
            ) : (
              donors.map(([name, amount], i) => (
                <View key={i} style={{ marginBottom: 4 }}>
                  <Text style={{ fontSize: 12, color: colors.text }} numberOfLines={1}>{name}</Text>
                  <Text style={{ fontSize: 11, fontWeight: '600', color: '#6B7280' }}>${amount.toLocaleString('en-AU')}</Text>
                </View>
              ))
            )}
          </View>
        ))}
      </View>

      {/* Summary — no declared winner by design */}
      <View style={{ backgroundColor: '#F8F9FA', borderRadius: 12, padding: 14, marginBottom: 16 }}>
        <Text style={{ fontSize: 13, color: '#374151', lineHeight: 19 }}>
          These are separate measures of parliamentary participation. Ministerial role, safe-seat vs marginal, and tenure all shape these numbers. Each dimension is reported on its own so you can decide what matters.
        </Text>
      </View>

      {/* Share */}
      <Pressable
        style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, marginBottom: 20 }}
        onPress={handleShare}
      >
        <Ionicons name="share-outline" size={18} color="#00843D" />
        <Text style={{ fontSize: 15, fontWeight: '600', color: '#00843D' }}>Share comparison</Text>
      </Pressable>
    </View>
  );
}

// ── Main Screen ──────────────────────────────────────────────────────────────

export function CompareMPsScreen({ route, navigation }: any) {
  const { colors } = useTheme();
  const initialMP = route.params?.member ?? null;
  const [leftMP, setLeftMP] = useState<Member | null>(initialMP);
  const [rightMP, setRightMP] = useState<Member | null>(null);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 12 }}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text }}>Compare MPs</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* MP Pickers */}
        <View style={{ flexDirection: 'row', gap: 10, paddingHorizontal: 20, marginBottom: 20 }}>
          <MPPicker label="First MP" selected={leftMP} onSelect={(m) => { setLeftMP(m); track('compare_mp_selected', { member_id: m.id }, 'CompareMPs'); }} colors={colors} />
          <View style={{ justifyContent: 'center' }}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: '#9CA3AF' }}>VS</Text>
          </View>
          <MPPicker label="Second MP" selected={rightMP} onSelect={(m) => { setRightMP(m); track('compare_mp_selected', { member_id: m.id }, 'CompareMPs'); }} colors={colors} />
        </View>

        {/* Comparison results */}
        {leftMP && rightMP ? (
          <ComparisonPanel left={leftMP} right={rightMP} navigation={navigation} colors={colors} />
        ) : (
          <View style={{ alignItems: 'center', paddingVertical: 40, paddingHorizontal: 32 }}>
            <Ionicons name="people-outline" size={48} color="#D1D5DB" />
            <Text style={{ fontSize: 16, fontWeight: '600', color: colors.text, marginTop: 12, textAlign: 'center' }}>Select two MPs to compare</Text>
            <Text style={{ fontSize: 14, color: '#6B7280', marginTop: 4, textAlign: 'center', lineHeight: 20 }}>
              See how they stack up on accountability, attendance, speeches, and donations.
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
