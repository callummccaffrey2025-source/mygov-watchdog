import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  RefreshControl,
  Linking,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useUser } from '../context/UserContext';
import { useElectorateByPostcode } from '../hooks/useElectorateByPostcode';
import { useStatsMetrics, findMetric, StatsMetric } from '../hooks/useStatsMetrics';
import { useIndividualDonations } from '../hooks/useIndividualDonations';
import { SkeletonLoader } from '../components/SkeletonLoader';
import { SPACING, FONT_SIZE, FONT_WEIGHT, BORDER_RADIUS, SHADOWS } from '../constants/design';

// ── Source chip colors ──────────────────────────────────────────────
const SOURCE_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  verity: { bg: '#E8F5EE', text: '#00843D', label: 'Verity-computed' },
  abs:    { bg: '#E6F1FB', text: '#0C447C', label: 'ABS Census' },
  aec:    { bg: '#FAEEDA', text: '#633806', label: 'AEC' },
  pbo:    { bg: '#EEEDFE', text: '#3C3489', label: 'PBO' },
  treasury: { bg: '#FBEAF0', text: '#72243E', label: 'Treasury' },
};

// ── Show-your-working modal ─────────────────────────────────────────
function WorkingModal({
  visible,
  metric,
  onClose,
}: {
  visible: boolean;
  metric: StatsMetric | null;
  onClose: () => void;
}) {
  const { colors } = useTheme();
  if (!metric) return null;

  const sourceInfo = SOURCE_COLORS[metric.source] || SOURCE_COLORS.verity;

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' }}>
        <View style={{
          backgroundColor: colors.card,
          borderTopLeftRadius: BORDER_RADIUS.lg,
          borderTopRightRadius: BORDER_RADIUS.lg,
          padding: SPACING.xl,
          paddingBottom: SPACING.xxxl,
        }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.lg }}>
            <Text style={{ fontSize: FONT_SIZE.title, fontWeight: FONT_WEIGHT.bold, color: colors.text }}>
              Show your working
            </Text>
            <Pressable onPress={onClose} hitSlop={12}>
              <Ionicons name="close" size={24} color={colors.textMuted} />
            </Pressable>
          </View>

          <View style={{ marginBottom: SPACING.lg }}>
            <Text style={{ fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.semibold, color: colors.text, marginBottom: SPACING.xs }}>
              {metric.metric_key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
            </Text>
            <Text style={{ fontSize: FONT_SIZE.heading, fontWeight: FONT_WEIGHT.bold, color: '#00843D' }}>
              {metric.display_value}
            </Text>
          </View>

          <View style={{ backgroundColor: colors.surface, borderRadius: BORDER_RADIUS.sm, padding: SPACING.md, marginBottom: SPACING.md }}>
            <Row label="Source" value={sourceInfo.label} />
            <Row label="Period" value={metric.period ?? 'Current'} />
            <Row label="As of" value={metric.as_of} />
            {metric.source_url && <Row label="Reference" value="View source" isLink url={metric.source_url} />}
          </View>

          {metric.source === 'verity' && (
            <Text style={{ fontSize: FONT_SIZE.small, color: colors.textMuted, lineHeight: 18 }}>
              Computed by Verity from {metric.period === '47th Parliament' ? '47th Parliament' : ''} division vote records
              sourced from TheyVoteForYou.org.au (CC-BY-SA). Refreshed nightly.
            </Text>
          )}
          {metric.source === 'abs' && (
            <Text style={{ fontSize: FONT_SIZE.small, color: colors.textMuted, lineHeight: 18 }}>
              Australian Bureau of Statistics, Census of Population and Housing 2021.
              Commonwealth Electoral Division profiles.
            </Text>
          )}
        </View>
      </View>
    </Modal>
  );
}

function Row({ label, value, isLink, url }: { label: string; value: string; isLink?: boolean; url?: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: SPACING.xs }}>
      <Text style={{ fontSize: FONT_SIZE.small, color: colors.textMuted }}>{label}</Text>
      {isLink && url ? (
        <Pressable onPress={() => Linking.openURL(url)}>
          <Text style={{ fontSize: FONT_SIZE.small, color: '#00843D', fontWeight: FONT_WEIGHT.medium }}>{value}</Text>
        </Pressable>
      ) : (
        <Text style={{ fontSize: FONT_SIZE.small, color: colors.text, fontWeight: FONT_WEIGHT.medium }}>{value}</Text>
      )}
    </View>
  );
}

