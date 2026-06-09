/**
 * Policy -> Your Wallet — estimates how recent bills affect the user's household
 * based on their demographics (income, housing, family status).
 *
 * Feature-flag gated: wallet_calculator. Shows "Coming soon" if disabled.
 * Disclaimer: estimates only, not financial advice.
 */
import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';
import { useWalletImpact, WalletImpactItem, ImpactDirection } from '../hooks/useWalletImpact';
import { useElectorateByPostcode } from '../hooks/useElectorateByPostcode';
import { useElectorateDemographics } from '../hooks/useElectorateDemographics';
import { useUser } from '../context/UserContext';
import { isFeatureEnabled } from '../lib/featureFlags';
import {
  SPACING,
  FONT_SIZE,
  FONT_WEIGHT,
  BORDER_RADIUS,
  SHADOWS,
} from '../constants/design';

// ── Constants ────────────────────────────────────────────────────────────────

const GREEN = '#00843D';

const IMPACT_CONFIG: Record<ImpactDirection, { icon: string; color: string; label: string }> = {
  positive: { icon: 'arrow-up-circle', color: GREEN, label: 'Positive' },
  negative: { icon: 'arrow-down-circle', color: '#DC3545', label: 'Negative' },
  neutral:  { icon: 'remove-circle',    color: '#6B7280', label: 'Neutral' },
};

const MAGNITUDE_LABEL: Record<string, string> = {
  high: 'High impact',
  medium: 'Medium impact',
  low: 'Low impact',
};

const INCOME_LABELS: Record<string, string> = {
  under_50k: 'Under $50k',
  '50k_100k': '$50k - $100k',
  '100k_150k': '$100k - $150k',
  '150k_plus': '$150k+',
};

