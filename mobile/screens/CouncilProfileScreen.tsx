import React from 'react';
import {
  View, Text, StyleSheet, Pressable, ScrollView, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Council } from '../hooks/useCouncils';
import { useCouncillors } from '../hooks/useCouncillors';
import { SkeletonLoader } from '../components/SkeletonLoader';
import { useTheme } from '../context/ThemeContext';

const TYPE_LABELS: Record<string, string> = {
  city: 'City Council',
  shire: 'Shire Council',
  regional: 'Regional Council',
};

const TYPE_COLOURS: Record<string, string> = {
  city: '#0066CC',
  shire: '#00843D',
  regional: '#7C3AED',
};

const ROLE_COLOURS: Record<string, { bg: string; text: string }> = {
  'Mayor':            { bg: '#00843D', text: '#ffffff' },
  'Lord Mayor':       { bg: '#00843D', text: '#ffffff' },
  'Deputy Mayor':     { bg: '#0066CC', text: '#ffffff' },
  'Deputy Lord Mayor':{ bg: '#0066CC', text: '#ffffff' },
};

function formatPopulation(n: number): string {
  return n.toLocaleString('en-AU');
}

export function CouncilProfileScreen({ route, navigation }: any) {
  const { council }: { council: Council } = route.params;
  const { councillors, loading: councillorsLoading } = useCouncillors(council.id);
  const { colors } = useTheme();

  const typeLabel = TYPE_LABELS[council.type] || council.type;
  const typeColour = TYPE_COLOURS[council.type] || '#9aabb8';

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Nav */}
        <Pressable style={styles.back} onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel="Go back">
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Pressable>

        {/* Header */}
        <View style={[styles.header, { backgroundColor: typeColour + '15' }]}>
          <View style={styles.headerTop}>
            <View style={[styles.typeBadge, { backgroundColor: typeColour }]}>
              <Text style={styles.typeBadgeText}>{typeLabel}</Text>
            </View>
            <View style={[styles.stateBadge, { backgroundColor: colors.cardAlt }]}>
              <Text style={[styles.stateBadgeText, { color: colors.textBody }]}>{council.state}</Text>
            </View>
          </View>
          <Text style={[styles.councilName, { color: colors.text }]}>{council.name}</Text>
        </View>

        {/* Stats bar */}
        {(council.population || council.area_sqkm) ? (
          <View style={[styles.statsBar, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
            {council.population ? (
              <View style={styles.statItem}>
                <Ionicons name="people-outline" size={16} color={colors.textBody} />
                <Text style={[styles.statValue, { color: colors.text }]}>{formatPopulation(council.population)}</Text>
                <Text style={[styles.statLabel, { color: colors.textMuted }]}>residents</Text>
              </View>
            ) : null}
            {council.population && council.area_sqkm ? (
              <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
            ) : null}
            {council.area_sqkm ? (
              <View style={styles.statItem}>
                <Ionicons name="map-outline" size={16} color={colors.textBody} />
                <Text style={[styles.statValue, { color: colors.text }]}>{Number(council.area_sqkm).toLocaleString('en-AU', { maximumFractionDigits: 1 })}</Text>
                <Text style={[styles.statLabel, { color: colors.textMuted }]}>km²</Text>
              </View>
            ) : null}
          </View>
        ) : null}

        <View style={styles.content}>
          {/* Info card */}
          <View style={[styles.card, { backgroundColor: colors.surface }]}>
            {council.mayor_name ? (
              <View style={styles.infoRow}>
                <Ionicons name="person-outline" size={18} color={colors.textBody} />
                <View style={styles.infoText}>
                  <Text style={[styles.infoLabel, { color: colors.textMuted }]}>Mayor</Text>
                  <Text style={[styles.infoValue, { color: colors.text }]}>{council.mayor_name}</Text>
                </View>
              </View>
            ) : null}

            {council.phone ? (
              <>
                {council.mayor_name && <View style={[styles.divider, { backgroundColor: colors.border }]} />}
                <Pressable
                  style={styles.infoRow}
                  onPress={() => Linking.openURL(`tel:${council.phone!.replace(/\s/g, '')}`)}
                  accessibilityRole="button"
                  accessibilityLabel={`Call ${council.name}`}
                >
                  <Ionicons name="call-outline" size={18} color={colors.textBody} />
                  <View style={styles.infoText}>
                    <Text style={[styles.infoLabel, { color: colors.textMuted }]}>Phone</Text>
                    <Text style={[styles.infoValue, styles.link]}>{council.phone}</Text>
                  </View>
                </Pressable>
              </>
            ) : null}

            {council.address ? (
              <>
                <View style={[styles.divider, { backgroundColor: colors.border }]} />
                <View style={styles.infoRow}>
                  <Ionicons name="location-outline" size={18} color={colors.textBody} />
                  <View style={styles.infoText}>
                    <Text style={[styles.infoLabel, { color: colors.textMuted }]}>Address</Text>
                    <Text style={[styles.infoValue, { color: colors.text }]}>{council.address}</Text>
                  </View>
                </View>
              </>
            ) : null}

            {council.website ? (
              <>
                <View style={[styles.divider, { backgroundColor: colors.border }]} />
                <Pressable
                  style={styles.infoRow}
                  onPress={() => Linking.openURL(council.website!)}
                  accessibilityRole="button"
                  accessibilityLabel={`Open ${council.name} website`}
                >
                  <Ionicons name="globe-outline" size={18} color="#00843D" />
                  <View style={styles.infoText}>
                    <Text style={[styles.infoLabel, { color: colors.textMuted }]}>Website</Text>
                    <Text style={[styles.infoValue, styles.link]}>
                      {council.website.replace(/^https?:\/\//, '')}
                    </Text>
                  </View>
                  <Ionicons name="open-outline" size={14} color={colors.textMuted} />
                </Pressable>
              </>
            ) : null}
          </View>

          {/* Councillors */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Councillors</Text>
            {councillorsLoading ? (
              [1, 2, 3].map(i => (
                <SkeletonLoader key={i} height={48} borderRadius={8} style={{ marginBottom: 8 }} />
              ))
            ) : councillors.length === 0 ? (
              <View style={[styles.emptyCard, { backgroundColor: colors.surface }]}>
                <Ionicons name="people-outline" size={28} color={colors.textMuted} />
                <Text style={[styles.emptyText, { color: colors.textMuted }]}>No councillor data available.</Text>
              </View>
            ) : (
              councillors.map(c => {
                const roleStyle = c.role ? ROLE_COLOURS[c.role] : null;
                return (
                  <View key={c.id} style={[styles.councillorRow, { borderBottomColor: colors.border }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.councillorName, { color: colors.text }]}>{c.name}</Text>
                      {c.ward ? (
                        <View style={[styles.wardChip, { backgroundColor: colors.cardAlt }]}>
                          <Text style={[styles.wardText, { color: colors.textBody }]}>{c.ward}</Text>
                        </View>
                      ) : null}
                    </View>
                    {c.role ? (
                      <View style={[
                        styles.roleBadge,
                        roleStyle
                          ? { backgroundColor: roleStyle.bg }
                          : [styles.roleBadgeDefault, { borderColor: colors.borderStrong }],
                      ]}>
                        <Text style={[
                          styles.roleText,
                          roleStyle ? { color: roleStyle.text } : { color: colors.textMuted },
                        ]}>
                          {c.role}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                );
              })
            )}
          </View>

          {/* Postcodes */}
          {council.area_postcodes && council.area_postcodes.length > 0 && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Postcodes Covered</Text>
              <View style={styles.postcodeWrap}>
                {council.area_postcodes.map(pc => (
                  <View key={pc} style={[styles.postcodeChip, { backgroundColor: colors.cardAlt }]}>
                    <Text style={[styles.postcodeText, { color: colors.textBody }]}>{pc}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#ffffff' },
  back: { padding: 20, paddingBottom: 0 },
  header: { padding: 24, gap: 12 },
  headerTop: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  typeBadge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  typeBadgeText: { color: '#ffffff', fontSize: 12, fontWeight: '700' },
  stateBadge: { backgroundColor: '#e8ecf0', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  stateBadgeText: { color: '#5a6a7a', fontSize: 12, fontWeight: '700' },
  councilName: { fontSize: 24, fontWeight: '800', color: '#1a2332', lineHeight: 30 },

  statsBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 16, paddingHorizontal: 24,
    backgroundColor: '#f8f9fa', borderBottomWidth: 1, borderBottomColor: '#e8ecf0',
    gap: 24,
  },
  statItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statValue: { fontSize: 16, fontWeight: '700', color: '#1a2332' },
  statLabel: { fontSize: 13, color: '#9aabb8' },
  statDivider: { width: 1, height: 24, backgroundColor: '#e8ecf0' },

  content: { padding: 20 },
  card: { backgroundColor: '#f8f9fa', borderRadius: 12, padding: 16, marginBottom: 24 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  infoText: { flex: 1 },
  infoLabel: { fontSize: 11, color: '#9aabb8', fontWeight: '600', textTransform: 'uppercase', marginBottom: 2 },
  infoValue: { fontSize: 15, color: '#1a2332', fontWeight: '500' },
  link: { color: '#00843D' },
  divider: { height: 1, backgroundColor: '#e8ecf0', marginVertical: 12 },

  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#1a2332', marginBottom: 12 },

  emptyCard: {
    backgroundColor: '#f8f9fa', borderRadius: 12, padding: 24,
    alignItems: 'center', gap: 10,
  },
  emptyText: { fontSize: 14, color: '#9aabb8', textAlign: 'center' },

  councillorRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f5f7fa',
  },
  councillorName: { fontSize: 14, fontWeight: '600', color: '#1a2332', marginBottom: 3 },
  wardChip: {
    alignSelf: 'flex-start', backgroundColor: '#e8ecf0', borderRadius: 5,
    paddingHorizontal: 7, paddingVertical: 2,
  },
  wardText: { fontSize: 11, color: '#5a6a7a', fontWeight: '500' },
  roleBadge: { borderRadius: 6, paddingHorizontal: 9, paddingVertical: 3 },
  roleBadgeDefault: { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#c4cdd5' },
  roleText: { fontSize: 11, fontWeight: '700' },
  roleTextDefault: { color: '#9aabb8' },

  postcodeWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  postcodeChip: { backgroundColor: '#e8ecf0', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 5 },
  postcodeText: { fontSize: 13, color: '#5a6a7a', fontWeight: '500' },
});