// ── Source chip ──────────────────────────────────────────────────────
function SourceChip({ source }: { source: string }) {
  const info = SOURCE_COLORS[source] || SOURCE_COLORS.verity;
  return (
    <View style={{
      backgroundColor: info.bg,
      paddingHorizontal: SPACING.sm,
      paddingVertical: 3,
      borderRadius: BORDER_RADIUS.sm,
      alignSelf: 'flex-start',
    }}>
      <Text style={{ fontSize: 10, fontWeight: FONT_WEIGHT.semibold, color: info.text }}>
        {info.label}
      </Text>
    </View>
  );
}

// ── Metric card (tappable → show working) ───────────────────────────
function MetricCard({
  label,
  metric,
  icon,
  onPress,
}: {
  label: string;
  metric: StatsMetric | undefined;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: (m: StatsMetric) => void;
}) {
  const { colors } = useTheme();

  if (!metric) return null;

  return (
    <Pressable
      onPress={() => onPress(metric)}
      style={({ pressed }) => ({
        backgroundColor: colors.card,
        borderRadius: BORDER_RADIUS.lg,
        padding: SPACING.lg,
        ...SHADOWS.sm,
        flex: 1,
        minWidth: 140,
        opacity: pressed ? 0.92 : 1,
        transform: [{ scale: pressed ? 0.98 : 1 }],
      })}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.sm }}>
        <Ionicons name={icon} size={16} color="#00843D" />
        <Text style={{ fontSize: FONT_SIZE.small, color: colors.textMuted, marginLeft: SPACING.xs, flex: 1 }}>
          {label}
        </Text>
      </View>
      <Text style={{ fontSize: FONT_SIZE.heading, fontWeight: FONT_WEIGHT.bold, color: colors.text, marginBottom: SPACING.xs }}>
        {metric.display_value}
      </Text>
      <SourceChip source={metric.source} />
    </Pressable>
  );
}

// ── Comparison row (electorate vs national) ─────────────────────────
function ComparisonRow({
  label,
  electorateMetric,
  nationalMetric,
  icon,
  onPress,
}: {
  label: string;
  electorateMetric: StatsMetric | undefined;
  nationalMetric: StatsMetric | undefined;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: (m: StatsMetric) => void;
}) {
  const { colors } = useTheme();
  if (!electorateMetric || !nationalMetric) return null;

  const eVal = Number(electorateMetric.value);
  const nVal = Number(nationalMetric.value);
  const diff = eVal - nVal;
  const diffPct = nVal !== 0 ? Math.round((diff / nVal) * 100) : 0;
  const isHigher = diff > 0;
  const diffColor = isHigher ? '#00843D' : '#DC3545';

  return (
    <Pressable
      onPress={() => onPress(electorateMetric)}
      style={({ pressed }) => ({
        backgroundColor: colors.card,
        borderRadius: BORDER_RADIUS.lg,
        padding: SPACING.lg,
        ...SHADOWS.sm,
        marginBottom: SPACING.md,
        opacity: pressed ? 0.92 : 1,
        transform: [{ scale: pressed ? 0.98 : 1 }],
      })}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.sm }}>
        <Ionicons name={icon} size={16} color="#00843D" />
        <Text style={{ fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.semibold, color: colors.text, marginLeft: SPACING.sm, flex: 1 }}>
          {label}
        </Text>
        <SourceChip source={electorateMetric.source} />
      </View>

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <View>
          <Text style={{ fontSize: FONT_SIZE.small, color: colors.textMuted, marginBottom: 2 }}>Local</Text>
          <Text style={{ fontSize: FONT_SIZE.title, fontWeight: FONT_WEIGHT.bold, color: colors.text }}>
            {electorateMetric.display_value}
          </Text>
        </View>
        <View style={{ alignItems: 'center' }}>
          <Ionicons
            name={isHigher ? 'arrow-up' : 'arrow-down'}
            size={14}
            color={diffColor}
          />
          <Text style={{ fontSize: FONT_SIZE.small, fontWeight: FONT_WEIGHT.semibold, color: diffColor }}>
            {diffPct > 0 ? '+' : ''}{diffPct}%
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={{ fontSize: FONT_SIZE.small, color: colors.textMuted, marginBottom: 2 }}>National</Text>
          <Text style={{ fontSize: FONT_SIZE.subtitle, fontWeight: FONT_WEIGHT.medium, color: colors.textBody }}>
            {nationalMetric.display_value}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

