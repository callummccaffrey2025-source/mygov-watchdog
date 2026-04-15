import React, { useState } from 'react';
import {
  View, Text, Image, ScrollView, StyleSheet, Pressable,
  Modal, TextInput, Share, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useUser } from '../context/UserContext';
import { useTheme } from '../context/ThemeContext';
import { SHADOWS } from '../constants/design';
import { useElectorateByPostcode } from '../hooks/useElectorateByPostcode';
import { useVotes } from '../hooks/useVotes';
import { useIndividualDonations } from '../hooks/useIndividualDonations';
import { useCommittees } from '../hooks/useCommittees';
import { useElectionInfo, NEXT_ELECTION_DEADLINE } from '../hooks/useElectionInfo';
import { useMembers, Member } from '../hooks/useMembers';
import { useParties, Party } from '../hooks/useParties';
import { PartyBadge } from '../components/PartyBadge';
import { SkeletonLoader } from '../components/SkeletonLoader';

// ─── Election countdown ────────────────────────────────────────────────────────

function ElectionCountdown({ electionDate, isCalled }: { electionDate: Date; isCalled: boolean }) {
  const now = new Date();
  const diffMs = electionDate.getTime() - now.getTime();
  const daysLeft = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
  const months = Math.floor(daysLeft / 30);
  const weeks = Math.floor((daysLeft % 30) / 7);

  let countdownLabel = '';
  if (daysLeft <= 14) countdownLabel = `${daysLeft} days`;
  else if (months > 0) countdownLabel = weeks > 0 ? `${months}mo ${weeks}w` : `${months} months`;
  else countdownLabel = `${Math.floor(daysLeft / 7)} weeks`;

  return (
    <View style={styles.countdownCard}>
      <View style={styles.countdownLeft}>
        <Ionicons name="flag" size={20} color="#ffffff" />
        <View>
          <Text style={styles.countdownTitle}>
            {isCalled ? 'Election Called' : 'Federal Election'}
          </Text>
          <Text style={styles.countdownSub}>
            {isCalled
              ? electionDate.toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })
              : `Due by ${electionDate.toLocaleDateString('en-AU', { month: 'long', year: 'numeric' })}`
            }
          </Text>
        </View>
      </View>
      <View style={styles.countdownBadge}>
        <Text style={styles.countdownNum}>{countdownLabel}</Text>
      </View>
    </View>
  );
}

// ─── Key issues grid ──────────────────────────────────────────────────────────

const KEY_ISSUES = [
  { key: 'housing',        label: 'Housing',          icon: '🏠' },
  { key: 'healthcare',     label: 'Health',            icon: '🏥' },
  { key: 'climate',        label: 'Climate',           icon: '🌿' },
  { key: 'economy',        label: 'Economy',           icon: '💰' },
  { key: 'education',      label: 'Education',         icon: '📚' },
  { key: 'cost_of_living', label: 'Cost of Living',    icon: '🛒' },
  { key: 'defence',        label: 'Defence',           icon: '🛡️' },
  { key: 'immigration',    label: 'Immigration',       icon: '✈️' },
  { key: 'indigenous',     label: 'Indigenous Affairs', icon: '🪃' },
  { key: 'technology',     label: 'Technology',         icon: '💻' },
  { key: 'agriculture',    label: 'Agriculture',        icon: '🌾' },
  { key: 'infrastructure', label: 'Infrastructure',     icon: '🚧' },
  { key: 'foreign_policy', label: 'Foreign Policy',     icon: '🌏' },
  { key: 'justice',        label: 'Justice',            icon: '⚖️' },
];

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  housing:        ['housing', 'rent', 'mortgage', 'tenancy', 'homelessness', 'dwelling'],
  healthcare:     ['health', 'medicare', 'hospital', 'aged care', 'ndis', 'medical', 'aged'],
  climate:        ['climate', 'environment', 'emission', 'renewable', 'energy', 'carbon', 'coal'],
  economy:        ['budget', 'economy', 'economic', 'tax', 'inflation', 'treasury', 'financial', 'fiscal', 'appropriation'],
  education:      ['education', 'university', 'student', 'school', 'hecs', 'tafe'],
  cost_of_living: ['cost of living', 'wage', 'superannuation', 'pension', 'centrelink', 'welfare'],
  defence:        ['defence', 'military', 'aukus', 'submarine', 'security', 'army', 'navy'],
  immigration:    ['immigration', 'visa', 'migration', 'refugee', 'border'],
  indigenous:     ['indigenous', 'aboriginal', 'torres strait', 'first nations', 'native title', 'uluru'],
  technology:     ['technology', 'tech', 'digital', 'cybersecurity', 'artificial intelligence', 'ai', 'data', 'online'],
  agriculture:    ['agriculture', 'farm', 'farming', 'rural', 'livestock', 'irrigation', 'drought', 'crop'],
  infrastructure: ['infrastructure', 'transport', 'rail', 'road', 'highway', 'bridge', 'construction', 'nbn'],
  foreign_policy: ['foreign', 'trade', 'export', 'import', 'pacific', 'china', 'usa', 'united nations', 'diplomat'],
  justice:        ['justice', 'crime', 'police', 'law enforcement', 'court', 'legal', 'corruption', 'integrity'],
};

