import React from 'react';
import { View, Text, StyleSheet, FlatList, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useBills } from '../hooks/useBills';
import { BillCard } from '../components/BillCard';
import { SkeletonLoader } from '../components/SkeletonLoader';

const TOPIC_ICONS: Record<string, string> = {
  housing:        '🏠',
  healthcare:     '🏥',
  economy:        '💰',
  climate:        '🌿',
  immigration:    '✈️',
  defence:        '🛡️',
  education:      '📚',
  cost_of_living: '🛒',
  indigenous:     '🪃',
  technology:     '💻',
  agriculture:    '🌾',
  infrastructure: '🚧',
  foreign_policy: '🌏',
  justice:        '⚖️',
};

export function TopicBillsScreen({ route, navigation }: any) {
  const { colors } = useTheme();
  const { category, label } = route.params as { category: string; label: string };
  const { bills, loading } = useBills({ category, limit: 60 });
  const icon = TOPIC_ICONS[category] ?? '📋';

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Pressable style={styles.back} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={styles.headerIcon}>{icon}</Text>
        <Text style={[styles.title, { color: colors.text }]}>{label}</Text>
      </View>

      {loading ? (
        <View style={styles.content}>
          {[1, 2, 3].map(i => (
            <SkeletonLoader key={i} height={140} borderRadius={14} style={{ marginBottom: 12 }} />
          ))}
        </View>
      ) : bills.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>{icon}</Text>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>No {label} bills yet</Text>
          <Text style={[styles.emptyBody, { color: colors.textMuted }]}>
            Bills tagged with {label} will appear here as Parliament debates them.
          </Text>
        </View>
      ) : (
        <FlatList
          data={bills}
          keyExtractor={b => b.id}
          contentContainerStyle={styles.content}
          windowSize={5}
          maxToRenderPerBatch={10}
          renderItem={({ item }) => (
            <BillCard
              bill={item}
              onPress={() => navigation.navigate('BillDetail', { bill: item })}
            />
          )}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <Text style={[styles.count, { color: colors.textMuted }]}>{bills.length} bill{bills.length !== 1 ? 's' : ''}</Text>
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
    paddingBottom: 16,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e8ecf0',
  },
  back: { padding: 2 },
  headerIcon: { fontSize: 22 },
  title: { fontSize: 20, fontWeight: '800', color: '#1a2332' },
  content: { padding: 20, paddingBottom: 40 },
  count: { fontSize: 13, color: '#9aabb8', marginBottom: 12 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, gap: 12 },
  emptyIcon: { fontSize: 48 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#1a2332' },
  emptyBody: { fontSize: 14, color: '#9aabb8', textAlign: 'center', lineHeight: 20 },
});
