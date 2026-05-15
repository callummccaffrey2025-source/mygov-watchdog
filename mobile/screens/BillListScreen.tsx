import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, Pressable, TextInput, ActivityIndicator, ScrollView } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { Bill } from '../hooks/useBills';
import { BillCard } from '../components/BillCard';
import { SkeletonLoader } from '../components/SkeletonLoader';
import { useTheme } from '../context/ThemeContext';
import { enrichBill } from '../lib/billEnrichment';
import { SPACING, FONT_SIZE, FONT_WEIGHT, BORDER_RADIUS } from '../constants/design';

const PAGE_SIZE = 30;

type StatusFilter = 'live' | 'recent' | 'passed' | 'all_48' | 'all_47';

const STATUS_CHIPS: { key: StatusFilter; label: string }[] = [
  { key: 'live',     label: 'Before Parliament' },
  { key: 'recent',   label: 'Recent' },
  { key: 'passed',   label: 'Passed into Law' },
  { key: 'all_48',   label: '48th Parliament' },
  { key: 'all_47',   label: '47th Parliament' },
];

const BILL_SELECT = 'id,title,short_title,current_status,status,summary,summary_plain,summary_full,expanded_summary,categories,date_introduced,last_updated,chamber_introduced,origin_chamber,level,aph_url,aph_id,sponsor,portfolio,bill_type,parliament_no,intro_house,intro_senate,passed_house,passed_senate,assent_date,sponsor_id,sponsor_party,narrative_status,is_live,days_since_movement,politics_cache';

function buildQuery(search: string, status: StatusFilter, offset: number) {
  let q = supabase.from('bills').select(BILL_SELECT);

  if (status === 'live') {
    q = q.in('current_status', ['introduced', 'passed_house']);
  } else if (status === 'recent') {
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    q = q.gte('last_updated', ninetyDaysAgo)
      .not('aph_id', 'is', null);
  } else if (status === 'passed') {
    q = q.eq('current_status', 'royal_assent');
  } else if (status === 'all_48') {
    q = q.eq('parliament_no', 48);
  } else if (status === 'all_47') {
    q = q.eq('parliament_no', 47);
  }

  if (search.length > 1) {
    q = q.ilike('title', `%${search}%`);
  }

  q = q.order('date_introduced', { ascending: false, nullsFirst: false });
  q = q.range(offset, offset + PAGE_SIZE - 1);
  return q;
}

export function BillListScreen({ navigation }: any) {
  const { colors } = useTheme();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [status, setStatus] = useState<StatusFilter>('live');
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const fetchPage = useCallback(async (offset: number, replace: boolean) => {
    if (offset === 0) setLoading(true); else setLoadingMore(true);
    const { data, error } = await buildQuery(debouncedSearch, status, offset);
    if (!error && data) {
      setBills(prev => replace ? data as Bill[] : [...prev, ...data as Bill[]]);
      setHasMore(data.length === PAGE_SIZE);
    }
    if (offset === 0) setLoading(false); else setLoadingMore(false);
  }, [debouncedSearch, status]);

  useEffect(() => { fetchPage(0, true); }, [fetchPage]);

  const loadMore = () => {
    if (!loadingMore && hasMore) fetchPage(bills.length, false);
  };

  const sortedBills = bills;

  const renderBillCard = useCallback(({ item }: { item: Bill }) => {
    const e = enrichBill(item);
    return (
      <BillCard
        bill={item}
        onPress={() => navigation.navigate('BillDetail', { bill: item })}
        dimmed={!e.isLive && (status === 'all_47' || status === 'all_48')}
      />
    );
  }, [navigation, status]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.xl, paddingTop: SPACING.lg, paddingBottom: SPACING.md, gap: SPACING.md }}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={8} accessibilityRole="button" accessibilityLabel="Go back">
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={{ flex: 1, fontSize: 20, fontWeight: FONT_WEIGHT.bold, color: colors.text }}>Bills</Text>
      </View>

      {/* Search */}
      <View style={{
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: colors.cardAlt, borderRadius: BORDER_RADIUS.md,
        marginHorizontal: SPACING.xl, marginBottom: SPACING.md,
        paddingHorizontal: 14, paddingVertical: 11, gap: 8,
      }}>
        <Ionicons name="search" size={16} color={colors.textMuted} />
        <TextInput
          style={{ flex: 1, fontSize: 15, color: colors.text, padding: 0 }}
          value={search}
          onChangeText={setSearch}
          placeholder="Search bills..."
          placeholderTextColor={colors.textMuted}
          returnKeyType="search"
          accessibilityLabel="Search bills"
        />
        {search.length > 0 && (
          <Pressable onPress={() => setSearch('')} hitSlop={8} accessibilityRole="button" accessibilityLabel="Clear search">
            <Ionicons name="close-circle" size={16} color={colors.textMuted} />
          </Pressable>
        )}
      </View>

      {/* Filter chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: SPACING.xl, marginBottom: SPACING.lg }}>
        {STATUS_CHIPS.map(chip => {
          const active = status === chip.key;
          return (
            <Pressable
              key={chip.key}
              onPress={() => setStatus(chip.key)}
              style={{
                paddingHorizontal: 14, paddingVertical: 7,
                borderRadius: 20,
                backgroundColor: active ? '#00843D' : colors.cardAlt,
              }}
              accessibilityRole="button"
              accessibilityLabel={`Filter by ${chip.label}`}
            >
              <Text style={{
                fontSize: 13, fontWeight: FONT_WEIGHT.semibold,
                color: active ? '#ffffff' : colors.textBody,
              }}>
                {chip.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {loading ? (
        <View style={{ paddingHorizontal: SPACING.xl }}>
          {[1, 2, 3].map(i => (
            <SkeletonLoader key={i} height={130} borderRadius={14} style={{ marginBottom: 12 }} />
          ))}
        </View>
      ) : (
        <FlashList
          data={sortedBills}
          keyExtractor={b => b.id}
          contentContainerStyle={{ paddingHorizontal: SPACING.xl, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
          renderItem={renderBillCard}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', paddingVertical: 60, gap: SPACING.md }}>
              <Ionicons name="document-outline" size={40} color={colors.textMuted} />
              <Text style={{ fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.semibold, color: colors.text }}>
                No bills match your filters
              </Text>
              <Text style={{ fontSize: FONT_SIZE.caption, color: colors.textMuted, textAlign: 'center' }}>
                {status === 'live'
                  ? 'No bills are currently before Parliament. Try "48th Parliament" to browse all.'
                  : 'Try a different search term or filter.'}
              </Text>
            </View>
          }
          onEndReached={loadMore}
          onEndReachedThreshold={0.3}
          ListFooterComponent={
            loadingMore ? (
              <ActivityIndicator color="#00843D" style={{ marginVertical: 20 }} />
            ) : null
          }
        />
      )}
    </SafeAreaView>
  );
}
