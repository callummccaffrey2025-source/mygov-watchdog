import React from 'react';
import {
  View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useSubscription } from '../hooks/useSubscription';
import { useUser } from '../context/UserContext';
import { useTheme } from '../context/ThemeContext';

const FEATURES: { label: string; free: boolean; pro: boolean }[] = [
  { label: 'Browse bills & MPs',          free: true,  pro: true  },
  { label: 'Search parliament',           free: true,  pro: true  },
  { label: 'Follow MPs',                  free: true,  pro: true  },
  { label: 'Latest from Parliament',      free: true,  pro: true  },
  { label: 'AI Impact Analysis',          free: false, pro: true  },
  { label: 'Advanced MP Analytics',       free: false, pro: true  },
  { label: 'Export voting data as CSV',   free: false, pro: true  },
  { label: 'Priority support',            free: false, pro: true  },
];

export function SubscriptionScreen({ navigation }: any) {
  const { user } = useUser();
  const { isPro, loading, subscribe, restore } = useSubscription(user?.id);
  const { colors } = useTheme();
  const [subscribing, setSubscribing] = React.useState(false);
  const [restoring, setRestoring] = React.useState(false);
  const [done, setDone] = React.useState(false);

  const handleSubscribe = async () => {
    setSubscribing(true);
    await subscribe();
    setSubscribing(false);
    setDone(true);
  };

  const handleRestore = async () => {
    setRestoring(true);
    await restore();
    setRestoring(false);
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Hero */}
        <Text style={styles.crown}>👑</Text>
        <Text style={[styles.title, { color: colors.text }]}>Verity Pro</Text>
        <Text style={styles.price}>$4.99 / month</Text>
        <Text style={styles.trial}>7-day free trial</Text>

        {/* Feature table */}
        <View style={[styles.table, { borderColor: colors.border }]}>
          <View style={[styles.tableHeader, { backgroundColor: colors.surface }]}>
            <Text style={[styles.colLabel, { flex: 1 }]} />
            <Text style={[styles.colHead, { color: colors.textBody }]}>FREE</Text>
            <Text style={[styles.colHead, { color: '#00843D' }]}>PRO</Text>
          </View>
          {FEATURES.map((f) => (
            <View key={f.label} style={[styles.tableRow, { borderTopColor: colors.border }]}>
              <Text style={[styles.featureLabel, { color: colors.text }]}>{f.label}</Text>
              <View style={styles.colCell}>
                <Ionicons
                  name={f.free ? 'checkmark-circle' : 'close-circle'}
                  size={20}
                  color={f.free ? '#00843D' : '#dde3e9'}
                />
              </View>
              <View style={styles.colCell}>
                <Ionicons name="checkmark-circle" size={20} color="#00843D" />
              </View>
            </View>
          ))}
        </View>

        {!user ? (
          <View style={styles.signInNote}>
            <Ionicons name="lock-closed-outline" size={18} color="#9aabb8" />
            <Text style={styles.signInText}>Sign in to start your free trial</Text>
          </View>
        ) : isPro || done ? (
          <View style={styles.successCard}>
            <Ionicons name="checkmark-circle" size={28} color="#00843D" />
            <Text style={styles.successText}>You're on Verity Pro!</Text>
          </View>
        ) : (
          <Pressable
            style={[styles.cta, subscribing && styles.ctaDisabled]}
            onPress={handleSubscribe}
            disabled={subscribing}
          >
            {subscribing
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.ctaText}>Start Free Trial — 7 Days Free</Text>
            }
          </Pressable>
        )}

        <Pressable onPress={handleRestore} disabled={restoring} style={styles.restoreBtn}>
          {restoring
            ? <ActivityIndicator color="#9aabb8" size="small" />
            : <Text style={styles.restoreText}>Restore Purchase</Text>
          }
        </Pressable>

        <Text style={styles.fine}>Cancel anytime. Pricing in AUD.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#ffffff' },
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4 },
  backBtn: { width: 40, height: 40, justifyContent: 'center' },
  content: { paddingHorizontal: 24, paddingBottom: 40, alignItems: 'center' },
  crown: { fontSize: 64, marginTop: 16, marginBottom: 8 },
  title: { fontSize: 30, fontWeight: '800', color: '#1a2332', marginBottom: 6 },
  price: { fontSize: 22, fontWeight: '700', color: '#00843D', marginBottom: 4 },
  trial: { fontSize: 14, color: '#9aabb8', marginBottom: 32 },
  table: { width: '100%', borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: '#e8ecf0', marginBottom: 28 },
  tableHeader: { flexDirection: 'row', backgroundColor: '#f5f7fa', paddingVertical: 10, paddingHorizontal: 16 },
  tableRow: { flexDirection: 'row', paddingVertical: 12, paddingHorizontal: 16, borderTopWidth: 1, borderTopColor: '#e8ecf0', alignItems: 'center' },
  colLabel: { flex: 1 },
  colHead: { width: 52, textAlign: 'center', fontSize: 12, fontWeight: '700', color: '#5a6a7a' },
  colCell: { width: 52, alignItems: 'center' },
  featureLabel: { flex: 1, fontSize: 14, color: '#1a2332' },
  cta: {
    width: '100%', backgroundColor: '#00843D', borderRadius: 16,
    paddingVertical: 17, alignItems: 'center', marginBottom: 16,
  },
  ctaDisabled: { opacity: 0.6 },
  ctaText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  restoreBtn: { paddingVertical: 8, marginBottom: 12 },
  restoreText: { color: '#9aabb8', fontSize: 14 },
  fine: { fontSize: 12, color: '#c4cdd5' },
  signInNote: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 24 },
  signInText: { color: '#9aabb8', fontSize: 14 },
  successCard: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 24 },
  successText: { fontSize: 17, fontWeight: '700', color: '#00843D' },
});
