import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, Share, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { usePromises, PromiseStatus } from '../hooks/usePromises';
import { SkeletonLoader } from '../components/SkeletonLoader';

const STATUS_CONFIG: Record<PromiseStatus, { label: string; color: string; bg: string }> = {
  not_started:    { label: 'Not Started',     color: '#6B7280', bg: '#F3F4F6' },
  in_progress:    { label: 'In Progress',     color: '#2563EB', bg: '#EEF2FF' },
  partially_kept: { label: 'Partially Kept',  color: '#D97706', bg: '#FEF3C7' },
  kept:           { label: 'Kept',            color: '#059669', bg: '#D1FAE5' },
  broken:         { label: 'Broken',          color: '#DC2626', bg: '#FEE2E2' },
};

const FILTERS: { key: PromiseStatus | 'all'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'kept', label: 'Kept' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'broken', label: 'Broken' },
  { key: 'partially_kept', label: 'Partial' },
  { key: 'not_started', label: 'Not Started' },
];

export function PromiseTrackerScreen({ navigation }: any) {
  const { colors } = useTheme();
  const [statusFilter, setStatusFilter] = useState<PromiseStatus | 'all'>('all');
  const { promises, summary, loading, refresh } = usePromises(
    statusFilter === 'all' ? undefined : statusFilter,
  );

  const handleShare = () => {
    Share.share({
      message: `The government has kept ${summary.kept} of ${summary.total} promises.\n\n✅ ${summary.kept} Kept\n🔴 ${summary.broken} Broken\n🔵 ${summary.inProgress} In Progress\n🟡 ${summary.partiallyKept} Partially Kept\n⚪ ${summary.notStarted} Not Started\n\nTrack them all on Verity — verity.run`,
    });
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 12 }}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text }}>Promise Tracker</Text>
        <Pressable onPress={handleShare} hitSlop={12}>
          <Ionicons name="share-outline" size={22} color={colors.text} />
        </Pressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor="#00843D" />}
      >
        {/* Summary donut */}
        {!loading && summary.total > 0 && (
          <View style={{ alignItems: 'center', paddingVertical: 20 }}>
            {/* Simple donut using overlapping circles */}
            <View style={{ width: 120, height: 120, borderRadius: 60, borderWidth: 10, borderColor: '#E5E7EB', justifyContent: 'center', alignItems: 'center', position: 'relative' }}>
              {/* Overlay colored arcs via absolute positioned segments */}
              <Text style={{ fontSize: 28, fontWeight: '800', color: colors.text }}>{summary.kept}</Text>
              <Text style={{ fontSize: 11, color: '#6B7280', marginTop: -2 }}>of {summary.total} kept</Text>
            </View>

            {/* Legend row */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 12, marginTop: 16, paddingHorizontal: 20 }}>
              {[
                { label: 'Kept', count: summary.kept, color: '#059669' },
                { label: 'In Progress', count: summary.inProgress, color: '#2563EB' },
                { label: 'Partial', count: summary.partiallyKept, color: '#D97706' },
                { label: 'Broken', count: summary.broken, color: '#DC2626' },
                { label: 'Not Started', count: summary.notStarted, color: '#6B7280' },
              ].map(item => (
                <View key={item.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: item.color }} />
                  <Text style={{ fontSize: 12, color: '#6B7280' }}>{item.label}: {item.count}</Text>
                </View>
              ))}
            </View>

            {/* Progress bar summary */}
            <View style={{ flexDirection: 'row', height: 8, borderRadius: 4, overflow: 'hidden', marginTop: 16, marginHorizontal: 20, width: '90%' }}>
              {summary.kept > 0 && <View style={{ flex: summary.kept, backgroundColor: '#059669' }} />}
              {summary.partiallyKept > 0 && <View style={{ flex: summary.partiallyKept, backgroundColor: '#D97706' }} />}
              {summary.inProgress > 0 && <View style={{ flex: summary.inProgress, backgroundColor: '#2563EB' }} />}
              {summary.notStarted > 0 && <View style={{ flex: summary.notStarted, backgroundColor: '#D1D5DB' }} />}
              {summary.broken > 0 && <View style={{ flex: summary.broken, backgroundColor: '#DC2626' }} />}
            </View>
          </View>
        )}

        {/* Filter pills */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 8, paddingBottom: 12 }}>
          {FILTERS.map(f => {
            const active = statusFilter === f.key;
            return (
              <Pressable
                key={f.key}
                style={{ paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: active ? '#00843D' : colors.cardAlt }}
                onPress={() => setStatusFilter(f.key)}
              >
                <Text style={{ fontSize: 13, fontWeight: '600', color: active ? '#fff' : colors.textBody }}>{f.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Promise cards */}
        <View style={{ paddingHorizontal: 20, paddingBottom: 40 }}>
          {loading ? (
            [1, 2, 3, 4].map(i => <SkeletonLoader key={i} height={100} borderRadius={12} style={{ marginBottom: 12 }} />)
          ) : promises.length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: 40 }}>
              <Ionicons name="clipboard-outline" size={48} color={colors.textMuted} />
              <Text style={{ fontSize: 16, fontWeight: '600', color: colors.text, marginTop: 12 }}>No promises found</Text>
              <Text style={{ fontSize: 14, color: '#6B7280', marginTop: 4 }}>Try a different filter.</Text>
            </View>
          ) : (
            promises.map(promise => {
              const config = STATUS_CONFIG[promise.status];
              const isInProgress = promise.status === 'in_progress';
              return (
                <View key={promise.id} style={{ backgroundColor: colors.card, borderRadius: 12, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 3, elevation: 1 }}>
                  {/* Status pill + category */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <View style={{ backgroundColor: config.bg, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10 }}>
                      <Text style={{ fontSize: 11, fontWeight: '700', color: config.color }}>{config.label}</Text>
                    </View>
                    {promise.category && (
                      <Text style={{ fontSize: 11, color: '#9CA3AF' }}>{promise.category}</Text>
                    )}
                  </View>

                  {/* Title */}
                  <Text style={{ fontSize: 16, fontWeight: '600', color: colors.text, lineHeight: 22, marginBottom: 4 }}>{promise.title}</Text>

                  {/* Description */}
                  {promise.description && (
                    <Text style={{ fontSize: 14, color: '#6B7280', lineHeight: 20, marginBottom: 8 }} numberOfLines={3}>{promise.description}</Text>
                  )}

                  {/* Progress bar for in_progress */}
                  {isInProgress && (
                    <View style={{ height: 6, borderRadius: 3, backgroundColor: '#E5E7EB', overflow: 'hidden', marginBottom: 8 }}>
                      <View style={{ width: '50%', height: 6, borderRadius: 3, backgroundColor: '#2563EB' }} />
                    </View>
                  )}

                  {/* Source quote */}
                  {promise.source_quote && (
                    <Text style={{ fontSize: 13, color: '#9CA3AF', fontStyle: 'italic', lineHeight: 18, marginBottom: 4 }} numberOfLines={2}>
                      "{promise.source_quote}"
                    </Text>
                  )}

                  {/* Progress notes */}
                  {promise.progress_notes && (
                    <Text style={{ fontSize: 13, color: '#6B7280', marginTop: 4 }} numberOfLines={2}>{promise.progress_notes}</Text>
                  )}

                  {/* Related bills */}
                  {promise.related_bill_ids && promise.related_bill_ids.length > 0 && (
                    <Pressable
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 }}
                      onPress={() => navigation.navigate('BillDetail', { billId: promise.related_bill_ids![0] })}
                    >
                      <Ionicons name="document-text-outline" size={14} color="#00843D" />
                      <Text style={{ fontSize: 13, fontWeight: '600', color: '#00843D' }}>
                        {promise.related_bill_ids.length} related bill{promise.related_bill_ids.length !== 1 ? 's' : ''} →
                      </Text>
                    </Pressable>
                  )}
                </View>
              );
            })
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
