import React, { useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  RefreshControl,
  Share,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../context/ThemeContext';
import {
  useMorningSignal,
  MorningSignalStory,
  ShiftedPosition,
  BillMovement,
  Blindspot,
} from '../hooks/useMorningSignal';
import { SkeletonLoader } from '../components/SkeletonLoader';
import {
  SPACING,
  FONT_SIZE,
  FONT_WEIGHT,
  BORDER_RADIUS,
  SHADOWS,
} from '../constants/design';
import { hapticLight } from '../lib/haptics';
import { track } from '../lib/analytics';

/* ───────────────────────── Helpers ───────────────────────── */

function formatHeaderDate(): string {
  return new Date().toLocaleDateString('en-AU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/* ───────────────────────── Sub-components ────────────────── */

function SectionHeader({
  icon,
  label,
  iconColor,
  textColor,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  iconColor: string;
  textColor: string;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.sm,
        marginBottom: SPACING.md,
      }}
    >
      <Ionicons name={icon} size={16} color={iconColor} />
      <Text
        style={{
          fontSize: FONT_SIZE.caption,
          fontWeight: FONT_WEIGHT.bold,
          color: textColor,
          letterSpacing: 0.8,
          textTransform: 'uppercase',
        }}
      >
        {label}
      </Text>
    </View>
  );
}

function StoryCard({
  story,
  index,
  colors,
  onPress,
}: {
  story: MorningSignalStory;
  index: number;
  colors: any;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={story.headline}
      style={({ pressed }) => ({
        backgroundColor: colors.card,
        borderRadius: BORDER_RADIUS.lg,
        padding: SPACING.lg,
        marginBottom: SPACING.sm,
        opacity: pressed ? 0.85 : 1,
        ...SHADOWS.sm,
      })}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'flex-start',
          gap: SPACING.md,
        }}
      >
        <View
          style={{
            width: 28,
            height: 28,
            borderRadius: 14,
            backgroundColor: '#E8F5EE',
            justifyContent: 'center',
            alignItems: 'center',
            flexShrink: 0,
          }}
        >
          <Text
            style={{
              fontSize: FONT_SIZE.caption,
              fontWeight: FONT_WEIGHT.bold,
              color: '#00843D',
            }}
          >
            {index + 1}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontSize: FONT_SIZE.subtitle,
              fontWeight: FONT_WEIGHT.semibold,
              color: colors.text,
              lineHeight: 22,
              marginBottom: SPACING.xs,
            }}
            numberOfLines={3}
          >
            {story.headline}
          </Text>
          {story.why_it_matters ? (
            <Text
              style={{
                fontSize: FONT_SIZE.body,
                color: colors.textBody,
                lineHeight: 21,
              }}
              numberOfLines={3}
            >
              {story.why_it_matters}
            </Text>
          ) : null}
          {story.source_ids && story.source_ids.length > 0 && (
            <Text
              style={{
                fontSize: FONT_SIZE.caption,
                color: colors.textMuted,
                marginTop: SPACING.xs,
              }}
            >
              {story.source_ids.length} source{story.source_ids.length !== 1 ? 's' : ''}
            </Text>
          )}
        </View>
      </View>
    </Pressable>
  );
}

function ShiftedPositionCard({
  shift,
  colors,
}: {
  shift: ShiftedPosition;
  colors: any;
}) {
  return (
    <View
      style={{
        backgroundColor: colors.card,
        borderRadius: BORDER_RADIUS.lg,
        padding: SPACING.lg,
        marginBottom: SPACING.sm,
        ...SHADOWS.sm,
      }}
    >
      <Text
        style={{
          fontSize: FONT_SIZE.subtitle,
          fontWeight: FONT_WEIGHT.semibold,
          color: colors.text,
          marginBottom: SPACING.xs,
        }}
      >
        {shift.member_name}
      </Text>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: SPACING.sm,
        }}
      >
        <View
          style={{
            backgroundColor: '#FFF7ED',
            paddingHorizontal: SPACING.sm,
            paddingVertical: SPACING.xs,
            borderRadius: BORDER_RADIUS.sm,
          }}
        >
          <Text
            style={{
              fontSize: FONT_SIZE.caption,
              fontWeight: FONT_WEIGHT.medium,
              color: '#EA580C',
            }}
          >
            {shift.old_position}
          </Text>
        </View>
        <Ionicons name="arrow-forward" size={14} color={colors.textMuted} />
        <View
          style={{
            backgroundColor: '#E8F5EE',
            paddingHorizontal: SPACING.sm,
            paddingVertical: SPACING.xs,
            borderRadius: BORDER_RADIUS.sm,
          }}
        >
          <Text
            style={{
              fontSize: FONT_SIZE.caption,
              fontWeight: FONT_WEIGHT.medium,
              color: '#00843D',
            }}
          >
            {shift.new_position}
          </Text>
        </View>
      </View>
    </View>
  );
}

