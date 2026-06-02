import React from 'react';
import { View, Text, ScrollView, Pressable, RefreshControl } from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useDailyBrief } from '../hooks/useDailyBrief';
import { SkeletonLoader } from '../components/SkeletonLoader';
import { SPACING, FONT_SIZE, FONT_WEIGHT, BORDER_RADIUS, SHADOWS, PARTY_COLORS } from '../constants/design';

const GREEN = '#00843D';

export function DailyBriefScreen({ navigation }: any) {
  const { colors } = useTheme();
  const { brief, loading } = useDailyBrief();
  const [refreshing, setRefreshing] = React.useState(false);

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
        <View style={{ padding: SPACING.xl }}>
          <SkeletonLoader height={28} width={200} borderRadius={6} style={{ marginBottom: SPACING.lg }} />
          <SkeletonLoader height={180} borderRadius={BORDER_RADIUS.lg} style={{ marginBottom: SPACING.lg }} />
          <SkeletonLoader height={120} borderRadius={BORDER_RADIUS.lg} style={{ marginBottom: SPACING.lg }} />
          <SkeletonLoader height={100} borderRadius={BORDER_RADIUS.lg} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); setTimeout(() => setRefreshing(false), 1000); }} tintColor={GREEN} />}
      >
        {/* Header */}
        <View style={{ paddingHorizontal: SPACING.xl, paddingTop: SPACING.lg }}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={12} accessibilityRole="button" accessibilityLabel="Go back">
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </Pressable>

          <View style={{ marginTop: SPACING.lg, marginBottom: SPACING.md }}>
            <Text style={{ fontSize: 11, fontWeight: FONT_WEIGHT.semibold, letterSpacing: 0.8, color: GREEN, textTransform: 'uppercase' }}>
              Your Daily Brief
            </Text>
            <Text style={{ fontSize: 28, fontWeight: FONT_WEIGHT.bold, color: colors.text, marginTop: SPACING.xs, letterSpacing: -0.5 }}>
              {brief?.date || 'Today'}
            </Text>
          </View>
        </View>

        {/* ═══ SECTION 1: YOUR MP'S WEEK ═══ */}
        {brief?.mp && (
          <View style={{ paddingHorizontal: SPACING.xl, marginBottom: SPACING.xl }}>
            <View style={{
              backgroundColor: colors.card, borderRadius: BORDER_RADIUS.lg,
              padding: SPACING.xl, ...SHADOWS.md,
            }}>
              {/* MP header */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.md, marginBottom: SPACING.lg }}>
                {brief.mp.mp_photo ? (
                  <Image source={{ uri: brief.mp.mp_photo }} style={{ width: 48, height: 48, borderRadius: 24 }} />
                ) : (
                  <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: colors.cardAlt, justifyContent: 'center', alignItems: 'center' }}>
                    <Text style={{ fontSize: 16, fontWeight: FONT_WEIGHT.bold, color: colors.textMuted }}>
                      {brief.mp.mp_name.split(' ').map(n => n[0]).join('')}
                    </Text>
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: FONT_SIZE.subtitle, fontWeight: FONT_WEIGHT.bold, color: colors.text }}>
                    {brief.mp.mp_name}
                  </Text>
                  <Text style={{ fontSize: FONT_SIZE.caption, color: colors.textMuted }}>
                    {brief.mp.mp_party} · {brief.mp.electorate}
                  </Text>
                </View>
                <Pressable
                  onPress={() => {
                    // Navigate to MP profile if we have the ID
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="View MP profile"
                >
                  <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                </Pressable>
              </View>

              {/* Summary */}
              <Text style={{ fontSize: FONT_SIZE.body, color: colors.text, lineHeight: 22, marginBottom: SPACING.md }}>
                {brief.mp.summary}
              </Text>

              {/* Recent votes */}
              {brief.mp.votes.length > 0 && (
                <View style={{ marginTop: SPACING.sm }}>
                  <Text style={{ fontSize: FONT_SIZE.caption, fontWeight: FONT_WEIGHT.semibold, color: colors.textMuted, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: SPACING.sm }}>
                    Recent Votes
                  </Text>
                  {brief.mp.votes.slice(0, 5).map((v, i) => (
                    <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, paddingVertical: SPACING.xs }}>
                      <View style={{
                        width: 24, height: 24, borderRadius: 12,
                        backgroundColor: v.vote === 'aye' ? '#E8F5EE' : '#FDECEA',
                        justifyContent: 'center', alignItems: 'center',
                      }}>
                        <Ionicons
                          name={v.vote === 'aye' ? 'checkmark' : 'close'}
                          size={12}
                          color={v.vote === 'aye' ? GREEN : '#DC3545'}
                        />
                      </View>
                      <Text style={{ flex: 1, fontSize: FONT_SIZE.small, color: colors.text, lineHeight: 18 }} numberOfLines={1}>
                        {v.division_name}
                      </Text>
                    </View>
                  ))}
                </View>
              )}

              {/* Rebellion flag */}
              {brief.mp.rebellions > 0 && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginTop: SPACING.md, backgroundColor: '#FFFBEB', borderRadius: BORDER_RADIUS.sm, padding: SPACING.sm }}>
                  <Ionicons name="warning-outline" size={16} color="#D97706" />
                  <Text style={{ fontSize: FONT_SIZE.caption, fontWeight: FONT_WEIGHT.semibold, color: '#92400E' }}>
                    Crossed the floor {brief.mp.rebellions} time{brief.mp.rebellions !== 1 ? 's' : ''}
                  </Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* ═══ SECTION 2: IN YOUR ELECTORATE ═══ */}
        {brief?.electorate && (brief.electorate.local_stories.length > 0 || brief.electorate.margin) && (
          <View style={{ paddingHorizontal: SPACING.xl, marginBottom: SPACING.xl }}>
            <Text style={{ fontSize: 11, fontWeight: FONT_WEIGHT.semibold, letterSpacing: 0.8, color: colors.textMuted, textTransform: 'uppercase', marginBottom: SPACING.sm }}>
              In Your Electorate
            </Text>

            <View style={{
              backgroundColor: colors.card, borderRadius: BORDER_RADIUS.lg,
              padding: SPACING.lg, ...SHADOWS.sm,
            }}>
              {/* Margin + holding party */}
              {brief.electorate.margin && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.md }}>
                  <Ionicons name="stats-chart" size={16} color={GREEN} />
                  <Text style={{ fontSize: FONT_SIZE.body, color: colors.text }}>
                    Margin: {brief.electorate.margin}
                    {brief.electorate.holding_party ? ` (${brief.electorate.holding_party} held)` : ''}
                  </Text>
                </View>
              )}

              {/* Local stories */}
              {brief.electorate.local_stories.map((s, i) => (
                <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm, paddingVertical: SPACING.xs }}>
                  <Ionicons name="newspaper-outline" size={14} color={colors.textMuted} style={{ marginTop: 2 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: FONT_SIZE.small, color: colors.text, lineHeight: 18 }} numberOfLines={2}>
                      {s.title}
                    </Text>
                    {s.source && (
                      <Text style={{ fontSize: FONT_SIZE.caption - 1, color: colors.textMuted, marginTop: 1 }}>
                        {s.source}
                      </Text>
                    )}
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* ═══ SECTION 3: BILLS THAT AFFECT YOU ═══ */}
        {brief?.bills && brief.bills.length > 0 && (
          <View style={{ paddingHorizontal: SPACING.xl, marginBottom: SPACING.xl }}>
            <Text style={{ fontSize: 11, fontWeight: FONT_WEIGHT.semibold, letterSpacing: 0.8, color: colors.textMuted, textTransform: 'uppercase', marginBottom: SPACING.sm }}>
              Bills Before Parliament
            </Text>

            {brief.bills.slice(0, 3).map(bill => (
              <Pressable
                key={bill.id}
                onPress={() => navigation.navigate('BillDetail', { billId: bill.id })}
                accessibilityRole="button"
                style={({ pressed }) => ({
                  backgroundColor: colors.card, borderRadius: BORDER_RADIUS.lg,
                  padding: SPACING.lg, marginBottom: SPACING.sm,
                  flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
                  opacity: pressed ? 0.92 : 1, ...SHADOWS.sm,
                })}
              >
                <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#E8F5EE', justifyContent: 'center', alignItems: 'center' }}>
                  <Ionicons name="document-text" size={16} color={GREEN} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: FONT_SIZE.small, fontWeight: FONT_WEIGHT.semibold, color: colors.text }} numberOfLines={1}>
                    {bill.title}
                  </Text>
                  <Text style={{ fontSize: FONT_SIZE.caption, color: colors.textMuted, marginTop: 1 }}>
                    {bill.status === 'introduced' ? 'Introduced' : bill.status === 'passed_house' ? 'Passed House' : bill.status}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={14} color={colors.textMuted} />
              </Pressable>
            ))}
          </View>
        )}

        {/* ═══ SECTION 4: THE NUMBERS ═══ */}
        {brief?.polls && (
          <View style={{ paddingHorizontal: SPACING.xl, marginBottom: SPACING.xl }}>
            <Text style={{ fontSize: 11, fontWeight: FONT_WEIGHT.semibold, letterSpacing: 0.8, color: colors.textMuted, textTransform: 'uppercase', marginBottom: SPACING.sm }}>
              The Numbers
            </Text>

            <View style={{
              backgroundColor: colors.card, borderRadius: BORDER_RADIUS.lg,
              padding: SPACING.lg, ...SHADOWS.sm,
            }}>
              {/* Poll snapshot */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-around', marginBottom: SPACING.md }}>
                {brief.polls.alp != null && <PollBadge label="ALP" value={brief.polls.alp} color={PARTY_COLORS.ALP} />}
                {brief.polls.onp != null && <PollBadge label="ONP" value={brief.polls.onp} color={PARTY_COLORS.ONP} />}
                {brief.polls.lnp != null && <PollBadge label="L/NP" value={brief.polls.lnp} color={PARTY_COLORS.LNP} />}
                {brief.polls.grn != null && <PollBadge label="GRN" value={brief.polls.grn} color={PARTY_COLORS.GRN} />}
              </View>

              {/* Election countdown */}
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm, paddingTop: SPACING.sm, borderTopWidth: 0.5, borderTopColor: colors.border }}>
                <Ionicons name="calendar-outline" size={14} color={colors.textMuted} />
                <Text style={{ fontSize: FONT_SIZE.caption, color: colors.textMuted }}>
                  Election due within {brief.polls.days_to_election} days
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* ═══ SECTION 5: ONE THING TO KNOW ═══ */}
        {brief?.one_thing && (
          <View style={{ paddingHorizontal: SPACING.xl, marginBottom: SPACING.xl }}>
            <View style={{
              backgroundColor: '#1E1B4B', borderRadius: BORDER_RADIUS.lg,
              padding: SPACING.xl,
            }}>
              <Text style={{ fontSize: 11, fontWeight: FONT_WEIGHT.semibold, letterSpacing: 0.8, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', marginBottom: SPACING.sm }}>
                One Thing to Know
              </Text>
              <Text style={{ fontSize: FONT_SIZE.subtitle, fontWeight: FONT_WEIGHT.bold, color: '#ffffff', lineHeight: 24 }}>
                {brief.one_thing}
              </Text>
            </View>
          </View>
        )}

        {/* Footer */}
        <View style={{ paddingHorizontal: SPACING.xl }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.xs }}>
            <Ionicons name="information-circle-outline" size={13} color={colors.textMuted} style={{ marginTop: 1 }} />
            <Text style={{ flex: 1, fontSize: FONT_SIZE.caption - 1, color: colors.textMuted, lineHeight: 16 }}>
              Data from TheyVoteForYou, Australian Parliament House, and AEC. Updated daily at 7am AEST.
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function PollBadge({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={{ alignItems: 'center' }}>
      <Text style={{ fontSize: 11, fontWeight: FONT_WEIGHT.semibold, color }}>{label}</Text>
      <Text style={{ fontSize: 20, fontWeight: FONT_WEIGHT.bold, color: '#1F2937', marginTop: 2 }}>{value}</Text>
    </View>
  );
}
