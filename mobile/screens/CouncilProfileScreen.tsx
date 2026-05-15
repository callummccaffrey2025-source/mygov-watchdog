import React, { useState } from 'react';
import {
  View, Text, Pressable, ScrollView, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Council } from '../hooks/useCouncils';
import { useCouncillors } from '../hooks/useCouncillors';
import { SkeletonLoader } from '../components/SkeletonLoader';
import { useTheme } from '../context/ThemeContext';
import { SPACING, FONT_SIZE, FONT_WEIGHT, BORDER_RADIUS, SHADOWS } from '../constants/design';

const TYPE_META: Record<string, { label: string; color: string; icon: keyof typeof Ionicons.glyphMap }> = {
  city:     { label: 'City Council',     color: '#0066CC', icon: 'business-outline' },
  shire:    { label: 'Shire Council',    color: '#00843D', icon: 'leaf-outline' },
  regional: { label: 'Regional Council', color: '#7C3AED', icon: 'map-outline' },
};

const ROLE_COLOURS: Record<string, { bg: string; text: string }> = {
  'Mayor':             { bg: '#00843D', text: '#ffffff' },
  'Lord Mayor':        { bg: '#00843D', text: '#ffffff' },
  'Deputy Mayor':      { bg: '#0066CC', text: '#ffffff' },
  'Deputy Lord Mayor': { bg: '#0066CC', text: '#ffffff' },
};