const HOUSING_LABELS: Record<string, string> = {
  renter: 'Renting',
  owner: 'Own outright',
  mortgage: 'Paying mortgage',
  other: 'Other',
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatWeeklyIncome(weekly: number | null): string {
  if (!weekly) return '—';
  const annual = Math.round(weekly * 52);
  if (annual >= 1000) return `$${Math.round(annual / 1000)}k/yr`;
  return `$${annual.toLocaleString()}/yr`;
}

// ── Components ───────────────────────────────────────────────────────────────

function SkeletonCard({ colors }: { colors: any }) {
  return (
    <View style={[styles.card, { backgroundColor: colors.card }, SHADOWS.sm]}>
      <View style={[styles.skeletonLine, { backgroundColor: colors.cardAlt, width: '70%' }]} />
      <View style={[styles.skeletonLine, { backgroundColor: colors.cardAlt, width: '50%', marginTop: SPACING.sm }]} />
      <View style={[styles.skeletonLine, { backgroundColor: colors.cardAlt, width: '90%', marginTop: SPACING.sm }]} />
    </View>
  );
}

function ComingSoonState({ colors }: { colors: any }) {
  return (
    <View style={styles.emptyContainer}>
      <Ionicons name="lock-closed-outline" size={48} color={colors.textMuted} />
      <Text style={[styles.emptyTitle, { color: colors.text }]}>Under Development</Text>
      <Text style={[styles.emptyBody, { color: colors.textBody }]}>
        Policy wallet impact analysis is being built. We'll notify you when it's ready.
      </Text>
    </View>
  );
}

function EmptyState({ colors }: { colors: any }) {
  return (
    <View style={styles.emptyContainer}>
      <Ionicons name="wallet-outline" size={48} color={colors.textMuted} />
      <Text style={[styles.emptyTitle, { color: colors.text }]}>No wallet impacts found</Text>
      <Text style={[styles.emptyBody, { color: colors.textBody }]}>
        We could not find recent bills that affect your household based on your profile.
        Make sure your postcode and profile are up to date in Settings.
      </Text>
    </View>
  );
}

function ErrorState({ message, colors }: { message: string; colors: any }) {
  return (
    <View style={styles.emptyContainer}>
      <Ionicons name="alert-circle-outline" size={48} color={colors.red} />
      <Text style={[styles.emptyTitle, { color: colors.text }]}>Something went wrong</Text>
      <Text style={[styles.emptyBody, { color: colors.textBody }]}>{message}</Text>
    </View>
  );
}

// ── Impact Card ──────────────────────────────────────────────────────────────

function ImpactCard({
  item,
  colors,
  onPress,
}: {
  item: WalletImpactItem;
  colors: any;
  onPress: () => void;
}) {
  const cfg = IMPACT_CONFIG[item.impact_direction];
  const magLabel = MAGNITUDE_LABEL[item.impact_magnitude] ?? '';

  return (
    <Pressable
      onPress={onPress}
      style={[styles.card, { backgroundColor: colors.card }, SHADOWS.sm]}
    >
      <View style={styles.cardHeader}>
        <Ionicons
          name={cfg.icon as any}
          size={22}
          color={cfg.color}
          style={styles.impactIcon}
        />
        <View style={styles.cardHeaderText}>
          <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={2}>
            {item.bill_title}
          </Text>
        </View>
      </View>

      {/* Impact badge row */}
      <View style={styles.badgeRow}>
        <View style={[styles.badge, { backgroundColor: cfg.color + '18' }]}>
          <Text style={[styles.badgeText, { color: cfg.color }]}>{cfg.label}</Text>
        </View>
        <View style={[styles.badge, { backgroundColor: colors.cardAlt }]}>
          <Text style={[styles.badgeText, { color: colors.textBody }]}>{magLabel}</Text>
        </View>
      </View>

      {/* Summary */}
      <Text style={[styles.cardSummary, { color: colors.textBody }]}>
        {item.impact_summary}
      </Text>

      {/* Source attribution */}
      <Text style={[styles.cardSource, { color: colors.textMuted }]}>
        Based on {item.source}
      </Text>
    </Pressable>
  );
}

// ── Profile Summary Card ─────────────────────────────────────────────────────

function ProfileSummaryCard({ profile, colors }: { profile: any; colors: any }) {
  const chips: string[] = [];
  if (profile.income_bracket && INCOME_LABELS[profile.income_bracket]) {
    chips.push(INCOME_LABELS[profile.income_bracket]);
  }
  if (profile.housing_status && HOUSING_LABELS[profile.housing_status]) {
    chips.push(HOUSING_LABELS[profile.housing_status]);
  }
  if (profile.has_children) chips.push('Parent');
  if (profile.is_student) chips.push('Student');
  if (profile.is_retired) chips.push('Retired');
  if (profile.electorate_name) chips.push(profile.electorate_name);

  if (chips.length === 0) {
    return (
      <View style={[styles.profileCard, { backgroundColor: colors.card }, SHADOWS.sm]}>
        <Text style={[styles.profileEmpty, { color: colors.textBody }]}>
          Complete your profile in Settings to get personalised wallet estimates.
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.profileCard, { backgroundColor: colors.card }, SHADOWS.sm]}>
      <Text style={[styles.profileLabel, { color: colors.textMuted }]}>YOUR PROFILE</Text>
      <View style={styles.chipRow}>
        {chips.map((chip) => (
          <View key={chip} style={[styles.chip, { backgroundColor: GREEN + '14' }]}>
            <Text style={[styles.chipText, { color: GREEN }]}>{chip}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ── Electorate Comparison Card ───────────────────────────────────────────────

function ElectorateCard({
  demographics,
  profile,
  colors,
}: {
  demographics: any;
  profile: any;
  colors: any;
}) {
  if (!demographics) return null;

  const medianIncome = demographics.median_household_income_weekly;
  const medianRent = demographics.median_rent_weekly;
  const medianMortgage = demographics.median_mortgage_monthly;

  return (
    <View style={[styles.card, { backgroundColor: colors.card }, SHADOWS.sm]}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>Your Electorate</Text>
      {profile.electorate_name && (
        <Text style={[styles.electorateName, { color: GREEN }]}>{profile.electorate_name}</Text>
      )}

      <View style={styles.statRow}>
        {medianIncome != null && (
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: colors.text }]}>
              {formatWeeklyIncome(medianIncome)}
            </Text>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>
              Median household income
            </Text>
          </View>
        )}
        {medianRent != null && (
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: colors.text }]}>
              ${medianRent}/wk
            </Text>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>Median rent</Text>
          </View>
        )}
        {medianMortgage != null && (
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: colors.text }]}>
              ${medianMortgage.toLocaleString()}/mo
            </Text>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>
              Median mortgage
            </Text>
          </View>
        )}
      </View>

      <Text style={[styles.censusNote, { color: colors.textMuted }]}>
        Source: ABS Census 2021
      </Text>
    </View>
  );
}

