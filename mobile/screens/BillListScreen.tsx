import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, Pressable, TextInput, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { Bill } from '../hooks/useBills';
import { BillCard } from '../components/BillCard';
import { SkeletonLoader } from '../components/SkeletonLoader';
import { useTheme } from '../context/ThemeContext';

const PAGE_SIZE = 20;

type StatusFilter = 'all' | 'active' | 'passed' | 'defeated';
type SortOrder = 'newest' | 'oldest';

const STATUS_CHIPS: { key: StatusFilter; label: string }[] = [
  { key: 'all',      label: 'All' },
  { key: 'active',   label: 'Active' },
  { key: 'passed',   label: 'Passed' },
  { key: 'defeated', label: 'Defeated' },
];

function buildQuery(search: string, status: StatusFilter, sort: SortOrder, offset: number) {
  let q = supabase
    .from('bills')
    .select('id,title,short_title,current_status,status,summary_plain,summary_full,categories,date_introduced,last_updated,chamber_introduced,origin_chamber,level,aph_url');

  // Status filter
  if (status === 'active') {
    q = q.neq('current_status', 'In search index');
  } else if (status === 'passed') {
    q = q.or('current_status.ilike.%passed%,current_status.ilike.%assent%');
  } else if (status === 'defeated') {
    q = q.or('current_status.ilike.%defeated%,current_status.ilike.%withdrawn%');
  } else {
    q = q.neq('current_status', 'In search index');
  }

  if (search.length > 1) {
    q = q.ilike('title', `%${search}%`);
  }

  q = q.order('date_introduced', { ascending: sort === 'oldest', nullsFirst: false });
  q = q.range(offset, offset + PAGE_SIZE - 1);
  return q;
}

export function BillListScreen({ navigation }: any) {
  const { colors } = useTheme();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [sort, setSort] = useState<SortOrder>('newest');
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const fetchPage = useCallback(async (offset: number, replace: boolean) => {
    if (offset === 0) setLoading(true); else setLoadingMore(true);
    const { data, error } = await buildQuery(debouncedSearch, status, sort, offset);
    if (!error && data) {
      setBills(prev => replace ? data as Bill[] : [...prev, ...data as Bill[]]);
      setHasMore(data.length === PAGE_SIZE);
    }
    if (offset === 0) setLoading(false); else setLoadingMore(false);
  }, [debouncedSearch, status, sort]);

  // Reset and refetch when filters change
  useEffect(() => {
    fetchPage(0, true);
  }, [fetchPage]);

  const loadMore = () => {
    if (!loadingMore && hasMore) fetchPage(bills.length, false);
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.back} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={[styles.title, { color: colors.text }]}>All Bills</Text>
        <Pressable
          style={styles.sortBtn}
          onPress={() => setSort(s => s === 'newest' ? 'oldest' : 'newest')}
        >
          <Ionicons name={sort === 'newest' ? 'arrow-down' : 'arrow-up'} size={16} color={colors.textBody} />
          <Text style={[styles.sortLabel, { color: colors.textBody }]}>{sort === 'newest' ? 'Newest' : 'Oldest'}</Text>
        </Pressable>
      </View>

      {/* Search */}
      <View style={[styles.searchWrap, { backgroundColor: colors.cardAlt, borderColor: colors.border }]}>
        <Ionicons name="search" size={16} color={colors.textMuted} />
        <TextInput
          style={[styles.searchInput, { color: colors.text }]}
          value={search}
          onChangeText={setSearch}
          placeholder="Search bill titles..."
          placeholderTextColor={colors.textMuted}
          returnKeyType="search"
        />
        {search.length > 0 && (
          <Pressable onPress={() => setSearch('')} hitSlop={8}>
            <Ionicons name="close-circle" size={16} color="#c4cdd5" />
          </Pressable>
        )}
      </View>

      {/* Status chips */}
      <View style={styles.chips}>
        {STATUS_CHIPS.map(chip => (
          <Pressable
            key={chip.key}
            style={[styles.chip, status === chip.key && styles.chipActive, !(status === chip.key) && { backgroundColor: colors.cardAlt, borderColor: colors.border }]}
            onPress={() => setStatus(chip.key)}
          >
            <Text style={[styles.chipText, { color: colors.textBody }, status === chip.key && styles.chipTextActive]}>
              {chip.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {loading ? (
        <View style={styles.content}>
          {[1, 2, 3].map(i => (
            <SkeletonLoader key={i} height={140} borderRadius={14} style={{ marginBottom: 12 }} />
          ))}
        </View>
      ) : (
        <FlatList
          data={bills}
          keyExtractor={b => b.id}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          windowSize={5}
          maxToRenderPerBatch={10}
          removeClippedSubviews
          renderItem={({ item }) => (
            <BillCard
              bill={item}
              onPress={() => navigation.navigate('BillDetail', { bill: item })}
            />
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="document-outline" size={40} color={colors.border} />
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>No bills match your filters.</Text>
            </View>
          }
          onEndReached={loadMore}
          onEndReachedThreshold={0.3}
          ListFooterComponent={
            loadingMore ? (
              <ActivityIndicator color="#00843D" style={{ marginVertical: 20 }} />
            ) : hasMore && bills.length > 0 ? (
              <Pressable style={[styles.loadMoreBtn, { backgroundColor: colors.cardAlt }]} onPress={loadMore}>
                <Text style={[styles.loadMoreText, { color: colors.textBody }]}>Load more</Text>
              </Pressable>
            ) : null
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#ffffff' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    gap: 12,
  },
  back: { padding: 2 },
  title: { flex: 1, fontSize: 20, fontWeight: '800', color: '#1a2332' },
  sortBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  sortLabel: { fontSize: 13, color: '#5a6a7a', fontWeight: '600' },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    marginHorizontal: 20,
    marginBottom: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    gap: 8,
    borderWidth: 1,
    borderColor: '#e8ecf0',
  },
  searchInput: { flex: 1, fontSize: 15, color: '#1a2332', padding: 0 },
  chips: { flexDirection: 'row', gap: 8, paddingHorizontal: 20, marginBottom: 16 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: 20, backgroundColor: '#f3f4f6',
    borderWidth: 1, borderColor: '#e8ecf0',
  },
  chipActive: { backgroundColor: '#00843D', borderColor: '#00843D' },
  chipText: { fontSize: 13, fontWeight: '600', color: '#5a6a7a' },
  chipTextActive: { color: '#ffffff' },
  content: { paddingHorizontal: 20, paddingBottom: 40 },
  empty: { alignItems: 'center', paddingVertical: 60, gap: 12 },
  emptyText: { fontSize: 14, color: '#9aabb8' },
  loadMoreBtn: {
    marginVertical: 8,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
  },
  loadMoreText: { fontSize: 14, fontWeight: '600', color: '#5a6a7a' },
});