function formatPopulation(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k`;
  return n.toLocaleString('en-AU');
}

type Tab = 'overview' | 'councillors';

export function CouncilProfileScreen({ route, navigation }: any) {
  const { council }: { council: Council } = route.params;
  const { councillors, loading: councillorsLoading } = useCouncillors(council.id);
  const { colors } = useTheme();
  const [tab, setTab] = useState<Tab>('overview');

  const meta = TYPE_META[council.type] || { label: council.type, color: '#9aabb8', icon: 'business-outline' as const };

  const mayor = councillors.find(c => c.role?.includes('Mayor') && !c.role?.includes('Deputy'));
  const deputyMayor = councillors.find(c => c.role?.includes('Deputy'));
  const otherCouncillors = councillors.filter(c => !c.role?.includes('Mayor'));

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Nav */}
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.xl, paddingTop: SPACING.lg, paddingBottom: SPACING.sm, gap: SPACING.md }}>
          <Pressable
            style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.cardAlt, justifyContent: 'center', alignItems: 'center' }}
            onPress={() => navigation.goBack()} hitSlop={8}
            accessibilityRole="button" accessibilityLabel="Go back"
          >
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </Pressable>
          <Text style={{ flex: 1, fontSize: 13, fontWeight: FONT_WEIGHT.semibold, color: colors.textMuted }}>Local Council</Text>
        </View>

        {/* Header */}
        <View style={{ paddingHorizontal: SPACING.xl, paddingBottom: SPACING.xl }}>
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: SPACING.md }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: meta.color + '14', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 }}>
              <Ionicons name={meta.icon} size={13} color={meta.color} />
              <Text style={{ fontSize: 12, fontWeight: FONT_WEIGHT.bold, color: meta.color }}>{meta.label}</Text>
            </View>
            <View style={{ backgroundColor: colors.cardAlt, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 }}>
              <Text style={{ fontSize: 12, fontWeight: FONT_WEIGHT.bold, color: colors.textBody }}>{council.state}</Text>
            </View>
          </View>

          <Text style={{ fontSize: 26, fontWeight: '800', color: colors.text, lineHeight: 32, marginBottom: SPACING.md }}>
            {council.name}
          </Text>

          {/* Stats row */}
          <View style={{ flexDirection: 'row', gap: SPACING.lg }}>
            {council.population ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                <Ionicons name="people-outline" size={14} color={colors.textMuted} />
                <Text style={{ fontSize: 14, fontWeight: FONT_WEIGHT.bold, color: colors.text }}>{formatPopulation(council.population)}</Text>
                <Text style={{ fontSize: 12, color: colors.textMuted }}>residents</Text>
              </View>
            ) : null}
            {council.area_sqkm ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                <Ionicons name="resize-outline" size={14} color={colors.textMuted} />
                <Text style={{ fontSize: 14, fontWeight: FONT_WEIGHT.bold, color: colors.text }}>
                  {Number(council.area_sqkm).toLocaleString('en-AU', { maximumFractionDigits: 0 })}
                </Text>
                <Text style={{ fontSize: 12, color: colors.textMuted }}>km²</Text>
              </View>
            ) : null}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <Ionicons name="people-circle-outline" size={14} color={colors.textMuted} />
              <Text style={{ fontSize: 14, fontWeight: FONT_WEIGHT.bold, color: colors.text }}>{councillors.length}</Text>
              <Text style={{ fontSize: 12, color: colors.textMuted }}>councillors</Text>
            </View>
          </View>
        </View>

        {/* Tab bar */}
        <View style={{ flexDirection: 'row', paddingHorizontal: SPACING.xl, marginBottom: SPACING.lg, gap: 0 }}>
          {(['overview', 'councillors'] as Tab[]).map(t => {
            const active = tab === t;
            return (
              <Pressable
                key={t}
                onPress={() => setTab(t)}
                style={{ flex: 1, paddingVertical: 10, borderBottomWidth: 2, borderBottomColor: active ? '#00843D' : colors.border }}
                accessibilityRole="tab"
              >
                <Text style={{ fontSize: 14, fontWeight: active ? FONT_WEIGHT.bold : FONT_WEIGHT.medium, color: active ? '#00843D' : colors.textMuted, textAlign: 'center' }}>
                  {t === 'overview' ? 'Overview' : `Councillors (${councillors.length})`}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {tab === 'overview' ? (
          <View style={{ paddingHorizontal: SPACING.xl, paddingBottom: 40 }}>
            {/* Leadership card */}
            {(mayor || deputyMayor) && (
              <View style={{ backgroundColor: colors.card, borderRadius: BORDER_RADIUS.lg, padding: SPACING.lg, marginBottom: SPACING.lg, ...SHADOWS.sm }}>
                <Text style={{ fontSize: 11, fontWeight: FONT_WEIGHT.bold, color: '#00843D', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: SPACING.md }}>
                  Leadership
                </Text>
                {mayor && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: deputyMayor ? SPACING.md : 0 }}>
                    <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#00843D', justifyContent: 'center', alignItems: 'center' }}>
                      <Ionicons name="star" size={20} color="#fff" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 16, fontWeight: FONT_WEIGHT.bold, color: colors.text }}>{mayor.name}</Text>
                      <Text style={{ fontSize: 12, color: colors.textMuted }}>{mayor.role || 'Mayor'}{mayor.ward ? ` — ${mayor.ward}` : ''}</Text>
                    </View>
                  </View>
                )}
                {deputyMayor && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#0066CC', justifyContent: 'center', alignItems: 'center' }}>
                      <Ionicons name="star-half" size={20} color="#fff" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 16, fontWeight: FONT_WEIGHT.bold, color: colors.text }}>{deputyMayor.name}</Text>
                      <Text style={{ fontSize: 12, color: colors.textMuted }}>{deputyMayor.role || 'Deputy Mayor'}{deputyMayor.ward ? ` — ${deputyMayor.ward}` : ''}</Text>
                    </View>
                  </View>
                )}
              </View>
            )}

            {/* Contact card */}
            <View style={{ backgroundColor: colors.card, borderRadius: BORDER_RADIUS.lg, padding: SPACING.lg, marginBottom: SPACING.lg, ...SHADOWS.sm }}>
              <Text style={{ fontSize: 11, fontWeight: FONT_WEIGHT.bold, color: '#00843D', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: SPACING.md }}>
                Contact
              </Text>

              {council.phone && (
                <Pressable
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: SPACING.md }}
                  onPress={() => Linking.openURL(`tel:${council.phone!.replace(/\s/g, '')}`)}
                  accessibilityRole="button" accessibilityLabel={`Call ${council.name}`}
                >
                  <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#00843D14', justifyContent: 'center', alignItems: 'center' }}>
                    <Ionicons name="call-outline" size={16} color="#00843D" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: FONT_WEIGHT.semibold, color: '#00843D' }}>{council.phone}</Text>
                    <Text style={{ fontSize: 11, color: colors.textMuted }}>Phone</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                </Pressable>
              )}

              {council.email && (
                <Pressable
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: SPACING.md }}
                  onPress={() => Linking.openURL(`mailto:${council.email}`)}
                  accessibilityRole="button" accessibilityLabel={`Email ${council.name}`}
                >
                  <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#0066CC14', justifyContent: 'center', alignItems: 'center' }}>
                    <Ionicons name="mail-outline" size={16} color="#0066CC" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: FONT_WEIGHT.semibold, color: '#0066CC' }}>{council.email}</Text>
                    <Text style={{ fontSize: 11, color: colors.textMuted }}>Email</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                </Pressable>
              )}

              {council.address && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: SPACING.md }}>
                  <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.cardAlt, justifyContent: 'center', alignItems: 'center' }}>
                    <Ionicons name="location-outline" size={16} color={colors.textBody} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: FONT_WEIGHT.medium, color: colors.text }}>{council.address}</Text>
                    <Text style={{ fontSize: 11, color: colors.textMuted }}>Address</Text>
                  </View>
                </View>
              )}

              {council.website && (
                <Pressable
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}
                  onPress={() => Linking.openURL(council.website!)}
                  accessibilityRole="button" accessibilityLabel={`Open ${council.name} website`}
                >
                  <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#00843D14', justifyContent: 'center', alignItems: 'center' }}>
                    <Ionicons name="globe-outline" size={16} color="#00843D" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: FONT_WEIGHT.semibold, color: '#00843D' }}>
                      {council.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                    </Text>
                    <Text style={{ fontSize: 11, color: colors.textMuted }}>Website</Text>
                  </View>
                  <Ionicons name="open-outline" size={14} color={colors.textMuted} />
                </Pressable>
              )}
            </View>

            {/* Postcodes */}
            {council.area_postcodes && council.area_postcodes.length > 0 && (
              <View style={{ backgroundColor: colors.card, borderRadius: BORDER_RADIUS.lg, padding: SPACING.lg, marginBottom: SPACING.lg, ...SHADOWS.sm }}>
                <Text style={{ fontSize: 11, fontWeight: FONT_WEIGHT.bold, color: '#00843D', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: SPACING.md }}>
                  Postcodes Covered
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                  {council.area_postcodes.map(pc => (
                    <View key={pc} style={{ backgroundColor: colors.cardAlt, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 5 }}>
                      <Text style={{ fontSize: 13, fontWeight: FONT_WEIGHT.medium, color: colors.textBody }}>{pc}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </View>
        ) : (
          /* Councillors tab */
          <View style={{ paddingHorizontal: SPACING.xl, paddingBottom: 40 }}>
            {councillorsLoading ? (
              [1, 2, 3, 4].map(i => (
                <SkeletonLoader key={i} height={72} borderRadius={12} style={{ marginBottom: 10 }} />
              ))
            ) : councillors.length === 0 ? (
              <View style={{ alignItems: 'center', paddingVertical: 40, gap: SPACING.md }}>
                <Ionicons name="people-outline" size={40} color={colors.textMuted} />
                <Text style={{ fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.semibold, color: colors.text }}>No councillor data yet</Text>
                <Text style={{ fontSize: FONT_SIZE.caption, color: colors.textMuted, textAlign: 'center' }}>
                  We're working on adding councillor information for this council.
                </Text>
              </View>
            ) : (
              councillors.map(c => {
                const roleStyle = c.role ? ROLE_COLOURS[c.role] : null;
                return (
                  <View key={c.id} style={{
                    backgroundColor: colors.card, borderRadius: BORDER_RADIUS.md,
                    padding: SPACING.md, marginBottom: 8, ...SHADOWS.sm,
                    flexDirection: 'row', alignItems: 'center', gap: 12,
                  }}>
                    <View style={{
                      width: 40, height: 40, borderRadius: 20,
                      backgroundColor: roleStyle ? roleStyle.bg + '20' : colors.cardAlt,
                      justifyContent: 'center', alignItems: 'center',
                    }}>
                      <Ionicons
                        name={c.role?.includes('Mayor') ? 'star' : 'person'}
                        size={18}
                        color={roleStyle ? roleStyle.bg : colors.textMuted}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 15, fontWeight: FONT_WEIGHT.semibold, color: colors.text }}>{c.name}</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                        {c.role && (
                          <View style={{
                            backgroundColor: roleStyle ? roleStyle.bg : colors.cardAlt,
                            borderRadius: 4, paddingHorizontal: 6, paddingVertical: 1,
                          }}>
                            <Text style={{ fontSize: 10, fontWeight: FONT_WEIGHT.bold, color: roleStyle ? roleStyle.text : colors.textMuted }}>
                              {c.role}
                            </Text>
                          </View>
                        )}
                        {c.ward && (
                          <Text style={{ fontSize: 12, color: colors.textMuted }}>{c.ward}</Text>
                        )}
                      </View>
                    </View>
                  </View>
                );
              })
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
