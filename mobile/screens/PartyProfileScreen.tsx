import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
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
import { SPACING, FONT_SIZE, FONT_WEIGHT, BORDER_RADIUS, SHADOWS } from '../constants/design';

// ── Policy topic config ─────────────────────────────────────────────────────

const TOPIC_CONFIG: Record<string, { label: string; icon: keyof typeof Ionicons.glyphMap; color: string }> = {
  housing:        { label: 'Housing',        icon: 'home-outline',           color: '#E65100' },
  healthcare:     { label: 'Healthcare',     icon: 'medkit-outline',         color: '#DC2626' },
  health:         { label: 'Health',         icon: 'medkit-outline',         color: '#DC2626' },
  economy:        { label: 'Economy',        icon: 'trending-up-outline',    color: '#2563EB' },
  climate:        { label: 'Climate',        icon: 'leaf-outline',           color: '#059669' },
  immigration:    { label: 'Immigration',    icon: 'airplane-outline',       color: '#7C3AED' },
  defence:        { label: 'Defence',        icon: 'shield-outline',         color: '#1D4ED8' },
  education:      { label: 'Education',      icon: 'school-outline',         color: '#EA580C' },
  cost_of_living: { label: 'Cost of Living', icon: 'cart-outline',           color: '#B45309' },
  indigenous:     { label: 'Indigenous Affairs', icon: 'earth-outline',      color: '#712B13' },
  technology:     { label: 'Technology',     icon: 'hardware-chip-outline',  color: '#0891B2' },
  agriculture:    { label: 'Agriculture',    icon: 'nutrition-outline',      color: '#27500A' },
  infrastructure: { label: 'Infrastructure', icon: 'construct-outline',      color: '#444441' },
  foreign_policy: { label: 'Foreign Policy', icon: 'globe-outline',          color: '#0C447C' },
  justice:        { label: 'Justice',        icon: 'scale-outline',          color: '#6D28D9' },
};

// Coalition parties that should cross-reference each other for policy data
const COALITION_ALIASES: Record<string, string[]> = {
  'liberal national party':     ['liberal party', 'national party'],
  'liberal national party of queensland': ['liberal party', 'national party'],
  'country liberal party':      ['liberal party', 'national party'],
};

// ── Component ───────────────────────────────────────────────────────────────