// ── Main screen ─────────────────────────────────────────────────────
export function StatsScreen({ navigation }: { navigation: any }) {
  const { colors } = useTheme();
  const { postcode } = useUser();
  const { member: myMP, electorate, loading: mpLoading } = useElectorateByPostcode(postcode);
  const { mpStats, electorateStats, nationalStats, loading: statsLoading } =
    useStatsMetrics(myMP?.id, electorate?.id);
  const { donations, total: donationTotal } = useIndividualDonations(myMP?.id);
  const [refreshing, setRefreshing] = useState(false);
  const [workingMetric, setWorkingMetric] = useState<StatsMetric | null>(null);

  const loading = mpLoading || statsLoading;

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  }, []);

  const showWorking = useCallback((m: StatsMetric) => {
    setWorkingMetric(m);
  }, []);

  // MP metrics
  const attendance = findMetric(mpStats, 'attendance_rate');
  const loyalty = findMetric(mpStats, 'party_loyalty_rate');
  const crossings = findMetric(mpStats, 'floor_crossings');
  const votesCast = findMetric(mpStats, 'votes_cast');

  // Electorate metrics
  const eMedianIncome = findMetric(electorateStats, 'median_household_income');
  const eRenting = findMetric(electorateStats, 'pct_renting');
  const eMedianAge = findMetric(electorateStats, 'median_age');
  const eMedianRent = findMetric(electorateStats, 'median_rent');
  const eOwned = findMetric(electorateStats, 'pct_owned_outright');

  // National metrics
  const nMedianIncome = findMetric(nationalStats, 'median_household_income');
  const nRenting = findMetric(nationalStats, 'pct_renting');
  const nMedianAge = findMetric(nationalStats, 'median_age');
  const nMedianRent = findMetric(nationalStats, 'median_rent');
  const nOwned = findMetric(nationalStats, 'pct_owned_outright');

  const mpName = myMP ? `${myMP.first_name} ${myMP.last_name}` : '';
  const partyRaw = myMP?.party as any;
  const partyObj = Array.isArray(partyRaw) ? partyRaw[0] : partyRaw;
  const partyName = partyObj?.short_name || partyObj?.name || '';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <WorkingModal visible={!!workingMetric} metric={workingMetric} onClose={() => setWorkingMetric(null)} />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: SPACING.xxxl }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#00843D" />}
      >
        {/* ── Header ─────────────────────────────────────── */}
        <View style={{ backgroundColor: '#00843D', paddingHorizontal: SPACING.xl, paddingTop: SPACING.xl, paddingBottom: SPACING.xxl }}>
          <Pressable onPress={() => navigation.goBack()} style={{ marginBottom: SPACING.md }} hitSlop={12}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </Pressable>
          <Text style={{ fontSize: FONT_SIZE.hero, fontWeight: FONT_WEIGHT.bold, color: '#fff', marginBottom: SPACING.xs }}>
            Verity Stats
          </Text>
          <Text style={{ fontSize: FONT_SIZE.body, color: 'rgba(255,255,255,0.8)' }}>
            {electorate ? `${electorate.name}, ${electorate.state}` : 'Set your postcode to personalise'}
          </Text>
        </View>

        {loading ? (
          <View style={{ padding: SPACING.xl }}>
            <SkeletonLoader width="100%" height={120} borderRadius={BORDER_RADIUS.lg} />
            <View style={{ height: SPACING.md }} />
            <SkeletonLoader width="100%" height={120} borderRadius={BORDER_RADIUS.lg} />
            <View style={{ height: SPACING.md }} />
            <SkeletonLoader width="100%" height={80} borderRadius={BORDER_RADIUS.lg} />
          </View>
        ) : (
          <View style={{ padding: SPACING.xl }}>

            {/* ── Section 1: Your MP this term ───────────── */}
            {myMP && mpStats.length > 0 && (
              <View style={{ marginBottom: SPACING.xxl }}>
                <SectionHeader title={`Your MP this term`} />
                <Pressable
                  onPress={() => navigation.navigate('MemberProfile', { memberId: myMP.id })}
                  style={({ pressed }) => ({
                    flexDirection: 'row',
                    alignItems: 'center',
                    marginBottom: SPACING.lg,
                    opacity: pressed ? 0.7 : 1,
                  })}
                >
                  <View style={{
                    width: 40, height: 40, borderRadius: BORDER_RADIUS.full,
                    backgroundColor: partyObj?.colour || '#00843D',
                    justifyContent: 'center', alignItems: 'center', marginRight: SPACING.md,
                  }}>
                    <Text style={{ color: '#fff', fontWeight: FONT_WEIGHT.bold, fontSize: FONT_SIZE.body }}>
                      {myMP.first_name[0]}{myMP.last_name[0]}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: FONT_SIZE.subtitle, fontWeight: FONT_WEIGHT.semibold, color: colors.text }}>
                      {mpName}
                    </Text>
                    <Text style={{ fontSize: FONT_SIZE.small, color: colors.textMuted }}>
                      {partyName} {'\u00B7'} {electorate?.name}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                </Pressable>

                {/* 2x2 metric grid */}
                <View style={{ flexDirection: 'row', gap: SPACING.md, marginBottom: SPACING.md }}>
                  <MetricCard label="Attendance" metric={attendance} icon="hand-left-outline" onPress={showWorking} />
                  <MetricCard label="Party loyalty" metric={loyalty} icon="people-outline" onPress={showWorking} />
                </View>
                <View style={{ flexDirection: 'row', gap: SPACING.md }}>
                  <MetricCard label="Floor crossings" metric={crossings} icon="swap-horizontal-outline" onPress={showWorking} />
                  <MetricCard label="Votes cast" metric={votesCast} icon="checkmark-done-outline" onPress={showWorking} />
                </View>

                {/* Integrity note */}
                {votesCast && Number(votesCast.value) < 20 && (
                  <View style={{
                    backgroundColor: colors.surface,
                    borderRadius: BORDER_RADIUS.sm,
                    padding: SPACING.md,
                    marginTop: SPACING.md,
                    flexDirection: 'row',
                    alignItems: 'center',
                  }}>
                    <Ionicons name="information-circle-outline" size={16} color={colors.textMuted} />
                    <Text style={{ fontSize: FONT_SIZE.small, color: colors.textMuted, marginLeft: SPACING.sm, flex: 1 }}>
                      Not enough vote data yet for reliable stats. Check back as more divisions are recorded.
                    </Text>
                  </View>
                )}
              </View>
            )}

            {/* ── Section 2: Electorate vs Australia ─────── */}
            {electorate && electorateStats.length > 0 && (
              <View style={{ marginBottom: SPACING.xxl }}>
                <SectionHeader title={`${electorate.name} vs Australia`} />

                <ComparisonRow
                  label="Median household income"
                  electorateMetric={eMedianIncome}
                  nationalMetric={nMedianIncome}
                  icon="cash-outline"
                  onPress={showWorking}
                />
                <ComparisonRow
                  label="Renting"
                  electorateMetric={eRenting}
                  nationalMetric={nRenting}
                  icon="home-outline"
                  onPress={showWorking}
                />
                <ComparisonRow
                  label="Median rent"
                  electorateMetric={eMedianRent}
                  nationalMetric={nMedianRent}
                  icon="pricetag-outline"
                  onPress={showWorking}
                />
                <ComparisonRow
                  label="Median age"
                  electorateMetric={eMedianAge}
                  nationalMetric={nMedianAge}
                  icon="people-circle-outline"
                  onPress={showWorking}
                />
                <ComparisonRow
                  label="Own outright"
                  electorateMetric={eOwned}
                  nationalMetric={nOwned}
                  icon="key-outline"
                  onPress={showWorking}
                />
              </View>
            )}

            {/* ── Section 3: Follow the money ────────────── */}
            {myMP && (
              <View style={{ marginBottom: SPACING.xxl }}>
                <SectionHeader title="Follow the money" />
                {donations.length > 0 ? (
                  <View style={{
                    backgroundColor: colors.card,
                    borderRadius: BORDER_RADIUS.lg,
                    padding: SPACING.lg,
                    ...SHADOWS.sm,
                  }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: SPACING.md }}>
                      <Text style={{ fontSize: FONT_SIZE.small, color: colors.textMuted }}>Total declared donations</Text>
                      <SourceChip source="aec" />
                    </View>
                    <Text style={{ fontSize: FONT_SIZE.heading, fontWeight: FONT_WEIGHT.bold, color: colors.text, marginBottom: SPACING.lg }}>
                      ${donationTotal.toLocaleString()}
                    </Text>
                    {donations.slice(0, 5).map((d, i) => (
                      <View key={d.id || i} style={{
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        paddingVertical: SPACING.sm,
                        borderTopWidth: i === 0 ? 0 : 0.5,
                        borderTopColor: colors.border,
                      }}>
                        <Text style={{ fontSize: FONT_SIZE.small, color: colors.text, flex: 1 }} numberOfLines={1}>
                          {d.donor_name}
                        </Text>
                        <Text style={{ fontSize: FONT_SIZE.small, fontWeight: FONT_WEIGHT.semibold, color: colors.text }}>
                          ${Number(d.amount).toLocaleString()}
                        </Text>
                      </View>
                    ))}
                  </View>
                ) : (
                  <View style={{
                    backgroundColor: colors.card,
                    borderRadius: BORDER_RADIUS.lg,
                    padding: SPACING.xl,
                    ...SHADOWS.sm,
                    alignItems: 'center',
                  }}>
                    <Ionicons name="wallet-outline" size={32} color={colors.textMuted} />
                    <Text style={{ fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.semibold, color: colors.text, marginTop: SPACING.md }}>
                      No individual donations on record
                    </Text>
                    <Text style={{ fontSize: FONT_SIZE.small, color: colors.textMuted, marginTop: SPACING.xs, textAlign: 'center' }}>
                      {mpName} has no AEC-declared personal donations for recent financial years.
                    </Text>
                    <SourceChip source="aec" />
                  </View>
                )}
              </View>
            )}

            {/* ── Section 4: Go deeper ─────────────────── */}
            <View style={{ marginBottom: SPACING.xxl }}>
              <SectionHeader title="Go Deeper" />
              <View style={{ gap: SPACING.md }}>
                <HubLink
                  icon="heart-outline"
                  label="Verity Match"
                  subtitle="Find MPs who align with your positions"
                  onPress={() => navigation.navigate('Match')}
                  colors={colors}
                />
                <HubLink
                  icon="wallet-outline"
                  label="Policy Impact"
                  subtitle="How do recent bills affect your household?"
                  onPress={() => navigation.navigate('Wallet')}
                  colors={colors}
                />
              </View>
            </View>

            {/* ── Data provenance footer ─────────────────── */}
            <View style={{ paddingTop: SPACING.lg, borderTopWidth: 0.5, borderTopColor: colors.border }}>
              <Text style={{ fontSize: 10, color: colors.textMuted, lineHeight: 16, textAlign: 'center' }}>
                Vote data: TheyVoteForYou.org.au (CC-BY-SA). Demographics: ABS Census 2021.
                Donations: AEC Transparency Register. All figures rounded. Tap any stat to see its source.
              </Text>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Hub link ────────────────────────────────────────────────────────