function BillMovementCard({
  bill,
  colors,
}: {
  bill: BillMovement;
  colors: any;
}) {
  return (
    <View
      style={{
        backgroundColor: colors.card,
        borderRadius: BORDER_RADIUS.lg,
        padding: SPACING.lg,
        marginBottom: SPACING.sm,
        ...SHADOWS.sm,
      }}
    >
      <Text
        style={{
          fontSize: FONT_SIZE.body,
          fontWeight: FONT_WEIGHT.semibold,
          color: colors.text,
          lineHeight: 21,
          marginBottom: SPACING.sm,
        }}
        numberOfLines={2}
      >
        {bill.bill_title}
      </Text>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: SPACING.sm,
        }}
      >
        <View
          style={{
            backgroundColor: colors.surface,
            paddingHorizontal: SPACING.sm,
            paddingVertical: SPACING.xs,
            borderRadius: BORDER_RADIUS.sm,
          }}
        >
          <Text
            style={{
              fontSize: FONT_SIZE.caption,
              color: colors.textMuted,
            }}
          >
            {bill.from_stage}
          </Text>
        </View>
        <Ionicons name="arrow-forward" size={12} color={colors.textMuted} />
        <View
          style={{
            backgroundColor: '#EFF6FF',
            paddingHorizontal: SPACING.sm,
            paddingVertical: SPACING.xs,
            borderRadius: BORDER_RADIUS.sm,
          }}
        >
          <Text
            style={{
              fontSize: FONT_SIZE.caption,
              fontWeight: FONT_WEIGHT.medium,
              color: '#2563EB',
            }}
          >
            {bill.to_stage}
          </Text>
        </View>
      </View>
    </View>
  );
}

function BlindspotCard({
  blindspot,
  colors,
}: {
  blindspot: Blindspot;
  colors: any;
}) {
  return (
    <View
      style={{
        backgroundColor: colors.card,
        borderRadius: BORDER_RADIUS.lg,
        padding: SPACING.lg,
        borderLeftWidth: 3,
        borderLeftColor: '#8B5CF6',
        ...SHADOWS.sm,
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: SPACING.sm,
          marginBottom: SPACING.sm,
        }}
      >
        <Ionicons name="eye-off-outline" size={16} color="#8B5CF6" />
        <Text
          style={{
            fontSize: FONT_SIZE.caption,
            fontWeight: FONT_WEIGHT.bold,
            color: '#8B5CF6',
            textTransform: 'uppercase',
            letterSpacing: 0.5,
          }}
        >
          Coverage gap: {blindspot.gap_side}
        </Text>
      </View>
      <Text
        style={{
          fontSize: FONT_SIZE.subtitle,
          fontWeight: FONT_WEIGHT.semibold,
          color: colors.text,
          marginBottom: SPACING.xs,
        }}
      >
        {blindspot.topic}
      </Text>
      <Text
        style={{
          fontSize: FONT_SIZE.small,
          color: colors.textMuted,
        }}
      >
        {blindspot.story_ids.length} stor{blindspot.story_ids.length !== 1 ? 'ies' : 'y'} with limited coverage from the {blindspot.gap_side}
      </Text>
    </View>
  );
}

/* ───────────────────────── Loading skeleton ──────────────── */

function LoadingSkeleton() {
  return (
    <View style={{ padding: 20, gap: SPACING.lg }}>
      <SkeletonLoader height={24} width="60%" borderRadius={BORDER_RADIUS.sm} />
      <SkeletonLoader height={100} borderRadius={BORDER_RADIUS.lg} />
      <SkeletonLoader height={100} borderRadius={BORDER_RADIUS.lg} />
      <SkeletonLoader height={100} borderRadius={BORDER_RADIUS.lg} />
      <SkeletonLoader height={20} width="40%" borderRadius={BORDER_RADIUS.sm} />
      <SkeletonLoader height={80} borderRadius={BORDER_RADIUS.lg} />
      <SkeletonLoader height={20} width="40%" borderRadius={BORDER_RADIUS.sm} />
      <SkeletonLoader height={80} borderRadius={BORDER_RADIUS.lg} />
    </View>
  );
}