export function PartyProfileScreen({ route, navigation }: any) {
  const { colors } = useTheme();
  const { party }: { party: Party } = route.params;
  const { members, loading: membersLoading } = useMembers({ partyId: party.id });
  const [policies, setPolicies] = useState<{ category: string; summary_plain: string }[]>([]);
  const [policiesLoading, setPoliciesLoading] = useState(true);
  const { donations, totalAmount } = usePartyDonations(party.id);
  const partyColour = party.colour || '#6B7280';

  // For coalition parties (LNP, CLP), also fetch policies from parent parties
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setPoliciesLoading(true);
      try {
        // First try this party's own policies
        const { data: own } = await supabase
          .from('party_policies')
          .select('category,summary_plain')
          .eq('party_id', party.id);

        if (!cancelled && own && own.length > 0) {
          setPolicies(own);
          setPoliciesLoading(false);
          return;
        }

        // For coalition parties, try to find policies from related parties
        const partyNameLower = party.name.toLowerCase();
        const aliases = COALITION_ALIASES[partyNameLower];
        if (aliases && aliases.length > 0) {
          const { data: allParties } = await supabase
            .from('parties')
            .select('id,name')
            .or(aliases.map(a => `name.ilike.%${a}%`).join(','));

          if (!cancelled && allParties && allParties.length > 0) {
            const parentIds = allParties.map(p => p.id);
            const { data: parentPolicies } = await supabase
              .from('party_policies')
              .select('category,summary_plain')
              .in('party_id', parentIds);

            if (!cancelled && parentPolicies) {
              // Deduplicate by category, prefer first match
              const seen = new Set<string>();
              const deduped = parentPolicies.filter(p => {
                if (seen.has(p.category)) return false;
                seen.add(p.category);
                return true;
              });
              setPolicies(deduped);
            }
          }
        }
      } catch {
        // leave empty
      }
      if (!cancelled) setPoliciesLoading(false);
    })();
    return () => { cancelled = true; };
  }, [party.id, party.name]);

  // Split members by chamber
  const houseMembers = useMemo(() => members.filter(m => m.chamber === 'house'), [members]);
  const senateMembers = useMemo(() => members.filter(m => m.chamber === 'senate'), [members]);

  // Donation breakdown by type
  const donationBreakdown = useMemo(() => {
    if (donations.length === 0) return [];
    const byType: Record<string, number> = {};
    donations.forEach(d => {
      byType[d.donor_type] = (byType[d.donor_type] || 0) + Number(d.amount);
    });
    return Object.entries(byType)
      .sort((a, b) => b[1] - a[1])
      .map(([type, amt]) => ({
        type,
        label: DONOR_TYPE_LABELS[type] ?? type,
        amount: amt,
        pct: totalAmount > 0 ? Math.round((amt / totalAmount) * 100) : 0,
      }));
  }, [donations, totalAmount]);

  const isCoalition = !!COALITION_ALIASES[party.name.toLowerCase()];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* ── Back button ── */}
        <Pressable
          onPress={() => navigation.goBack()}
          style={{ padding: SPACING.xl, paddingBottom: 0 }}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Pressable>

        {/* ═══ HEADER ═══ */}
        <View style={{
          marginHorizontal: SPACING.xl,
          marginTop: SPACING.md,
          borderRadius: BORDER_RADIUS.lg,
          overflow: 'hidden',
        }}>
          <View style={{
            backgroundColor: partyColour,
            paddingHorizontal: SPACING.xl,
            paddingTop: 28,
            paddingBottom: 24,
          }}>
            <Text style={{
              fontSize: 26,
              fontWeight: '800',
              color: '#ffffff',
              marginBottom: 4,
            }}>
              {party.name}
            </Text>
            {(party.short_name || party.abbreviation) && (
              <Text style={{
                fontSize: 14,
                color: 'rgba(255,255,255,0.75)',
                fontWeight: '600',
              }}>
                {party.short_name || party.abbreviation}
              </Text>
            )}
          </View>

          {/* Stats bar */}
          <View style={{
            backgroundColor: colors.card,
            flexDirection: 'row',
            paddingVertical: SPACING.md,
            ...SHADOWS.sm,
          }}>
            <View style={{ flex: 1, alignItems: 'center' }}>
              <Text style={{ fontSize: 20, fontWeight: '800', color: colors.text }}>
                {membersLoading ? '—' : members.length}
              </Text>
              <Text style={{ fontSize: 11, fontWeight: '600', color: colors.textMuted, marginTop: 2 }}>
                Members
              </Text>
            </View>
            <View style={{ width: 1, backgroundColor: colors.border }} />
            <View style={{ flex: 1, alignItems: 'center' }}>
              <Text style={{ fontSize: 20, fontWeight: '800', color: colors.text }}>
                {membersLoading ? '—' : houseMembers.length}
              </Text>
              <Text style={{ fontSize: 11, fontWeight: '600', color: colors.textMuted, marginTop: 2 }}>
                House
              </Text>
            </View>
            <View style={{ width: 1, backgroundColor: colors.border }} />
            <View style={{ flex: 1, alignItems: 'center' }}>
              <Text style={{ fontSize: 20, fontWeight: '800', color: colors.text }}>
                {membersLoading ? '—' : senateMembers.length}
              </Text>
              <Text style={{ fontSize: 11, fontWeight: '600', color: colors.textMuted, marginTop: 2 }}>
                Senate
              </Text>
            </View>
          </View>
        </View>

        <View style={{ padding: SPACING.xl, paddingTop: SPACING.xl }}>

          {/* ═══ ABOUT ═══ */}
          {(party as any).description && (
            <View style={{ marginBottom: SPACING.xl }}>
              <Text style={{ fontSize: FONT_SIZE.body, color: colors.textBody, lineHeight: 22 }}>
                {(party as any).description}
              </Text>
              {((party as any).leader || (party as any).founded_year || (party as any).website_url) && (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginTop: SPACING.md }}>
                  {(party as any).leader && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.surface, borderRadius: BORDER_RADIUS.sm, paddingHorizontal: SPACING.sm + 2, paddingVertical: SPACING.xs + 1 }}>
                      <Ionicons name="person-outline" size={12} color={colors.textMuted} />
                      <Text style={{ fontSize: FONT_SIZE.caption, color: colors.textBody }}>
                        Leader: {(party as any).leader}
                      </Text>
                    </View>
                  )}
                  {(party as any).founded_year && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.surface, borderRadius: BORDER_RADIUS.sm, paddingHorizontal: SPACING.sm + 2, paddingVertical: SPACING.xs + 1 }}>
                      <Ionicons name="calendar-outline" size={12} color={colors.textMuted} />
                      <Text style={{ fontSize: FONT_SIZE.caption, color: colors.textBody }}>
                        Founded {(party as any).founded_year}
                      </Text>
                    </View>
                  )}
                </View>
              )}
            </View>
          )}

          {/* ═══ COALITION NOTICE ═══ */}
          {isCoalition && (
            <View style={{
              flexDirection: 'row',
              alignItems: 'flex-start',
              gap: SPACING.sm,
              backgroundColor: colors.surface,
              borderRadius: BORDER_RADIUS.md,
              padding: SPACING.md,
              marginBottom: SPACING.xl,
            }}>
              <Ionicons name="information-circle-outline" size={16} color={colors.textMuted} style={{ marginTop: 1 }} />
              <Text style={{ flex: 1, fontSize: 13, color: colors.textBody, lineHeight: 18 }}>
                {party.name} is a coalition party. Policy positions shown are drawn from the Liberal and National parties.
              </Text>
            </View>
          )}

          {/* ═══ KEY POLICIES ═══ */}
          <View style={{ marginBottom: SPACING.xxl }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.lg }}>
              <View style={{ width: 4, height: 18, borderRadius: 2, backgroundColor: partyColour }} />
              <Text style={{ fontSize: 11, fontWeight: '700', letterSpacing: 1, color: colors.textMuted, textTransform: 'uppercase' }}>
                Policy Positions
              </Text>
            </View>

            {policiesLoading ? (
              [1, 2, 3].map(i => (
                <SkeletonLoader key={i} height={90} borderRadius={BORDER_RADIUS.lg} style={{ marginBottom: SPACING.md }} />
              ))
            ) : policies.length > 0 ? (
              policies.map(p => {
                const config = TOPIC_CONFIG[p.category] || { label: p.category, icon: 'document-text-outline' as any, color: '#6B7280' };
                return (
                  <View
                    key={p.category}
                    style={{
                      backgroundColor: colors.card,
                      borderRadius: BORDER_RADIUS.lg,
                      marginBottom: SPACING.md,
                      overflow: 'hidden',
                      ...SHADOWS.sm,
                    }}
                  >
                    <View style={{ flexDirection: 'row' }}>
                      {/* Color accent bar */}
                      <View style={{ width: 4, backgroundColor: config.color }} />
                      <View style={{ flex: 1, padding: SPACING.lg }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.sm }}>
                          <View style={{
                            width: 28,
                            height: 28,
                            borderRadius: 7,
                            backgroundColor: config.color + '14',
                            justifyContent: 'center',
                            alignItems: 'center',
                          }}>
                            <Ionicons name={config.icon as any} size={15} color={config.color} />
                          </View>
                          <Text style={{ fontSize: 13, fontWeight: '700', color: config.color, textTransform: 'uppercase', letterSpacing: 0.3 }}>
                            {config.label}
                          </Text>
                        </View>
                        <Text style={{ fontSize: 14, color: colors.textBody, lineHeight: 21 }}>
                          {decodeHtml(p.summary_plain)}
                        </Text>
                      </View>
                    </View>
                  </View>
                );
              })
            ) : (
              <View style={{
                alignItems: 'center',
                paddingVertical: SPACING.xxxl,
                gap: SPACING.md,
              }}>
                <Ionicons name="document-text-outline" size={40} color={colors.textMuted} />
                <Text style={{ fontSize: 16, fontWeight: '600', color: colors.text }}>
                  No policy data yet
                </Text>
                <Text style={{ fontSize: 14, color: colors.textBody, textAlign: 'center', lineHeight: 20 }}>
                  Policy summaries for {party.name} will be added as they become available from official sources.
                </Text>
              </View>
            )}
          </View>

          {/* ═══ FUNDING ═══ */}
          {donations.length > 0 && (
            <View style={{ marginBottom: SPACING.xxl }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.lg }}>
                <View style={{ width: 4, height: 18, borderRadius: 2, backgroundColor: partyColour }} />
                <Text style={{ fontSize: 11, fontWeight: '700', letterSpacing: 1, color: colors.textMuted, textTransform: 'uppercase' }}>
                  Declared Donations
                </Text>
              </View>

              <View style={{
                backgroundColor: colors.card,
                borderRadius: BORDER_RADIUS.lg,
                padding: SPACING.lg,
                ...SHADOWS.sm,
              }}>
                {/* Total */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: SPACING.md }}>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textMuted }}>Total declared (2023-24)</Text>
                  <Text style={{ fontSize: 22, fontWeight: '800', color: partyColour }}>
                    ${totalAmount.toLocaleString('en-AU')}
                  </Text>
                </View>

                {/* Breakdown bar */}
                {donationBreakdown.length > 0 && (
                  <View style={{ marginBottom: SPACING.lg }}>
                    <View style={{
                      flexDirection: 'row',
                      height: 6,
                      borderRadius: 3,
                      overflow: 'hidden',
                      backgroundColor: colors.surface,
                    }}>
                      {donationBreakdown.map((d, i) => (
                        <View
                          key={d.type}
                          style={{
                            flex: d.pct,
                            backgroundColor: partyColour,
                            opacity: 1 - (i * 0.2),
                          }}
                        />
                      ))}
                    </View>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.md, marginTop: SPACING.sm }}>
                      {donationBreakdown.map((d, i) => (
                        <View key={d.type} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: partyColour, opacity: 1 - (i * 0.2) }} />
                          <Text style={{ fontSize: 11, color: colors.textMuted }}>{d.label} {d.pct}%</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}

                {/* Top donors */}
                <Text style={{ fontSize: 11, fontWeight: '700', letterSpacing: 0.8, color: colors.textMuted, textTransform: 'uppercase', marginBottom: SPACING.sm }}>
                  Top Donors
                </Text>
                {donations.slice(0, 5).map((d, i) => (
                  <View
                    key={d.id}
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      paddingVertical: SPACING.sm + 2,
                      borderTopWidth: i === 0 ? 0 : 0.5,
                      borderTopColor: colors.border,
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, flex: 1 }}>
                      <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textMuted, width: 18 }}>{i + 1}</Text>
                      <Text style={{ fontSize: 14, color: colors.text, flex: 1 }} numberOfLines={1}>{d.donor_name}</Text>
                    </View>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>
                      ${Number(d.amount).toLocaleString('en-AU')}
                    </Text>
                  </View>
                ))}

                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: SPACING.md, paddingTop: SPACING.sm, borderTopWidth: 0.5, borderTopColor: colors.border }}>
                  <Ionicons name="document-text-outline" size={11} color={colors.textMuted} />
                  <Text style={{ fontSize: 11, color: colors.textMuted }}>Source: AEC Transparency Register</Text>
                </View>
              </View>
            </View>
          )}

          {/* ═══ MEMBERS ═══ */}
          <View style={{ marginBottom: SPACING.xxl }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.lg }}>
              <View style={{ width: 4, height: 18, borderRadius: 2, backgroundColor: partyColour }} />
              <Text style={{ fontSize: 11, fontWeight: '700', letterSpacing: 1, color: colors.textMuted, textTransform: 'uppercase' }}>
                Members
              </Text>
              <Text style={{ fontSize: 11, fontWeight: '600', color: colors.textMuted }}>
                ({members.length})
              </Text>
            </View>

            {membersLoading ? (
              [1, 2, 3].map(i => (
                <SkeletonLoader key={i} height={64} borderRadius={12} style={{ marginBottom: SPACING.sm }} />
              ))
            ) : (
              <>
                {houseMembers.length > 0 && (
                  <>
                    <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textMuted, marginBottom: SPACING.sm, marginTop: SPACING.xs }}>
                      House of Representatives ({houseMembers.length})
                    </Text>
                    {houseMembers.map(m => (
                      <MemberCard key={m.id} member={m} onPress={() => navigation.navigate('MemberProfile', { member: m })} />
                    ))}
                  </>
                )}
                {senateMembers.length > 0 && (
                  <>
                    <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textMuted, marginBottom: SPACING.sm, marginTop: SPACING.lg }}>
                      Senate ({senateMembers.length})
                    </Text>
                    {senateMembers.map(m => (
                      <MemberCard key={m.id} member={m} onPress={() => navigation.navigate('MemberProfile', { member: m })} />
                    ))}
                  </>
                )}
              </>
            )}
          </View>

          {/* ═══ SOURCE FOOTER ═══ */}
          <View style={{
            backgroundColor: colors.surface,
            borderRadius: BORDER_RADIUS.lg,
            padding: SPACING.lg,
            marginBottom: SPACING.lg,
          }}>
            <Text style={{ fontSize: 12, color: colors.textMuted, lineHeight: 18 }}>
              Data sourced from the Australian Electoral Commission, Parliament of Australia, and official party publications.
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
