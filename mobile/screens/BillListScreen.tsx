import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, FlatList, Pressable, TextInput, ActivityIndicator } from 'react-native';
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

type StatusFilter = 'live' | 'recent' | 'all' | 'archived';

const STATUS_CHIPS: { key: StatusFilter; label: string }[] = [
  { key: 'live',     label: 'Live' },
  { key: 'recent',   label: 'Recent' },
  { key: 'all',      label: 'All' },
  { key: 'archived', label: 'Archived' },
];

const BILL_SELECT = 'id,title,short_title,current_status,status,summary_plain,summary_full,expanded_summary,categories,date_introduced,last_updated,chamber_introduced,origin_chamber,level,aph_url,sponsor_id,sponsor_party,narrative_status,is_live,days_since_movement,politics_cache';

function buildQuery(search: string, status: StatusFilter, offset: number) {
  let q = supabase.from('bills').select(BILL_SELECT);

  if (status === 'live') {
    // Only bills actively before Parliament
    q = q.neq('current_status', 'Historical')
      .not('current_status', 'ilike', '%enacted%')
      .not('current_status', 'ilike', '%defeated%')
      .not('current_status', 'ilike', '%withdrawn%')
      .not('current_status', 'ilike', '%lapsed%');
  } else if (status === 'recent') {
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    q = q.neq('current_status', 'Historical')
      .gte('last_updated', ninetyDaysAgo);
  } else if (status === 'archived') {
    q = q.eq('current_status', 'Historical');
  } else {
    // All: exclude Historical to avoid 6000+ archive rows
    q = q.neq('current_status', 'Historical');
  }

  if (search.length > 1) {
    q = q.ilike('title', `%${search}%`);
  }

  q = q.order('last_updated', { ascending: false, nullsFirst: false });
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

  // Sort: live bills first, then by last_updated
  const sortedBills = useMemo(() => {
    if (status !== 'all') return bills;
    const live: Bill[] = [];
    const rest: Bill[] = [];
    bills.forEach(b => {
      const e = enrichBill(b);
      if (e.isLive) live.push(b);
      else rest.push(b);
    });
    return [...live, ...rest];
  }, [bills, status]);

  const renderBillCard = useCallback(({ item }: { item: Bill }) => {
    const e = enrichBill(item);
    return (
      <BillCard
        bill={item}
        onPress={() => navigation.navigate('BillDetail', { bill: item })}
        dimmed={!e.isLive && status === 'all'}
      />
    );
  }, [navigation, status]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.xl, paddingTop: SPACING.lg, paddingBottom: SPACING.md, gap: SPACING.md }}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={8}>
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
        />
        {search.length > 0 && (
          <Pressable onPress={() => setSearch('')} hitSlop={8}>
            <Ionicons name="close-circle" size={16} color={colors.textMuted} />
          </Pressable>
        )}
      </View>

      {/* Filter chips */}
      <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: SPACING.xl, marginBottom: SPACING.lg }}>
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
      </View>

      {loading ? (
        <View style={{ paddingHorizontal: SPACING.xl }}>
          {[1, 2, 3].map(i => (
            <SkeletonLoader key={i} height={130} borderRadius={14} style={{ marginBottom: 12 }} />
          ))}
        </View>
      ) : (
        <FlatList
          data={sortedBills}
          keyExtractor={b => b.id}
          contentContainerStyle={{ paddingHorizontal: SPACING.xl, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
          windowSize={5}
          maxToRenderPerBatch={10}
          removeClippedSubviews
          renderItem={renderBillCard}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', paddingVertical: 60, gap: SPACING.md }}>
              <Ionicons name="document-outline" size={40} color={colors.textMuted} />
              <Text style={{ fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.semibold, color: colors.text }}>
                No bills match your filters
              </Text>
              <Text style={{ fontSize: FONT_SIZE.caption, color: colors.textMuted, textAlign: 'center' }}>
                {status === 'live'
                  ? 'Try "All" to see recently active bills, or search by title.'
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