function HubLink({
  icon,
  label,
  subtitle,
  onPress,
  colors,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  subtitle: string;
  onPress: () => void;
  colors: any;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: colors.card,
        borderRadius: BORDER_RADIUS.lg,
        padding: SPACING.lg,
        ...SHADOWS.sm,
        opacity: pressed ? 0.92 : 1,
      })}
    >
      <View style={{
        width: 40, height: 40, borderRadius: 20,
        backgroundColor: '#E8F5EE', justifyContent: 'center', alignItems: 'center',
        marginRight: SPACING.md,
      }}>
        <Ionicons name={icon} size={20} color="#00843D" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.semibold, color: colors.text }}>
          {label}
        </Text>
        <Text style={{ fontSize: FONT_SIZE.small, color: colors.textMuted, marginTop: 2 }}>
          {subtitle}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
    </Pressable>
  );
}

// ── Section header ──────────────────────────────────────────────────
function SectionHeader({ title }: { title: string }) {
  const { colors } = useTheme();
  return (
    <Text style={{
      fontSize: FONT_SIZE.caption,
      fontWeight: FONT_WEIGHT.semibold,
      color: colors.textMuted,
      letterSpacing: 0.8,
      textTransform: 'uppercase',
      marginBottom: SPACING.md,
    }}>
      {title}
    </Text>
  );
}
