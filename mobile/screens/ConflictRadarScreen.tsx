import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, Pressable, RefreshControl, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { useTheme } from '../context/ThemeContext';
import { isFeatureEnabled } from '../lib/featureFlags';
import { supabase } from '../lib/supabase';
import { SkeletonLoader } from '../components/SkeletonLoader';
import { EmptyState } from '../components/EmptyState';
import { SPACING, FONT_SIZE, FONT_WEIGHT, BORDER_RADIUS, SHADOWS } from '../constants/design';

/**
 * Conflict Radar Screen — shows all MPs with votes that overlap their
 * declared financial interests. FEATURE-FLAGGED: defaults OFF.
 *
 * Data: registered_interests × division_votes × divisions
 * LEGAL GATE: Only visible when feature flag 'conflict_radar' is true.
 */

interface MPConflict {
  member_id: string;
  first_name: string;
  last_name: string;
  party_name: string;
  party_colour: string | null;
  photo_url: string | null;
  electorate_name: string;
  conflict_count: number;
  top_category: string;
}

export function ConflictRadarScreen({ navigation }: { navigation: any }) {
  const { colors } = useTheme();
  const enabled = isFeatureEnabled('conflict_radar');

  if (!enabled) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={{ paddingHorizontal: 20, paddingTop: SPACING.lg }}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </Pressable>
        </View>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 }}>
          <View style={{
            width: 72, height: 72, borderRadius: 36,
            backgroundColor: '#FEF3C7', justifyContent: 'center', alignItems: 'center',
            marginBottom: SPACING.xl,
          }}>
            <Ionicons name="shield-checkmark-outline" size={36} color="#D97706" />
          </View>
          <Text style={{
            fontSize: FONT_SIZE.title, fontWeight: FONT_WEIGHT.bold,
            color: colors.text, textAlign: 'center', marginBottom: SPACING.md,
          }}>
            Under Legal Review
          </Text>
          <Text style={{
            fontSize: FONT_SIZE.body, color: colors.textMuted,
            textAlign: 'center', lineHeight: 22,
          }}>
            The Conflict Radar identifies votes where MPs have declared financial interests in the relevant area.
            This feature is undergoing legal review to ensure accuracy and fairness.
          </Text>
          <Text style={{
            fontSize: FONT_SIZE.small, color: colors.textMuted,
            textAlign: 'center', marginTop: SPACING.lg, fontStyle: 'italic',
          }}>
            All data sourced from the official Register of Members' Interests.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return <ConflictRadarContent navigation={navigation} />;
}