// ── Main Screen ──────────────────────────────────────────────────────────────

export function WalletScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const nav = useNavigation<any>();
  const { postcode } = useUser();
  const { electorate } = useElectorateByPostcode(postcode);
  const { demographics } = useElectorateDemographics(electorate?.id);

  const enabled = isFeatureEnabled('wallet_calculator');
  const { items, profile, loading, error, refresh } = useWalletImpact();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  const navigateToBill = useCallback(
    (billId: string, billTitle: string) => {
      nav.navigate('BillDetail', { billId, title: billTitle });
    },
    [nav],
  );

  const renderImpactCard = useCallback(
    ({ item }: { item: WalletImpactItem }) => (
      <ImpactCard
        item={item}
        colors={colors}
        onPress={() => navigateToBill(item.bill_id, item.bill_title)}
      />
    ),
    [colors, navigateToBill],
  );

  // ── Feature flag gate ──
  if (!enabled) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <Pressable onPress={() => nav.goBack()} hitSlop={12}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Policy → Your Wallet</Text>
          <View style={{ width: 24 }} />
        </View>
        <ComingSoonState colors={colors} />
      </View>
    );
  }

  // ── Loading skeleton ──
  if (loading && items.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <Pressable onPress={() => nav.goBack()} hitSlop={12}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Policy → Your Wallet</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.skeletonContainer}>
          <SkeletonCard colors={colors} />
          <SkeletonCard colors={colors} />
          <SkeletonCard colors={colors} />
        </View>
      </View>
    );
  }

  // ── List header (profile + electorate) ──
  const ListHeader = () => (
    <View>
      {/* Subtitle */}
      <Text style={[styles.subtitle, { color: colors.textBody }]}>
        Estimated impact of recent bills on your household, based on your profile and publicly available data.
      </Text>

      {/* Profile summary */}
      <ProfileSummaryCard profile={profile} colors={colors} />

      {/* Electorate demographics */}
      <ElectorateCard demographics={demographics} profile={profile} colors={colors} />

      {/* Section heading */}
      {items.length > 0 && (
        <Text style={[styles.sectionHeading, { color: colors.text }]}>
          How Recent Bills Affect You
        </Text>
      )}
    </View>
  );

  // ── List footer (disclaimer) ──
  const ListFooter = () => (
    <View style={styles.disclaimerContainer}>
      <Ionicons name="information-circle-outline" size={16} color={colors.textMuted} />
      <Text style={[styles.disclaimerText, { color: colors.textMuted }]}>
        Estimates based on publicly available data. Not financial advice. Actual impact
        depends on your individual circumstances and how legislation is implemented.
      </Text>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Pressable onPress={() => nav.goBack()} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Ionicons name="wallet-outline" size={20} color={GREEN} style={{ marginRight: SPACING.xs }} />
          <Text style={[styles.headerTitle, { color: colors.text }]}>Policy → Your Wallet</Text>
        </View>
        <View style={{ width: 24 }} />
      </View>

      {/* Error state */}
      {error ? (
        <FlatList
          data={[]}
          renderItem={() => null}
          ListHeaderComponent={<ErrorState message={error} colors={colors} />}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={GREEN} />
          }
        />
      ) : items.length === 0 && !loading ? (
        <FlatList
          data={[]}
          renderItem={() => null}
          ListHeaderComponent={
            <>
              <ListHeader />
              <EmptyState colors={colors} />
            </>
          }
          ListFooterComponent={<ListFooter />}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={GREEN} />
          }
        />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.bill_id}
          renderItem={renderImpactCard}
          ListHeaderComponent={<ListHeader />}
          ListFooterComponent={<ListFooter />}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={GREEN} />
          }
          windowSize={5}
          maxToRenderPerBatch={10}
        />
      )}
    </View>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerCenter: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: FONT_SIZE.subtitle,
    fontWeight: FONT_WEIGHT.semibold,
  },
  subtitle: {
    fontSize: FONT_SIZE.body,
    lineHeight: 22,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.sm,
  },
  listContent: {
    paddingBottom: SPACING.xxxl,
  },

  // ── Profile card ──
  profileCard: {
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.md,
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
  },
  profileLabel: {
    fontSize: FONT_SIZE.caption,
    fontWeight: FONT_WEIGHT.semibold,
    letterSpacing: 0.8,
    marginBottom: SPACING.sm,
  },
  profileEmpty: {
    fontSize: FONT_SIZE.body,
    lineHeight: 22,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  chip: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.full,
  },
  chipText: {
    fontSize: FONT_SIZE.small,
    fontWeight: FONT_WEIGHT.medium,
  },

  // ── Section heading ──
  sectionHeading: {
    fontSize: FONT_SIZE.title,
    fontWeight: FONT_WEIGHT.bold,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.xl,
    paddingBottom: SPACING.sm,
  },
  sectionTitle: {
    fontSize: FONT_SIZE.subtitle,
    fontWeight: FONT_WEIGHT.semibold,
    marginBottom: SPACING.xs,
  },

  // ── Impact card ──
  card: {
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.md,
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  impactIcon: {
    marginRight: SPACING.sm,
    marginTop: 1,
  },
  cardHeaderText: {
    flex: 1,
  },
  cardTitle: {
    fontSize: FONT_SIZE.body,
    fontWeight: FONT_WEIGHT.semibold,
    lineHeight: 22,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.sm,
    marginLeft: 30, // align with text after icon
  },
  badge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.sm,
  },
  badgeText: {
    fontSize: FONT_SIZE.caption,
    fontWeight: FONT_WEIGHT.medium,
  },
  cardSummary: {
    fontSize: FONT_SIZE.body,
    lineHeight: 22,
    marginTop: SPACING.sm,
    marginLeft: 30,
  },
  cardSource: {
    fontSize: FONT_SIZE.caption,
    marginTop: SPACING.sm,
    marginLeft: 30,
  },

  // ── Electorate card ──
  electorateName: {
    fontSize: FONT_SIZE.body,
    fontWeight: FONT_WEIGHT.semibold,
    marginBottom: SPACING.md,
  },
  statRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.lg,
  },
  statItem: {
    minWidth: 100,
  },
  statValue: {
    fontSize: FONT_SIZE.subtitle,
    fontWeight: FONT_WEIGHT.bold,
  },
  statLabel: {
    fontSize: FONT_SIZE.caption,
    marginTop: 2,
  },
  censusNote: {
    fontSize: FONT_SIZE.caption,
    marginTop: SPACING.md,
  },

  // ── Disclaimer ──
  disclaimerContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.xl,
    paddingBottom: SPACING.lg,
    gap: SPACING.sm,
  },
  disclaimerText: {
    flex: 1,
    fontSize: FONT_SIZE.caption,
    lineHeight: 18,
  },

  // ── Empty / error states ──
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.xxl,
    paddingVertical: SPACING.xxxl,
  },
  emptyTitle: {
    fontSize: FONT_SIZE.subtitle,
    fontWeight: FONT_WEIGHT.semibold,
    marginTop: SPACING.lg,
    textAlign: 'center',
  },
  emptyBody: {
    fontSize: FONT_SIZE.body,
    lineHeight: 22,
    textAlign: 'center',
    marginTop: SPACING.sm,
  },

  // ── Skeleton ──
  skeletonContainer: {
    paddingTop: SPACING.lg,
  },
  skeletonLine: {
    height: 14,
    borderRadius: BORDER_RADIUS.sm,
  },
});