/* ───────────────────────── Empty state ───────────────────── */

function EmptyState({ colors }: { colors: any }) {
  return (
    <View style={{ padding: 20, alignItems: 'center', marginTop: SPACING.xxl }}>
      <Ionicons name="newspaper-outline" size={48} color={colors.textMuted} />
      <Text
        style={{
          fontSize: FONT_SIZE.subtitle,
          fontWeight: FONT_WEIGHT.bold,
          color: colors.text,
          marginTop: SPACING.lg,
          textAlign: 'center',
        }}
      >
        No digest available yet
      </Text>
      <Text
        style={{
          fontSize: FONT_SIZE.body,
          color: colors.textMuted,
          textAlign: 'center',
          marginTop: SPACING.sm,
          lineHeight: 22,
        }}
      >
        Your daily 90-second digest is generated each morning.{'\n'}Pull down to refresh.
      </Text>
    </View>
  );
}

/* ───────────────────────── Main screen ───────────────────── */

export function Daily90Screen({ navigation }: any) {
  const { colors } = useTheme();
  const { signal, loading, refresh } = useMorningSignal();
  const [refreshing, setRefreshing] = React.useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  const handleShare = useCallback(async () => {
    hapticLight();
    track('daily90_share', {}, 'Daily90');

    if (!signal) return;

    const headlines = (signal.top_stories ?? [])
      .slice(0, 3)
      .map((s, i) => `${i + 1}. ${s.headline}`)
      .join('\n');

    const message = [
      `Your Daily 90 — ${formatHeaderDate()}`,
      '',
      headlines || 'No top stories today.',
      '',
      'Get your daily civic digest on Verity.',
    ].join('\n');

    try {
      await Share.share({
        message,
        ...(Platform.OS === 'ios' ? { url: 'https://verity.com.au' } : {}),
      });
    } catch {
      // User cancelled or share failed — silent
    }
  }, [signal]);

  const topStories = signal?.top_stories?.slice(0, 3) ?? [];
  const shiftedPositions = signal?.shifted_positions ?? [];
  const billMovements = signal?.bill_movements ?? [];
  const blindspot = signal?.blindspot ?? null;

  const hasMP = shiftedPositions.length > 0;
  const hasBills = billMovements.length > 0;
  const hasBlindspot = blindspot !== null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.textMuted}
          />
        }
      >
        {/* ── Green gradient header ── */}
        <LinearGradient
          colors={['#00843D', '#00A34D']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            paddingTop: SPACING.lg,
            paddingHorizontal: 20,
            paddingBottom: SPACING.xxxl,
            overflow: 'hidden',
          }}
        >
          {/* Decorative circle */}
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: -30,
              right: -30,
              width: 140,
              height: 140,
              borderRadius: 70,
              backgroundColor: 'rgba(255,255,255,0.08)',
            }}
          />

          {/* Back button */}
          <Pressable
            onPress={() => navigation.goBack()}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={{ marginBottom: SPACING.xl }}
          >
            <Ionicons name="arrow-back" size={22} color="#ffffff" />
          </Pressable>

          {/* Label */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: SPACING.sm,
              marginBottom: SPACING.sm,
            }}
          >
            <Ionicons name="flash-outline" size={18} color="rgba(255,255,255,0.8)" />
            <Text
              style={{
                fontSize: FONT_SIZE.caption,
                fontWeight: FONT_WEIGHT.bold,
                color: 'rgba(255,255,255,0.8)',
                letterSpacing: 1,
                textTransform: 'uppercase',
              }}
            >
              90-SECOND DIGEST
            </Text>
          </View>

          {/* Title */}
          <Text
            style={{
              fontSize: FONT_SIZE.heading + 6,
              fontWeight: FONT_WEIGHT.bold,
              color: '#ffffff',
              letterSpacing: -0.5,
            }}
          >
            Your Daily 90
          </Text>

          {/* Date */}
          <Text
            style={{
              fontSize: FONT_SIZE.body,
              color: 'rgba(255,255,255,0.7)',
              marginTop: SPACING.sm,
            }}
          >
            {formatHeaderDate()}
          </Text>
        </LinearGradient>

        {/* ── Content ── */}
        {loading && !signal ? (
          <LoadingSkeleton />
        ) : !signal ? (
          <EmptyState colors={colors} />
        ) : (
          <View style={{ paddingHorizontal: 20 }}>
            {/* ── Top Stories ── */}
            {topStories.length > 0 && (
              <View style={{ marginTop: SPACING.xl }}>
                <SectionHeader
                  icon="newspaper-outline"
                  label="Top Stories"
                  iconColor="#00843D"
                  textColor={colors.textMuted}
                />
                {topStories.map((story, i) => (
                  <StoryCard
                    key={story.story_id ?? i}
                    story={story}
                    index={i}
                    colors={colors}
                    onPress={() => {
                      track('daily90_story_tap', { story_id: story.story_id }, 'Daily90');
                    }}
                  />
                ))}
              </View>
            )}

            {/* ── Your MP This Week ── */}
            {hasMP && (
              <View style={{ marginTop: SPACING.xl }}>
                <SectionHeader
                  icon="person-outline"
                  label="Your MP This Week"
                  iconColor="#2563EB"
                  textColor={colors.textMuted}
                />
                {shiftedPositions.map((shift, i) => (
                  <ShiftedPositionCard
                    key={shift.member_id ?? i}
                    shift={shift}
                    colors={colors}
                  />
                ))}
              </View>
            )}

            {/* ── Bills to Watch ── */}
            {hasBills && (
              <View style={{ marginTop: SPACING.xl }}>
                <SectionHeader
                  icon="document-text-outline"
                  label="Bills to Watch"
                  iconColor="#EA580C"
                  textColor={colors.textMuted}
                />
                {billMovements.map((bill, i) => (
                  <BillMovementCard
                    key={bill.bill_id ?? i}
                    bill={bill}
                    colors={colors}
                  />
                ))}
              </View>
            )}

            {/* ── Blindspot ── */}
            {hasBlindspot && (
              <View style={{ marginTop: SPACING.xl }}>
                <SectionHeader
                  icon="eye-off-outline"
                  label="Blindspot"
                  iconColor="#8B5CF6"
                  textColor={colors.textMuted}
                />
                <BlindspotCard blindspot={blindspot!} colors={colors} />
              </View>
            )}

            {/* ── Electorate impact note ── */}
            {signal.electorate_impact && (
              <View
                style={{
                  marginTop: SPACING.xl,
                  backgroundColor: colors.greenBg,
                  borderRadius: BORDER_RADIUS.lg,
                  padding: SPACING.lg,
                  flexDirection: 'row',
                  gap: SPACING.sm,
                }}
              >
                <Ionicons
                  name="location-outline"
                  size={16}
                  color={colors.green}
                  style={{ marginTop: 2 }}
                />
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontSize: FONT_SIZE.caption,
                      fontWeight: FONT_WEIGHT.bold,
                      color: colors.green,
                      textTransform: 'uppercase',
                      letterSpacing: 0.5,
                      marginBottom: SPACING.xs,
                    }}
                  >
                    Your electorate
                  </Text>
                  <Text
                    style={{
                      fontSize: FONT_SIZE.body,
                      color: colors.text,
                      lineHeight: 21,
                    }}
                  >
                    {signal.electorate_impact}
                  </Text>
                </View>
              </View>
            )}

            {/* ── Share button ── */}
            <Pressable
              onPress={handleShare}
              accessibilityRole="button"
              accessibilityLabel="Share your daily digest"
              style={({ pressed }) => ({
                marginTop: SPACING.xxl,
                marginBottom: SPACING.xxxl,
                backgroundColor: pressed ? '#006B31' : '#00843D',
                borderRadius: BORDER_RADIUS.lg,
                paddingVertical: SPACING.lg,
                flexDirection: 'row',
                justifyContent: 'center',
                alignItems: 'center',
                gap: SPACING.sm,
                ...SHADOWS.md,
              })}
            >
              <Ionicons name="share-outline" size={20} color="#ffffff" />
              <Text
                style={{
                  fontSize: FONT_SIZE.subtitle,
                  fontWeight: FONT_WEIGHT.bold,
                  color: '#ffffff',
                }}
              >
                Share this digest
              </Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