function ConflictRadarContent({ navigation }: { navigation: any }) {
  const { colors } = useTheme();
  const [conflicts, setConflicts] = useState<MPConflict[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchConflicts = useCallback(async () => {
    try {
      // Get all members with registered interests
      const { data: interests } = await supabase
        .from('registered_interests')
        .select('member_id, category, description')
        .order('member_id');

      if (!interests || interests.length === 0) {
        setConflicts([]);
        setLoading(false);
        return;
      }

      // Group interests by member
      const memberInterests = new Map<string, { categories: Set<string>; keywords: string[] }>();
      for (const i of interests) {
        let entry = memberInterests.get(i.member_id);
        if (!entry) {
          entry = { categories: new Set(), keywords: [] };
          memberInterests.set(i.member_id, entry);
        }
        entry.categories.add(i.category);
        // Extract keywords from description
        const words = (i.description || '')
          .toLowerCase()
          .replace(/[^a-z\s]/g, '')
          .split(/\s+/)
          .filter((w: string) => w.length >= 5);
        entry.keywords.push(...words);
      }

      const memberIds = [...memberInterests.keys()];

      // Get members info
      const { data: members } = await supabase
        .from('members')
        .select('id, first_name, last_name, photo_url, party:parties(name, colour), electorate:electorates!members_electorate_id_fkey(name)')
        .in('id', memberIds)
        .eq('is_current', true);

      if (!members) { setConflicts([]); setLoading(false); return; }

      // Get recent votes for these members
      const { data: votes } = await supabase
        .from('division_votes')
        .select('member_id, division_id, vote_cast, divisions(name, bill_title)')
        .in('member_id', memberIds)
        .in('vote_cast', ['aye', 'no'])
        .order('created_at', { ascending: false })
        .limit(5000);

      if (!votes) { setConflicts([]); setLoading(false); return; }

      // Match votes against interests
      const conflictCounts = new Map<string, { count: number; topCategory: string }>();
      for (const vote of votes as any[]) {
        const d = vote.divisions;
        if (!d) continue;
        const divText = `${d.name || ''} ${d.bill_title || ''}`.toLowerCase();
        const entry = memberInterests.get(vote.member_id);
        if (!entry) continue;

        const matchCount = entry.keywords.filter(kw => divText.includes(kw)).length;
        if (matchCount >= 2) {
          const existing = conflictCounts.get(vote.member_id);
          if (existing) {
            existing.count++;
          } else {
            const topCat = [...entry.categories][0] || 'Financial';
            conflictCounts.set(vote.member_id, { count: 1, topCategory: topCat });
          }
        }
      }

      // Build results
      const results: MPConflict[] = [];
      for (const member of members as any[]) {
        const conflict = conflictCounts.get(member.id);
        if (!conflict) continue;
        const party = Array.isArray(member.party) ? member.party[0] : member.party;
        const electorate = Array.isArray(member.electorate) ? member.electorate[0] : member.electorate;
        results.push({
          member_id: member.id,
          first_name: member.first_name,
          last_name: member.last_name,
          party_name: party?.name ?? 'Unknown',
          party_colour: party?.colour ?? null,
          photo_url: member.photo_url,
          electorate_name: electorate?.name ?? '',
          conflict_count: conflict.count,
          top_category: conflict.topCategory,
        });
      }

      results.sort((a, b) => b.conflict_count - a.conflict_count);
      setConflicts(results);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { fetchConflicts(); }, [fetchConflicts]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchConflicts();
    setRefreshing(false);
  }, [fetchConflicts]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <LinearGradient
        colors={['#D97706', '#B45309']}
        style={{ paddingHorizontal: 20, paddingTop: SPACING.lg, paddingBottom: SPACING.xl }}
      >
        <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={{ marginBottom: SPACING.md }}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </Pressable>
        <Text style={{ fontSize: FONT_SIZE.heading, fontWeight: FONT_WEIGHT.bold, color: '#fff' }}>
          Conflict Radar
        </Text>
        <Text style={{ fontSize: FONT_SIZE.small, color: 'rgba(255,255,255,0.85)', marginTop: SPACING.xs }}>
          Votes where MPs have declared financial interests
        </Text>
      </LinearGradient>

      {loading ? (
        <View style={{ padding: 20, gap: 12 }}>
          {[1,2,3,4,5,6,7,8].map(i => <SkeletonLoader key={i} width="100%" height={20} />)}
        </View>
      ) : conflicts.length === 0 ? (
        <EmptyState
          icon="shield-checkmark-outline"
          title="No Conflicts Detected"
          subtitle="No overlapping votes and declared interests found in the current dataset."
        />
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 20, paddingBottom: SPACING.xxxl }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#D97706" />}
        >
          {/* Disclaimer */}
          <View style={{
            backgroundColor: '#FFFBEB', borderRadius: BORDER_RADIUS.md,
            padding: SPACING.md, marginBottom: SPACING.lg,
            flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm,
          }}>
            <Ionicons name="information-circle" size={18} color="#D97706" style={{ marginTop: 1 }} />
            <Text style={{ flex: 1, fontSize: FONT_SIZE.small, color: '#92400E', lineHeight: 18 }}>
              Declaring an interest is a transparency requirement, not evidence of wrongdoing.
              All data from the official Register of Members' Interests.
            </Text>
          </View>

          {/* MP list */}
          {conflicts.map(mp => (
            <Pressable
              key={mp.member_id}
              onPress={() => navigation.navigate('MemberProfile', { memberId: mp.member_id })}
              style={({ pressed }) => ({
                backgroundColor: colors.card,
                borderRadius: BORDER_RADIUS.lg,
                padding: SPACING.lg,
                marginBottom: SPACING.md,
                ...SHADOWS.sm,
                opacity: pressed ? 0.92 : 1,
              })}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.md }}>
                {mp.photo_url ? (
                  <Image
                    source={{ uri: mp.photo_url }}
                    style={{ width: 44, height: 44, borderRadius: 22 }}
                    contentFit="cover"
                  />
                ) : (
                  <View style={{
                    width: 44, height: 44, borderRadius: 22,
                    backgroundColor: mp.party_colour ?? colors.surface,
                    justifyContent: 'center', alignItems: 'center',
                  }}>
                    <Text style={{ color: '#fff', fontWeight: FONT_WEIGHT.bold, fontSize: FONT_SIZE.small }}>
                      {mp.first_name[0]}{mp.last_name[0]}
                    </Text>
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.semibold, color: colors.text }}>
                    {mp.first_name} {mp.last_name}
                  </Text>
                  <Text style={{ fontSize: FONT_SIZE.small, color: colors.textMuted }}>
                    {mp.party_name} · {mp.electorate_name}
                  </Text>
                </View>
                <View style={{ alignItems: 'center' }}>
                  <Text style={{ fontSize: FONT_SIZE.title, fontWeight: FONT_WEIGHT.bold, color: '#D97706' }}>
                    {mp.conflict_count}
                  </Text>
                  <Text style={{ fontSize: 9, color: colors.textMuted }}>overlaps</Text>
                </View>
              </View>
              <View style={{
                marginTop: SPACING.sm, backgroundColor: '#FFFBEB',
                borderRadius: BORDER_RADIUS.sm, paddingHorizontal: SPACING.sm, paddingVertical: 3,
                alignSelf: 'flex-start',
              }}>
                <Text style={{ fontSize: 10, fontWeight: FONT_WEIGHT.semibold, color: '#92400E' }}>
                  Top area: {mp.top_category}
                </Text>
              </View>
            </Pressable>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
