import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Party } from '../hooks/useParties';
import { useMembers } from '../hooks/useMembers';
import { MemberCard } from '../components/MemberCard';
import { SkeletonLoader } from '../components/SkeletonLoader';
import { supabase } from '../lib/supabase';
import { usePartyDonations, DONOR_TYPE_LABELS } from '../hooks/useDonations';
import { useTheme } from '../context/ThemeContext';
import { decodeHtml } from '../utils/decodeHtml';

const CATEGORY_LABELS: Record<string, string> = {
  housing: 'Housing',
  healthcare: 'Healthcare',
  economy: 'Economy',
  climate: 'Climate',
  immigration: 'Immigration',
  defence: 'Defence',
  education: 'Education',
  cost_of_living: 'Cost of Living',
};

export function PartyProfileScreen({ route, navigation }: any) {
  const { colors } = useTheme();
  const { party }: { party: Party } = route.params;
  const { members, loading: membersLoading } = useMembers({ partyId: party.id });
  const [policies, setPolicies] = useState<{ category: string; summary_plain: string }[]>([]);
  const { donations, totalAmount } = usePartyDonations(party.id);
  const partyColour = party.colour || '#9aabb8';

  useEffect(() => {
    supabase.from('party_policies').select('category,summary_plain').eq('party_id', party.id).then(({ data }) => {
      if (data) setPolicies(data);
    });
  }, [party.id]);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <Pressable style={styles.back} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Pressable>

        {/* Header */}
        <View style={[styles.header, { backgroundColor: partyColour }]}>
          <Text style={styles.partyName}>{party.name}</Text>
          <Text style={styles.partyAbbr}>{party.short_name || party.abbreviation}</Text>
        </View>

        <View style={styles.content}>
          {/* Policies */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Key Policies</Text>
            {policies.length > 0
              ? policies.map(p => (
                <View key={p.category} style={[styles.policyCard, { backgroundColor: colors.surface }]}>
                  <Text style={[styles.policyCategory, { color: partyColour }]}>{CATEGORY_LABELS[p.category] || p.category}</Text>
                  <Text style={[styles.policyText, { color: colors.text }]}>{decodeHtml(p.summary_plain)}</Text>
                </View>
              ))
              : (
                <View style={styles.emptyState}>
                  <Ionicons name="document-text-outline" size={20} color={colors.textMuted} />
                  <Text style={[styles.empty, { color: colors.textMuted }]}>No policy summaries available yet.</Text>
                </View>
              )
            }
          </View>

          {/* Funding */}
          {donations.length > 0 && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Declared Donations (2023-24)</Text>
              <View style={styles.fundingTotal}>
                <Text style={[styles.fundingTotalLabel, { color: colors.textMuted }]}>Total declared</Text>
                <Text style={[styles.fundingTotalAmount, { color: partyColour }]}>
                  ${totalAmount.toLocaleString('en-AU')}
                </Text>
              </View>
              {/* Breakdown by type */}
              {(() => {
                const byType: Record<string, number> = {};
                donations.forEach(d => {
                  byType[d.donor_type] = (byType[d.donor_type] || 0) + Number(d.amount);
                });
                const parts = Object.entries(byType)
                  .sort((a, b) => b[1] - a[1])
                  .map(([type, amt]) => `${DONOR_TYPE_LABELS[type] ?? type} ${totalAmount > 0 ? Math.round(amt / totalAmount * 100) : 0}%`);
                return <Text style={[styles.fundingBreakdown, { color: colors.textBody }]}>{parts.join(' · ')}</Text>;
              })()}
              <Text style={[styles.fundingSubhead, { color: colors.textMuted }]}>Top donors</Text>
              {donations.slice(0, 5).map(d => (
                <View key={d.id} style={[styles.donorRow, { borderTopColor: colors.border }]}>
                  <Text style={[styles.donorName, { color: colors.text }]} numberOfLines={1}>{d.donor_name}</Text>
                  <Text style={[styles.donorAmount, { color: colors.text }]}>${Number(d.amount).toLocaleString('en-AU')}</Text>
                </View>
              ))}
              <Text style={[styles.fundingSource, { color: colors.borderStrong }]}>Source: AEC Transparency Register</Text>
            </View>
          )}

          {/* Members */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Members ({members.length})</Text>
            {membersLoading
              ? [1, 2, 3].map(i => <SkeletonLoader key={i} height={64} borderRadius={12} style={{ marginBottom: 8 }} />)
              : members.map(m => (
                <MemberCard key={m.id} member={m} onPress={() => navigation.navigate('MemberProfile', { member: m })} />
              ))
            }
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#ffffff' },
  back: { padding: 20, paddingBottom: 0 },
  header: { paddingHorizontal: 24, paddingVertical: 32, alignItems: 'center', gap: 4 },
  partyName: { fontSize: 22, fontWeight: '800', color: '#ffffff', textAlign: 'center' },
  partyAbbr: { fontSize: 14, color: 'rgba(255,255,255,0.8)', fontWeight: '500' },
  content: { padding: 20 },
  section: { marginBottom: 28 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#1a2332', marginBottom: 12 },
  policyCard: { backgroundColor: '#f8f9fa', borderRadius: 12, padding: 16, marginBottom: 10, gap: 6 },
  policyCategory: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
  policyText: { fontSize: 14, color: '#1a2332', lineHeight: 21 },
  emptyState: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  empty: { color: '#9aabb8', fontSize: 14 },
  fundingTotal: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  fundingTotalLabel: { fontSize: 13, color: '#9aabb8', fontWeight: '600' },
  fundingTotalAmount: { fontSize: 22, fontWeight: '800' },
  fundingBreakdown: { fontSize: 12, color: '#5a6a7a', marginBottom: 16 },
  fundingSubhead: { fontSize: 12, fontWeight: '700', color: '#9aabb8', textTransform: 'uppercase', marginBottom: 8 },
  donorRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#e8ecf0' },
  donorName: { flex: 1, fontSize: 13, color: '#1a2332', marginRight: 8 },
  donorAmount: { fontSize: 13, fontWeight: '700', color: '#1a2332' },
  fundingSource: { fontSize: 11, color: '#c4cdd5', marginTop: 10 },
});