function VotingGrid({ memberId }: { memberId: string }) {
  const { colors } = useTheme();
  const { votes, loading } = useVotes(memberId);

  if (loading) {
    return (
      <View style={{ gap: 8 }}>
        {[1, 2, 3, 4, 5].map(i => (
          <SkeletonLoader key={i} height={48} borderRadius={10} />
        ))}
      </View>
    );
  }

  const totalVotes = votes.length;
  const ayeTotal = votes.filter(v => v.vote_cast === 'aye').length;

  if (totalVotes === 0) {
    return <Text style={styles.empty}>No voting records available yet.</Text>;
  }

  // Map division names → issue categories via keyword matching
  const catVotes: Record<string, { aye: number; no: number }> = {};
  votes.forEach(v => {
    const name = ((v.division as any)?.name || '').toLowerCase();
    for (const [cat, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
      if (keywords.some(kw => name.includes(kw))) {
        if (!catVotes[cat]) catVotes[cat] = { aye: 0, no: 0 };
        if (v.vote_cast === 'aye') catVotes[cat].aye++;
        else if (v.vote_cast === 'no') catVotes[cat].no++;
        break;
      }
    }
  });

  const topCategories = Object.entries(catVotes)
    .map(([key, cv]) => ({ key, ...cv, total: cv.aye + cv.no }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  return (
    <View>
      <View style={styles.overallRow}>
        <View style={[styles.overallStat, { backgroundColor: colors.surface }]}>
          <Text style={[styles.overallNum, { color: colors.text }]}>{totalVotes}</Text>
          <Text style={[styles.overallLabel, { color: colors.textMuted }]}>Bills Voted</Text>
        </View>
        <View style={[styles.overallStat, { backgroundColor: colors.surface }]}>
          <Text style={[styles.overallNum, { color: '#00843D' }]}>
            {Math.round((ayeTotal / totalVotes) * 100)}%
          </Text>
          <Text style={[styles.overallLabel, { color: colors.textMuted }]}>Aye Rate</Text>
        </View>
      </View>

      {topCategories.length > 0 ? (
        <View style={styles.topicList}>
          {topCategories.map(cat => {
            const issue = KEY_ISSUES.find(k => k.key === cat.key);
            const label = issue?.label ?? cat.key;
            const icon = issue?.icon ?? '🏛️';
            return (
              <View key={cat.key} style={styles.topicRow}>
                <Text style={styles.topicIcon}>{icon}</Text>
                <View style={{ flex: 1 }}>
                  <View style={styles.topicMeta}>
                    <Text style={[styles.topicLabel, { color: colors.text }]}>{label}</Text>
                    <Text style={[styles.topicCount, { color: colors.textMuted }]}>
                      {cat.total} votes ({cat.aye} Aye{cat.no > 0 ? `, ${cat.no} No` : ''})
                    </Text>
                  </View>
                  <View style={styles.topicBar}>
                    {cat.aye > 0 && (
                      <View style={[styles.topicBarAye, { width: `${Math.round(cat.aye / cat.total * 100)}%` }]} />
                    )}
                    {cat.no > 0 && (
                      <View style={[styles.topicBarNo, { width: `${Math.round(cat.no / cat.total * 100)}%` }]} />
                    )}
                  </View>
                </View>
              </View>
            );
          })}
        </View>
      ) : (
        <Text style={[styles.gridNote, { color: colors.textMuted }]}>Votes recorded but no categorised divisions matched yet.</Text>
      )}

      <Text style={[styles.gridNote, { color: colors.textMuted }]}>
        Based on {totalVotes} recorded votes · Top 5 policy areas
      </Text>
    </View>
  );
}

// ─── Compare section ───────────────────────────────────────────────────────────

type SelectionItem = { type: 'member'; data: Member } | { type: 'party'; data: Party };

function CompareSection({ navigation }: { navigation: any }) {
  const { colors } = useTheme();
  const [left, setLeft] = useState<SelectionItem | null>(null);
  const [right, setRight] = useState<SelectionItem | null>(null);
  const [selecting, setSelecting] = useState<'left' | 'right' | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const { members } = useMembers({ search: searchQuery || undefined, limit: searchQuery ? 15 : 8 });
  const { parties } = useParties();
  const filteredParties = parties
    .filter(p => p.colour)
    .filter(p =>
      !searchQuery || p.name.toLowerCase().includes(searchQuery.toLowerCase()),
    );

  const leftId = left?.type === 'member' ? left.data.id : null;
  const rightId = right?.type === 'member' ? right.data.id : null;
  const { votes: leftVotes } = useVotes(leftId);
  const { votes: rightVotes } = useVotes(rightId);
  const { donations: leftDonations } = useIndividualDonations(leftId ?? undefined);
  const { donations: rightDonations } = useIndividualDonations(rightId ?? undefined);
  const { current: leftCommittees } = useCommittees(leftId ?? undefined);
  const { current: rightCommittees } = useCommittees(rightId ?? undefined);

  const bothMembers = left?.type === 'member' && right?.type === 'member';

  // Aye rates
  const leftAye = leftVotes.filter(v => v.vote_cast === 'aye').length;
  const leftTotal = leftVotes.filter(v => v.vote_cast === 'aye' || v.vote_cast === 'no').length;
  const rightAye = rightVotes.filter(v => v.vote_cast === 'aye').length;
  const rightTotal = rightVotes.filter(v => v.vote_cast === 'aye' || v.vote_cast === 'no').length;
  const leftAyePct = leftTotal > 0 ? Math.round((leftAye / leftTotal) * 100) : 0;
  const rightAyePct = rightTotal > 0 ? Math.round((rightAye / rightTotal) * 100) : 0;

  // Topic breakdown using CATEGORY_KEYWORDS
  const topicRows = Object.entries(CATEGORY_KEYWORDS).slice(0, 5).map(([topic, keywords]) => {
    const matches = (votes: typeof leftVotes) =>
      votes.filter(v => keywords.some(kw => (v.division?.name || '').toLowerCase().includes(kw)));
    const lv = matches(leftVotes);
    const rv = matches(rightVotes);
    if (lv.length === 0 && rv.length === 0) return null;
    const lAye = lv.filter(v => v.vote_cast === 'aye').length;
    const lNo = lv.filter(v => v.vote_cast === 'no').length;
    const rAye = rv.filter(v => v.vote_cast === 'aye').length;
    const rNo = rv.filter(v => v.vote_cast === 'no').length;
    return { topic, lAye, lNo, rAye, rNo };
  }).filter(Boolean);

  // Donation totals
  const leftDonTotal = leftDonations?.reduce((s: number, d: any) => s + (d.amount || 0), 0) ?? 0;
  const rightDonTotal = rightDonations?.reduce((s: number, d: any) => s + (d.amount || 0), 0) ?? 0;

  const displayName = (item: SelectionItem) =>
    item.type === 'member'
      ? `${item.data.first_name} ${item.data.last_name}`
      : item.data.short_name || item.data.name;

  const displaySub = (item: SelectionItem) =>
    item.type === 'member' ? (item.data.party?.short_name || '') : 'Party';

  const handleShare = () => {
    if (!left || !right) return;
    Share.share({
      message: `Comparing ${displayName(left)} vs ${displayName(right)} on Verity — Australia's civic intelligence app.`,
    });
  };

  return (
    <View style={styles.compareSection}>
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Compare MPs & Parties</Text>
        {left && right && (
          <Pressable onPress={handleShare} hitSlop={8}>
            <Ionicons name={Platform.OS === 'ios' ? 'share-outline' : 'share-social-outline'} size={20} color={colors.textMuted} />
          </Pressable>
        )}
      </View>

      <View style={styles.selectors}>
        {(['left', 'right'] as const).map(side => {
          const selected = side === 'left' ? left : right;
          return (
            <Pressable
              key={side}
              style={[styles.selectorCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={() => { setSelecting(side); setSearchQuery(''); }}
            >
              {selected ? (
                <View style={styles.selectedItem}>
                  <Text style={[styles.selectedName, { color: colors.text }]} numberOfLines={2}>{displayName(selected)}</Text>
                  <Text style={[styles.selectedSub, { color: colors.textMuted }]}>{displaySub(selected)}</Text>
                </View>
              ) : (
                <View style={styles.emptySelector}>
                  <Ionicons name="add-circle-outline" size={24} color={colors.textMuted} />
                  <Text style={[styles.emptySelectorText, { color: colors.textMuted }]}>Select MP or Party</Text>
                </View>
              )}
            </Pressable>
          );
        })}
        <View style={[styles.vsCircle, { backgroundColor: colors.text }]}><Text style={[styles.vsText, { color: colors.background }]}>VS</Text></View>
      </View>

      {left && right && (
        bothMembers ? (
          <View style={[styles.compareCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {/* Aye rates */}
            <Text style={[styles.compareSubhead, { color: colors.textMuted }]}>AYE RATE</Text>
            <View style={styles.compareRow}>
              <Text style={[styles.compareStat, { color: '#00843D' }]}>{leftAyePct}%</Text>
              <Text style={[styles.compareVs, { color: colors.textMuted }]}>vs</Text>
              <Text style={[styles.compareStat, { color: '#00843D' }]}>{rightAyePct}%</Text>
            </View>
            {/* Topic breakdown */}
            {topicRows.length > 0 && (
              <>
                <Text style={[styles.compareSubhead, { color: colors.textMuted, marginTop: 12 }]}>BY TOPIC</Text>
                {topicRows.map((row: any) => (
                  <View key={row.topic} style={styles.topicCompareRow}>
                    <Text style={[styles.topicCompareLabel, { color: colors.textBody }]} numberOfLines={1}>
                      {row.topic.replace('_', ' ')}
                    </Text>
                    <Text style={styles.topicCompareLeft}>
                      {row.lAye}✓ {row.lNo}✗
                    </Text>
                    <Text style={styles.topicCompareRight}>
                      {row.rAye}✓ {row.rNo}✗
                    </Text>
                  </View>
                ))}
              </>
            )}
            {/* Committees & donations */}
            <View style={[styles.compareMetaRow, { borderTopColor: colors.border }]}>
              <View style={styles.compareMeta}>
                <Text style={[styles.compareMetaLabel, { color: colors.textMuted }]}>COMMITTEES</Text>
                <Text style={[styles.compareMetaVal, { color: colors.text }]}>{leftCommittees?.length ?? 0}</Text>
              </View>
              <View style={styles.compareMeta}>
                <Text style={[styles.compareMetaLabel, { color: colors.textMuted }]}>DONATIONS</Text>
                <Text style={[styles.compareMetaVal, { color: colors.text }]}>${(leftDonTotal / 1000).toFixed(0)}k</Text>
              </View>
              <View style={[styles.compareMeta, { alignItems: 'flex-end' }]}>
                <Text style={[styles.compareMetaLabel, { color: colors.textMuted }]}>COMMITTEES</Text>
                <Text style={[styles.compareMetaVal, { color: colors.text }]}>{rightCommittees?.length ?? 0}</Text>
              </View>
              <View style={[styles.compareMeta, { alignItems: 'flex-end' }]}>
                <Text style={[styles.compareMetaLabel, { color: colors.textMuted }]}>DONATIONS</Text>
                <Text style={[styles.compareMetaVal, { color: colors.text }]}>${(rightDonTotal / 1000).toFixed(0)}k</Text>
              </View>
            </View>
            {/* Profile links */}
            <Pressable
              style={styles.viewProfileBtn}
              onPress={() => navigation.navigate('MemberProfile', { member: (left as any).data })}
            >
              <Text style={styles.viewProfileText}>View {displayName(left)}'s Profile →</Text>
            </Pressable>
            <Pressable
              style={styles.viewProfileBtn}
              onPress={() => navigation.navigate('MemberProfile', { member: (right as any).data })}
            >
              <Text style={styles.viewProfileText}>View {displayName(right)}'s Profile →</Text>
            </Pressable>
          </View>
        ) : (
          <View style={[styles.compareResult, { backgroundColor: colors.surface }]}>
            <Text style={[styles.compareResultText, { color: colors.textBody }]}>
              Tap either card to change selection. Voting alignment data will appear as records are added.
            </Text>
            <Pressable
              style={styles.viewProfileBtn}
              onPress={() => {
                if (left.type === 'member') navigation.navigate('MemberProfile', { member: left.data });
                else navigation.navigate('PartyProfile', { party: left.data });
              }}
            >
              <Text style={styles.viewProfileText}>View {displayName(left)}'s Profile →</Text>
            </Pressable>
            <Pressable
              style={styles.viewProfileBtn}
              onPress={() => {
                if (right.type === 'member') navigation.navigate('MemberProfile', { member: right.data });
                else navigation.navigate('PartyProfile', { party: right.data });
              }}
            >
              <Text style={styles.viewProfileText}>View {displayName(right)}'s Profile →</Text>
            </Pressable>
          </View>
        )
      )}

      <Modal visible={selecting !== null} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={[styles.modal, { backgroundColor: colors.background }]} edges={['top']}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Select MP or Party</Text>
            <Pressable onPress={() => setSelecting(null)}>
              <Ionicons name="close" size={24} color={colors.text} />
            </Pressable>
          </View>
          <TextInput
            style={[styles.modalSearch, { backgroundColor: colors.surface, color: colors.text }]}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search..."
            placeholderTextColor={colors.textMuted}
            autoFocus
          />
          <ScrollView keyboardShouldPersistTaps="handled">
            {filteredParties.length > 0 && (
              <View>
                <Text style={[styles.modalSection, { color: colors.textMuted }]}>Parties</Text>
                {filteredParties.slice(0, 5).map(party => (
                  <Pressable
                    key={party.id}
                    style={[styles.modalItem, { borderBottomColor: colors.border }]}
                    onPress={() => {
                      const item: SelectionItem = { type: 'party', data: party };
                      if (selecting === 'left') setLeft(item); else setRight(item);
                      setSelecting(null);
                    }}
                  >
                    <View style={[styles.modalDot, { backgroundColor: party.colour || colors.textMuted }]} />
                    <Text style={[styles.modalItemText, { color: colors.text }]}>{party.name}</Text>
                  </Pressable>
                ))}
              </View>
            )}
            <Text style={[styles.modalSection, { color: colors.textMuted }]}>MPs & Senators</Text>
            {members.map(m => (
              <Pressable
                key={m.id}
                style={[styles.modalItem, { borderBottomColor: colors.border }]}
                onPress={() => {
                  const item: SelectionItem = { type: 'member', data: m };
                  if (selecting === 'left') setLeft(item); else setRight(item);
                  setSelecting(null);
                }}
              >
                <View style={[styles.modalDot, { backgroundColor: m.party?.colour || colors.textMuted }]} />
                <View>
                  <Text style={[styles.modalItemText, { color: colors.text }]}>{m.first_name} {m.last_name}</Text>
                  <Text style={[styles.modalItemSub, { color: colors.textMuted }]}>{m.party?.short_name} · {m.electorate?.name}</Text>
                </View>
              </Pressable>
            ))}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export function ElectionScreen({ navigation }: any) {
  const { colors } = useTheme();
  const { postcode } = useUser();
  const { electorate, member: myMP, loading: mpLoading } = useElectorateByPostcode(postcode);
  const { election } = useElectionInfo('federal');

  const electionDate = election?.election_date
    ? new Date(election.election_date)
    : NEXT_ELECTION_DEADLINE;

  const handleShareMP = () => {
    if (!myMP) return;
    Share.share({
      message: `My MP is ${myMP.first_name} ${myMP.last_name} (${myMP.party?.short_name || myMP.party?.name || ''}) for ${electorate?.name}. Check their voting record on Verity.`,
    });
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.title, { color: colors.text }]}>Vote</Text>

        {/* Election countdown */}
        <ElectionCountdown
          electionDate={electionDate}
          isCalled={election?.is_called ?? false}
        />

        {/* Your electorate */}
        {!postcode ? (
          <View style={[styles.postcodePrompt, { backgroundColor: colors.surface }]}>
            <Ionicons name="location-outline" size={28} color={colors.textMuted} />
            <Text style={[styles.postcodePromptTitle, { color: colors.text }]}>Find your electorate</Text>
            <Text style={[styles.postcodePromptBody, { color: colors.textBody }]}>
              Enter your postcode in the Home tab to see your MP's voting record and local candidates.
            </Text>
          </View>
        ) : mpLoading ? (
          <SkeletonLoader height={80} borderRadius={14} style={{ marginBottom: 16 }} />
        ) : myMP ? (
          <View style={styles.mpSection}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Your Electorate: {electorate?.name}</Text>
              <Pressable onPress={handleShareMP} hitSlop={8}>
                <Ionicons
                  name={Platform.OS === 'ios' ? 'share-outline' : 'share-social-outline'}
                  size={20}
                  color={colors.textMuted}
                />
              </Pressable>
            </View>

            {/* Current MP card */}
            <Pressable
              style={[styles.mpCard, { backgroundColor: colors.surface }]}
              onPress={() => navigation.navigate('MemberProfile', { member: myMP })}
            >
              {myMP.photo_url ? (
                <Image source={{ uri: myMP.photo_url }} style={styles.mpPhoto} />
              ) : (
                <View style={[styles.mpAvatar, { backgroundColor: (myMP.party?.colour || '#9aabb8') + '22' }]}>
                  <Text style={[styles.mpInitials, { color: myMP.party?.colour || '#9aabb8' }]}>
                    {myMP.first_name[0]}{myMP.last_name[0]}
                  </Text>
                </View>
              )}
              <View style={styles.mpInfo}>
                <View style={styles.mpNameRow}>
                  <Text style={[styles.mpName, { color: colors.text }]}>{myMP.first_name} {myMP.last_name}</Text>
                  <Ionicons name="checkmark-circle" size={14} color="#1D9BF0" />
                </View>
                {myMP.party && (
                  <PartyBadge
                    name={myMP.party.short_name || myMP.party.abbreviation || myMP.party.name}
                    colour={myMP.party.colour}
                    size="sm"
                  />
                )}
                <Text style={[styles.mpRole, { color: colors.textMuted }]}>
                  {myMP.chamber === 'senate' ? 'Senator' : 'MP'} · {electorate?.state}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </Pressable>

            {/* How they voted on key issues */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>How They Voted on Key Issues</Text>
              <VotingGrid memberId={myMP.id} />
            </View>
          </View>
        ) : electorate ? (
          <View style={[styles.mpNotFound, { backgroundColor: colors.surface }]}>
            <Text style={[styles.electorate, { color: colors.text }]}>{electorate.name} · {electorate.state}</Text>
            <Text style={[styles.mpNotFoundText, { color: colors.textMuted }]}>MP data loading soon.</Text>
          </View>
        ) : (
          <View style={[styles.mpNotFound, { backgroundColor: colors.surface }]}>
            <Text style={[styles.mpNotFoundText, { color: colors.textMuted }]}>No electorate found for postcode {postcode}.</Text>
          </View>
        )}

        {/* Compare section */}
        <CompareSection navigation={navigation} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#ffffff' },
  content: { padding: 20, paddingBottom: 48 },
  title: { fontSize: 28, fontWeight: '800', color: '#1a2332', marginBottom: 20 },

  // Countdown
  countdownCard: {
    backgroundColor: '#00843D', borderRadius: 16, padding: 18,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 20, ...SHADOWS.md,
  },
  countdownLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  countdownTitle: { fontSize: 15, fontWeight: '700', color: '#ffffff' },
  countdownSub: { fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 2 },
  countdownBadge: { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6 },
  countdownNum: { fontSize: 14, fontWeight: '800', color: '#ffffff' },

  // Postcode prompt
  postcodePrompt: {
    backgroundColor: '#f8f9fa', borderRadius: 16, padding: 24,
    alignItems: 'center', gap: 10, marginBottom: 20,
  },
  postcodePromptTitle: { fontSize: 16, fontWeight: '700', color: '#1a2332' },
  postcodePromptBody: { fontSize: 14, color: '#5a6a7a', textAlign: 'center', lineHeight: 21 },

  // MP section
  mpSection: { marginBottom: 8 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#1a2332', flex: 1 },
  section: { marginBottom: 20 },

  mpCard: {
    backgroundColor: '#f8f9fa', borderRadius: 14, padding: 16,
    flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20,
  },
  mpPhoto: { width: 52, height: 52, borderRadius: 26, flexShrink: 0 },
  mpAvatar: { width: 52, height: 52, borderRadius: 26, justifyContent: 'center', alignItems: 'center' },
  mpInitials: { fontSize: 18, fontWeight: '700' },
  mpInfo: { flex: 1, gap: 4 },
  mpNameRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  mpName: { fontSize: 15, fontWeight: '700', color: '#1a2332' },
  mpRole: { fontSize: 12, color: '#9aabb8' },
  mpNotFound: { backgroundColor: '#f8f9fa', borderRadius: 14, padding: 16, marginBottom: 20, gap: 4 },
  electorate: { fontSize: 15, fontWeight: '600', color: '#1a2332' },
  mpNotFoundText: { fontSize: 13, color: '#9aabb8' },

  // Voting grid
  overallRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  overallStat: {
    flex: 1, backgroundColor: '#f8f9fa', borderRadius: 12,
    padding: 14, alignItems: 'center', gap: 4,
  },
  overallNum: { fontSize: 22, fontWeight: '800', color: '#1a2332' },
  overallLabel: { fontSize: 12, color: '#9aabb8' },
  gridWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  gridCell: {
    width: '47%', backgroundColor: '#f8f9fa', borderRadius: 12,
    padding: 12, alignItems: 'center', gap: 4,
  },
  gridIssueIcon: { fontSize: 20 },
  gridLabel: { fontSize: 12, fontWeight: '600', color: '#1a2332' },
  gridNote: { fontSize: 11, color: '#9aabb8', marginTop: 10, textAlign: 'center' },
  empty: { fontSize: 14, color: '#9aabb8', textAlign: 'center', paddingVertical: 20 },

  // Compare section
  compareSection: { marginTop: 8 },
  selectors: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12, position: 'relative' },
  selectorCard: {
    flex: 1, backgroundColor: '#F5F5F5', borderRadius: 12, padding: 14,
    minHeight: 80, justifyContent: 'center', alignItems: 'center',
    borderWidth: 1.5, borderColor: '#e8ecf0',
  },
  selectedItem: { alignItems: 'center', gap: 4 },
  selectedName: { fontSize: 12, fontWeight: '700', color: '#1a2332', textAlign: 'center' },
  selectedSub: { fontSize: 11, color: '#9aabb8' },
  emptySelector: { alignItems: 'center', gap: 5 },
  emptySelectorText: { fontSize: 11, color: '#9aabb8', textAlign: 'center' },
  vsCircle: {
    position: 'absolute', left: '50%', top: '50%',
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: '#1a2332', justifyContent: 'center', alignItems: 'center',
    marginLeft: -16, marginTop: -16,
  },
  vsText: { fontSize: 9, fontWeight: '800', color: '#ffffff' },
  compareResult: { backgroundColor: '#f8f9fa', borderRadius: 12, padding: 16, gap: 10 },
  compareResultText: { fontSize: 13, color: '#5a6a7a', lineHeight: 19 },
  viewProfileBtn: { paddingVertical: 4 },
  viewProfileText: { fontSize: 14, color: '#00843D', fontWeight: '600' },

  // Compare card (member vs member)
  compareCard: { borderRadius: 12, borderWidth: 1, padding: 14, backgroundColor: '#f8f9fb', borderColor: '#e8ecf0' },
  compareSubhead: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', color: '#9aabb8', marginBottom: 6 },
  compareRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  compareStat: { fontSize: 28, fontWeight: '800', color: '#00843D' },
  compareVs: { fontSize: 13, color: '#9aabb8' },
  topicCompareRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4 },
  topicCompareLabel: { flex: 1, fontSize: 13, color: '#5a6a7a', textTransform: 'capitalize' },
  topicCompareLeft: { fontSize: 12, color: '#5a6a7a', width: 50, textAlign: 'center' },
  topicCompareRight: { fontSize: 12, color: '#5a6a7a', width: 50, textAlign: 'right' },
  compareMetaRow: { flexDirection: 'row', marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#e8ecf0' },
  compareMeta: { flex: 1, alignItems: 'flex-start' },
  compareMetaLabel: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', color: '#9aabb8' },
  compareMetaVal: { fontSize: 16, fontWeight: '700', color: '#1a2332', marginTop: 2 },

  // Modal
  modal: { flex: 1, backgroundColor: '#ffffff' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#1a2332' },
  modalSearch: {
    margin: 16, backgroundColor: '#f8f9fa', borderRadius: 10,
    padding: 12, fontSize: 15, color: '#1a2332',
  },
  modalSection: { fontSize: 12, fontWeight: '700', color: '#9aabb8', textTransform: 'uppercase', paddingHorizontal: 16, paddingVertical: 8 },
  modalItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f5f5f5' },
  modalDot: { width: 12, height: 12, borderRadius: 6 },
  modalItemText: { fontSize: 15, color: '#1a2332', fontWeight: '500' },
  modalItemSub: { fontSize: 12, color: '#9aabb8' },

  // VotingGrid topic rows
  topicList: { gap: 10 },
  topicRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  topicIcon: { fontSize: 16, width: 22, textAlign: 'center' },
  topicMeta: { flex: 1, gap: 4 },
  topicLabel: { fontSize: 12, fontWeight: '600', color: '#1a2332' },
  topicCount: { fontSize: 11, color: '#9aabb8' },
  topicBar: { height: 6, borderRadius: 3, flexDirection: 'row', overflow: 'hidden', backgroundColor: '#f0f0f0', width: '100%' },
  topicBarAye: { backgroundColor: '#00843D', height: 6 },
  topicBarNo: { backgroundColor: '#DC3545', height: 6 },
});
