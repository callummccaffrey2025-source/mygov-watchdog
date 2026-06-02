import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useTheme } from '../context/ThemeContext';

interface DonorRow {
  name: string;
  total: number;
  receipts: number;
  top_recipients: string[];
}

export function DebugDonationsScreen({ navigation }: any) {
  const { colors } = useTheme();
  const [donors, setDonors] = useState<DonorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ donors: 0, recipients: 0, receipts: 0, total: 0 });

  useEffect(() => {
    (async () => {
      // This queries the aec_receipts/donors/recipients tables
      // For now, use the existing individual_donations as fallback since
      // the new tables may only be on dev branch
      try {
        const { data, error } = await supabase.rpc('get_top_aec_donors', { p_limit: 20 });
        if (!error && data) {
          setDonors(data);
        }
      } catch {
        // RPC may not exist — fall back to direct query
        try {
          const { data } = await supabase
            .from('individual_donations')
            .select('donor_name, amount, recipient_name')
            .order('amount', { ascending: false })
            .limit(100);

          if (data) {
            const byDonor = new Map<string, { total: number; count: number; recipients: Set<string> }>();
            for (const d of data) {
              const existing = byDonor.get(d.donor_name) || { total: 0, count: 0, recipients: new Set<string>() };
              existing.total += Number(d.amount);
              existing.count++;
              if (d.recipient_name) existing.recipients.add(d.recipient_name);
              byDonor.set(d.donor_name, existing);
            }
            const rows = Array.from(byDonor.entries())
              .map(([name, v]) => ({ name, total: v.total, receipts: v.count, top_recipients: Array.from(v.recipients).slice(0, 3) }))
              .sort((a, b) => b.total - a.total)
              .slice(0, 20);
            setDonors(rows);
            setStats({ donors: byDonor.size, recipients: 0, receipts: data.length, total: data.reduce((s, d) => s + Number(d.amount), 0) });
          }
        } catch { /* silent */ }
      }
      setLoading(false);
    })();
  }, []);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <View style={{ flexDirection: 'row', alignItems: 'center', padding: 20, gap: 12 }}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={8}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={{ flex: 1, fontSize: 20, fontWeight: '700', color: colors.text }}>AEC Donations (Debug)</Text>
      </View>

      <View style={{ flexDirection: 'row', paddingHorizontal: 20, gap: 12, marginBottom: 16 }}>
        <View style={{ flex: 1, backgroundColor: colors.card, borderRadius: 10, padding: 12, alignItems: 'center' }}>
          <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text }}>{stats.receipts.toLocaleString()}</Text>
          <Text style={{ fontSize: 11, color: colors.textMuted }}>Receipts</Text>
        </View>
        <View style={{ flex: 1, backgroundColor: colors.card, borderRadius: 10, padding: 12, alignItems: 'center' }}>
          <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text }}>{stats.donors.toLocaleString()}</Text>
          <Text style={{ fontSize: 11, color: colors.textMuted }}>Donors</Text>
        </View>
        <View style={{ flex: 1, backgroundColor: colors.card, borderRadius: 10, padding: 12, alignItems: 'center' }}>
          <Text style={{ fontSize: 18, fontWeight: '800', color: '#00843D' }}>${(stats.total / 1e6).toFixed(0)}M</Text>
          <Text style={{ fontSize: 11, color: colors.textMuted }}>Total</Text>
        </View>
      </View>

      <Text style={{ paddingHorizontal: 20, fontSize: 11, color: '#DC3545', marginBottom: 12 }}>
        AEC discloses donations above the indexed threshold (~$16,900). This is large-donor data, not complete donation data.
      </Text>

      {loading ? (
        <ActivityIndicator color="#00843D" style={{ marginTop: 40 }} />
      ) : (
        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}>
          {donors.map((d, i) => (
            <View key={i} style={{
              backgroundColor: colors.card, borderRadius: 12, padding: 14,
              marginBottom: 8, borderLeftWidth: 3, borderLeftColor: i < 3 ? '#DC3545' : '#F59E0B',
            }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text, flex: 1 }} numberOfLines={1}>{d.name}</Text>
                <Text style={{ fontSize: 14, fontWeight: '800', color: '#DC3545' }}>
                  ${d.total >= 1e6 ? `${(d.total / 1e6).toFixed(1)}M` : d.total >= 1e3 ? `${(d.total / 1e3).toFixed(0)}k` : d.total.toFixed(0)}
                </Text>
              </View>
              <Text style={{ fontSize: 11, color: colors.textMuted }}>{d.receipts} receipt{d.receipts !== 1 ? 's' : ''}</Text>
              {d.top_recipients.length > 0 && (
                <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 2 }} numberOfLines={1}>
                  To: {d.top_recipients.join(', ')}
                </Text>
              )}
            </View>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
