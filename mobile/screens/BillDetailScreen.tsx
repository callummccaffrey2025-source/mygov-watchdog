import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, ScrollView, Pressable, Share, Platform, RefreshControl, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Bill } from '../hooks/useBills';
import { useBillDivisions } from '../hooks/useBillDivisions';
import { useUser } from '../context/UserContext';
import { useSubscription } from '../hooks/useSubscription';
import { useElectorateByPostcode } from '../hooks/useElectorateByPostcode';
import { PartyBadge } from '../components/PartyBadge';
import { SkeletonLoader } from '../components/SkeletonLoader';
import { supabase } from '../lib/supabase';
import { decodeHtml } from '../utils/decodeHtml';
import { timeAgo } from '../lib/timeAgo';
import { BillShareCard } from '../components/ShareCards';
import { captureAndShare } from '../utils/shareContent';
import { useFollow } from '../hooks/useFollow';
import { useTheme } from '../context/ThemeContext';
import { AuthPromptSheet } from '../components/AuthPromptSheet';
import { useAuthGate } from '../hooks/useAuthGate';
import { track } from '../lib/analytics';
import { trackEvent } from '../lib/engagementTracker';
import { trackEngagement } from '../hooks/useEngagementScore';
import { useBillHistory } from '../hooks/useBillHistory';
import { enrichBill, type NarrativeStatus } from '../lib/billEnrichment';
import { SPACING, FONT_SIZE, FONT_WEIGHT, BORDER_RADIUS, SHADOWS } from '../constants/design';
import { hapticLight } from '../lib/haptics';

// ── Interfaces ───────────────────────────────────────────────────────────────

interface Argument {
  id: string;
  side: 'for' | 'against';
  argument_text: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function cleanDivisionTitle(name: string): string {
  return name.replace(/^Bills?\s*[—\-]\s*/i, '').trim();
}

const IMPACT_TAGS: Record<string, { keywords: string[]; label: string; icon: keyof typeof Ionicons.glyphMap }> = {
  renters:     { keywords: ['rent', 'tenant', 'lease', 'housing', 'build-to-rent'], label: 'Renters', icon: 'home-outline' },
  homeowners:  { keywords: ['mortgage', 'property', 'stamp duty', 'home owner', 'homeowner'], label: 'Homeowners', icon: 'business-outline' },
  parents:     { keywords: ['child', 'parent', 'family', 'childcare', 'school', 'parental'], label: 'Parents & Families', icon: 'people-outline' },
  students:    { keywords: ['student', 'university', 'tafe', 'education', 'hecs', 'scholarship'], label: 'Students', icon: 'school-outline' },
  retirees:    { keywords: ['pension', 'superannuation', 'super', 'retire', 'aged care', 'elder'], label: 'Retirees', icon: 'heart-outline' },
  workers:     { keywords: ['wage', 'worker', 'employment', 'workplace', 'industrial', 'union', 'fair work'], label: 'Workers', icon: 'hammer-outline' },
  smallbiz:    { keywords: ['small business', 'startup', 'entrepreneur', 'sme', 'gst', 'abn'], label: 'Small Business', icon: 'storefront-outline' },
  environment: { keywords: ['climate', 'emission', 'environment', 'renewable', 'carbon', 'pollution'], label: 'Environment', icon: 'leaf-outline' },
  health:      { keywords: ['health', 'medical', 'hospital', 'medicare', 'pharmaceutical', 'mental health'], label: 'Healthcare', icon: 'medkit-outline' },
  veterans:    { keywords: ['veteran', 'defence', 'military', 'service member', 'dva'], label: 'Veterans', icon: 'shield-outline' },
};

// ── Main Screen ──────────────────────────────────────────────────────────────

export function BillDetailScreen({ route, navigation }: any) {
  const params = route.params ?? {};
  const { bill: billParam, billId } = params as { bill?: Bill; billId?: string };
  const [bill, setBill] = useState<Bill | null>(billParam ?? null);
  const [summaryExpanded, setSummaryExpanded] = useState(false);

  useEffect(() => {
    if (!bill && billId) {
      (async () => {
        try {
          const { data } = await supabase.from('bills').select('*').eq('id', billId).maybeSingle();
          if (data) setBill(data as Bill);
        } catch {}
      })();
    }
  }, [billId]);

  const { postcode, user } = useUser();
  const { isPro } = useSubscription(user?.id);
  const { colors } = useTheme();
  const { requireAuth, authSheetProps } = useAuthGate();

  useEffect(() => {
    if (bill) {
      track('bill_detail_view', { bill_id: bill.id, title: bill.short_title || bill.title }, 'BillDetail');
      if (user) trackEngagement(user.id, 'bill_read', bill.categories?.[0]);
      trackEvent('bill_read', { bill_id: bill.id });
    }
  }, [bill?.id, user?.id]);

  const { divisions: relatedDivisions, loading: divisionsLoading } = useBillDivisions(bill);
  const { changes: billHistory } = useBillHistory(bill?.id ?? null);
  const { member: myMP } = useElectorateByPostcode(postcode);
  const { following: bookmarked, toggle: toggleBookmark } = useFollow('bill', bill?.id ?? '');

  const [args, setArgs] = useState<Argument[]>([]);
  const [argsLoading, setArgsLoading] = useState(true);

  useEffect(() => {
    if (!bill) return;
    let cancelled = false;
    supabase
      .from('bill_arguments')
      .select('id,side,argument_text')
      .eq('bill_id', bill.id)
      .then(({ data }) => {
        if (!cancelled) {
          setArgs((data as Argument[]) || []);
          setArgsLoading(false);
        }
      });
    return () => { cancelled = true; };
  }, [bill?.id]);

  const billCardRef = useRef<any>(null);
  const [showBillCard, setShowBillCard] = useState(false);

  useEffect(() => {
    if (showBillCard && bill) {
      captureAndShare(billCardRef, 'bill', bill.id, user?.id)
        .finally(() => setShowBillCard(false));
    }
  }, [showBillCard]);

  // ── Early return ────────────────────────────────────────────────────────────
  if (!bill) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <SkeletonLoader width="100%" height={200} />
      </SafeAreaView>
    );
  }

  // ── Derived data ────────────────────────────────────────────────────────────
  const enrichment = enrichBill(bill);
  const forArgs = args.filter(a => a.side === 'for');
  const againstArgs = args.filter(a => a.side === 'against');

  const divAyeTotal = relatedDivisions.reduce((s, d) => s + (d.aye_votes || 0), 0);
  const divNoTotal = relatedDivisions.reduce((s, d) => s + (d.no_votes || 0), 0);

  const chamberRaw = bill.chamber_introduced || (bill as any).origin_chamber || '';

  // Impact tags from keywords
  const text = ((bill.title || '') + ' ' + (bill.summary_plain || '') + ' ' + (bill.summary_full || '')).toLowerCase();
  const impactTags = Object.entries(IMPACT_TAGS)
    .filter(([_, tag]) => tag.keywords.some(kw => text.includes(kw)))
    .map(([_, tag]) => tag);

  // ── Progress tracker stages ─────────────────────────────────────────────────
  const STAGES = [
    { key: 'introduced', label: 'Introduced' },
    { key: 'committee', label: 'Committee' },
    { key: 'debate', label: 'Debate' },
    { key: 'voted', label: 'Voted' },
    { key: 'outcome', label: 'Outcome' },
  ];
  const statusLower = (bill.current_status || bill.status || '').toLowerCase();
  const getStageIndex = (): number => {
    if (statusLower.includes('assent') || statusLower.includes('act')) return 5;
    if (statusLower.includes('passed') || statusLower.includes('defeated') || statusLower.includes('withdrawn') || statusLower.includes('lapsed')) return 4;
    if (statusLower.includes('third') || statusLower.includes('vote') || statusLower.includes('division')) return 3;
    if (statusLower.includes('second') || statusLower.includes('debate') || statusLower.includes('reading')) return 2;
    if (statusLower.includes('committee') || statusLower.includes('referred') || statusLower.includes('inquiry')) return 1;
    return 0;
  };
  const currentStage = getStageIndex();
  const isFinal = currentStage >= 4;
  const isPassed = statusLower.includes('passed') || statusLower.includes('assent') || statusLower.includes('act');

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      {/* ── Nav bar ── */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: SPACING.xl, paddingVertical: SPACING.md }}>
        <Pressable
          style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.cardAlt, justifyContent: 'center', alignItems: 'center' }}
          onPress={() => navigation.goBack()} hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Pressable>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Pressable
            style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.cardAlt, justifyContent: 'center', alignItems: 'center' }}
            onPress={() => { hapticLight(); requireAuth('save this bill', toggleBookmark); }} hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={bookmarked ? 'Remove bookmark' : 'Bookmark this bill'}
          >
            <Ionicons name={bookmarked ? 'bookmark' : 'bookmark-outline'} size={22} color={bookmarked ? '#00843D' : colors.text} />
          </Pressable>
          <Pressable
            style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.cardAlt, justifyContent: 'center', alignItems: 'center' }}
            onPress={() => setShowBillCard(true)} hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Share this bill"
          >
            <Ionicons name={Platform.OS === 'ios' ? 'share-outline' : 'share-social-outline'} size={22} color={colors.text} />
          </Pressable>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={false} onRefresh={async () => {
            if (bill?.id) {
              try {
                const { data } = await supabase.from('bills').select('*').eq('id', bill.id).maybeSingle();
                if (data) setBill(data as Bill);
              } catch {}
            }
          }} tintColor="#00843D" />
        }
      >
        {/* ═══ 1. HEADER ═══ */}
        <View style={{ paddingHorizontal: SPACING.xl, marginBottom: SPACING.xl }}>
          {/* Narrative status row */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: SPACING.md }}>
            <View style={{
              flexDirection: 'row', alignItems: 'center', gap: 5,
              backgroundColor: enrichment.statusColor + '14',
              paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
            }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: enrichment.statusColor }} />
              <Text style={{ fontSize: 13, fontWeight: FONT_WEIGHT.bold, color: enrichment.statusColor }}>
                {enrichment.isLive ? 'Live' : enrichment.narrativeStatus === 'became_law' ? 'Passed' : enrichment.narrativeStatus === 'defeated' ? 'Defeated' : 'Archived'}
              </Text>
            </View>
            {enrichment.narrativeLabel ? (
              <Text style={{ fontSize: 13, color: colors.textMuted, flex: 1 }} numberOfLines={1}>
                {enrichment.narrativeLabel}
              </Text>
            ) : null}
          </View>

          {/* Chamber badge */}
          {chamberRaw ? (
            <View style={{ flexDirection: 'row', marginBottom: SPACING.sm }}>
              <View style={{ backgroundColor: colors.cardAlt, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 }}>
                <Text style={{ fontSize: 11, fontWeight: '600', color: colors.textMuted }}>
                  {chamberRaw.toLowerCase().includes('senate') ? 'Senate' : 'House of Representatives'}
                </Text>
              </View>
            </View>
          ) : null}

          {/* Title */}
          <Text style={{ fontSize: 22, fontWeight: '800', color: colors.text, lineHeight: 30, marginBottom: SPACING.md }}>
            {bill.title}
          </Text>

          {/* Meta row */}
          <View style={{ gap: 4 }}>
            {bill.date_introduced && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                <Ionicons name="calendar-outline" size={13} color={colors.textMuted} />
                <Text style={{ fontSize: 12, color: colors.textMuted }}>Introduced {timeAgo(bill.date_introduced)}</Text>
              </View>
            )}
            {bill.sponsor_party && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                <Ionicons name="person-outline" size={13} color={colors.textMuted} />
                <Text style={{ fontSize: 12, color: colors.textMuted }}>Sponsored by {bill.sponsor_party}</Text>
              </View>
            )}
          </View>
        </View>

        {/* ── Progress tracker ── */}
        <View style={{ paddingHorizontal: SPACING.xl, marginBottom: SPACING.xl }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            {STAGES.map((stage, i) => {
              const isActive = i <= currentStage;
              const isCurrent = i === currentStage || (isFinal && i === 4);
              const dotColor = isFinal && i === 4
                ? (isPassed ? '#00843D' : '#DC3545')
                : isActive ? '#00843D' : colors.border;
              return (
                <View key={stage.key} style={{ alignItems: 'center', flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', width: '100%' }}>
                    {i > 0 && (
                      <View style={{ flex: 1, height: 3, backgroundColor: isActive ? '#00843D' : colors.border, borderRadius: 2 }} />
                    )}
                    <View style={{
                      width: isCurrent ? 14 : 10, height: isCurrent ? 14 : 10,
                      borderRadius: 7, backgroundColor: dotColor,
                      borderWidth: isCurrent ? 2 : 0,
                      borderColor: isFinal && i === 4 ? (isPassed ? '#00843D' : '#DC3545') : '#00843D',
                    }} />
                    {i < STAGES.length - 1 && (
                      <View style={{ flex: 1, height: 3, backgroundColor: i < currentStage ? '#00843D' : colors.border, borderRadius: 2 }} />
                    )}
                  </View>
                  <Text style={{
                    fontSize: 10, fontWeight: isCurrent ? '700' : '500',
                    color: isActive ? colors.text : colors.textMuted,
                    marginTop: 4, textAlign: 'center',
                  }}>
                    {i === 4 && isFinal ? (isPassed ? 'Passed' : 'Failed') : stage.label}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* ═══ 2. WHAT IT SAYS ═══ */}
        <View style={{ paddingHorizontal: SPACING.xl, marginBottom: SPACING.xl }}>
          <View style={{
            backgroundColor: colors.card, borderRadius: BORDER_RADIUS.lg,
            overflow: 'hidden', ...SHADOWS.sm,
          }}>
            <View style={{ flexDirection: 'row' }}>
              <View style={{ width: 4, backgroundColor: '#00843D' }} />
              <View style={{ flex: 1, padding: SPACING.lg }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: SPACING.sm }}>
                  <Ionicons name="document-text-outline" size={14} color="#00843D" />
                  <Text style={{ fontSize: 11, fontWeight: '700', color: '#00843D', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    What it says
                  </Text>
                </View>

                {bill.summary_plain ? (
                  <>
                    <Text style={{ fontSize: 16, fontWeight: '600', color: colors.text, lineHeight: 24 }}>
                      {decodeHtml(bill.summary_plain)}
                    </Text>
                    {(bill.expanded_summary || bill.summary_full) && (
                      <>
                        {summaryExpanded && (
                          <Text style={{ fontSize: 14, color: colors.textBody, lineHeight: 22, marginTop: SPACING.sm }}>
                            {decodeHtml(bill.expanded_summary || bill.summary_full || '')}
                          </Text>
                        )}
                        <Pressable onPress={() => setSummaryExpanded(!summaryExpanded)} accessibilityRole="button" accessibilityLabel={summaryExpanded ? 'Show less' : 'Read more'} style={{ marginTop: SPACING.sm }}>
                          <Text style={{ fontSize: 13, fontWeight: '600', color: '#00843D' }}>
                            {summaryExpanded ? 'Show less' : 'Read more'}
                          </Text>
                        </Pressable>
                      </>
                    )}
                  </>
                ) : bill.summary_full ? (
                  <Text style={{ fontSize: 15, color: colors.text, lineHeight: 24 }}>
                    {decodeHtml(bill.summary_full)}
                  </Text>
                ) : (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Ionicons name="hourglass-outline" size={16} color={colors.textMuted} />
                    <Text style={{ fontSize: 14, color: colors.textMuted, flex: 1 }}>
                      Summary is being generated. Check back shortly.
                    </Text>
                  </View>
                )}

                {bill.aph_url && (
                  <Pressable
                    onPress={() => Linking.openURL(bill.aph_url!)}
                    accessibilityRole="button"
                    accessibilityLabel="View full bill text on APH website"
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: SPACING.md }}
                  >
                    <Ionicons name="open-outline" size={13} color="#00843D" />
                    <Text style={{ fontSize: 12, fontWeight: '600', color: '#00843D' }}>View full bill text</Text>
                  </Pressable>
                )}
              </View>
            </View>
          </View>
        </View>

        {/* ═══ 3. HOW THIS AFFECTS YOU ═══ */}
        {impactTags.length > 0 && (
          <View style={{ paddingHorizontal: SPACING.xl, marginBottom: SPACING.xl }}>
            <Text style={{ fontSize: 11, fontWeight: '700', letterSpacing: 1, color: colors.textMuted, textTransform: 'uppercase', marginBottom: SPACING.md }}>
              Who this affects
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {impactTags.map(tag => (
                <View key={tag.label} style={{
                  flexDirection: 'row', alignItems: 'center', gap: 5,
                  backgroundColor: '#F0FDF4', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20,
                }}>
                  <Ionicons name={tag.icon as any} size={14} color="#00843D" />
                  <Text style={{ fontSize: 13, fontWeight: '600', color: '#166534' }}>{tag.label}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* ═══ 4. WHAT YOU CAN DO — prominent, never paywalled ═══ */}
        {myMP && (
          <View style={{ paddingHorizontal: SPACING.xl, marginBottom: SPACING.xl }}>
            <Text style={{ fontSize: 11, fontWeight: '700', letterSpacing: 1, color: colors.textMuted, textTransform: 'uppercase', marginBottom: SPACING.md }}>
              What you can do
            </Text>

            {/* Contact MP — primary action */}
            <Pressable
              onPress={() => navigation.navigate('WriteToMP', {
                member: myMP,
                fromBill: { title: bill.title, vote: null, date: null },
              })}
              accessibilityRole="button"
              accessibilityLabel={`Contact ${myMP.first_name} ${myMP.last_name} about this bill`}
              style={{
                flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
                backgroundColor: '#00843D', borderRadius: BORDER_RADIUS.md,
                paddingHorizontal: SPACING.lg, paddingVertical: 14,
                marginBottom: SPACING.sm,
              }}
            >
              <Ionicons name="mail-outline" size={20} color="#ffffff" />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, fontWeight: '700', color: '#ffffff' }}>
                  Contact {myMP.first_name} {myMP.last_name}
                </Text>
                <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 2 }}>
                  Tell your MP what you think about this bill
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.7)" />
            </Pressable>

            {/* Share */}
            <Pressable
              onPress={() => {
                const shareText = `${bill.short_title || bill.title}\n\n${bill.summary_plain || ''}\n\nRead more on Verity`;
                Share.share({ message: shareText });
              }}
              accessibilityRole="button"
              accessibilityLabel="Share this bill"
              style={{
                flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
                backgroundColor: colors.surface, borderRadius: BORDER_RADIUS.md,
                paddingVertical: 12,
              }}
            >
              <Ionicons name="share-social-outline" size={16} color={colors.text} />
              <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>Share this bill</Text>
            </Pressable>
          </View>
        )}

        {/* ═══ 5. THE POLITICS — Key Arguments ═══ */}
        <View style={{ paddingHorizontal: SPACING.xl, marginBottom: SPACING.xl }}>
          <Text style={{ fontSize: 11, fontWeight: '700', letterSpacing: 1, color: colors.textMuted, textTransform: 'uppercase', marginBottom: SPACING.md }}>
            The politics
          </Text>

          {argsLoading ? (
            <>
              <SkeletonLoader height={72} borderRadius={10} style={{ marginBottom: 8 }} />
              <SkeletonLoader height={72} borderRadius={10} />
            </>
          ) : forArgs.length === 0 && againstArgs.length === 0 ? (
            <View style={{
              backgroundColor: colors.surface, borderRadius: BORDER_RADIUS.lg,
              padding: SPACING.lg, alignItems: 'center', gap: SPACING.sm,
            }}>
              <Ionicons name="chatbubbles-outline" size={28} color={colors.textMuted} />
              <Text style={{ fontSize: 14, color: colors.textBody, textAlign: 'center', lineHeight: 20 }}>
                Political positions on this bill are being compiled from Hansard records and party statements.
              </Text>
            </View>
          ) : (
            <>
              {forArgs.map((a, i) => (
                <View key={a.id ?? `for-${i}`} style={{
                  flexDirection: 'row', gap: 12,
                  backgroundColor: '#E8F5EE', borderRadius: 10, padding: 14, marginBottom: 8,
                }}>
                  <Ionicons name="checkmark-circle" size={18} color="#00843D" style={{ marginTop: 2 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 10, fontWeight: '800', color: '#00843D', letterSpacing: 0.5, marginBottom: 4 }}>FOR</Text>
                    <Text style={{ fontSize: 14, color: colors.text, lineHeight: 21 }}>{a.argument_text}</Text>
                  </View>
                </View>
              ))}
              {againstArgs.map((a, i) => (
                <View key={a.id ?? `against-${i}`} style={{
                  flexDirection: 'row', gap: 12,
                  backgroundColor: '#FDECEA', borderRadius: 10, padding: 14, marginBottom: 8,
                }}>
                  <Ionicons name="close-circle" size={18} color="#DC3545" style={{ marginTop: 2 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 10, fontWeight: '800', color: '#DC3545', letterSpacing: 0.5, marginBottom: 4 }}>AGAINST</Text>
                    <Text style={{ fontSize: 14, color: colors.text, lineHeight: 21 }}>{a.argument_text}</Text>
                  </View>
                </View>
              ))}
              {/* AI disclaimer */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
                <Ionicons name="information-circle-outline" size={12} color={colors.textMuted} />
                <Text style={{ fontSize: 11, color: colors.textMuted }}>AI-generated summary. Verify with official parliamentary records.</Text>
              </View>
            </>
          )}
        </View>

        {/* ═══ 6. HOW PARLIAMENT VOTED ═══ */}
        <View style={{ paddingHorizontal: SPACING.xl, marginBottom: SPACING.xl }}>
          <Text style={{ fontSize: 11, fontWeight: '700', letterSpacing: 1, color: colors.textMuted, textTransform: 'uppercase', marginBottom: SPACING.md }}>
            How Parliament voted
          </Text>

          {divisionsLoading ? (
            <SkeletonLoader height={80} borderRadius={10} />
          ) : relatedDivisions.length > 0 ? (
            <>
              {/* Aggregate bar */}
              <View style={{ backgroundColor: colors.card, borderRadius: BORDER_RADIUS.lg, padding: SPACING.lg, ...SHADOWS.sm, marginBottom: SPACING.sm }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: SPACING.md }}>
                  <View style={{ alignItems: 'flex-start', minWidth: 36 }}>
                    <Text style={{ fontSize: 18, fontWeight: '800', color: '#00843D' }}>{divAyeTotal}</Text>
                    <Text style={{ fontSize: 10, color: colors.textMuted }}>Ayes</Text>
                  </View>
                  <View style={{ flex: 1, height: 12, borderRadius: 6, overflow: 'hidden', backgroundColor: colors.cardAlt, flexDirection: 'row' }}>
                    {divAyeTotal + divNoTotal > 0 && (
                      <View style={{ flex: divAyeTotal, backgroundColor: '#00843D' }} />
                    )}
                    {divNoTotal > 0 && (
                      <View style={{ flex: divNoTotal, backgroundColor: '#DC3545' }} />
                    )}
                  </View>
                  <View style={{ alignItems: 'flex-end', minWidth: 36 }}>
                    <Text style={{ fontSize: 18, fontWeight: '800', color: '#DC3545' }}>{divNoTotal}</Text>
                    <Text style={{ fontSize: 10, color: colors.textMuted }}>Noes</Text>
                  </View>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <View style={{
                    backgroundColor: divAyeTotal > divNoTotal ? '#E8F5EE' : '#FDECEA',
                    borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2,
                  }}>
                    <Text style={{ fontSize: 10, fontWeight: '700', color: divAyeTotal > divNoTotal ? '#00843D' : '#DC3545' }}>
                      {divAyeTotal > divNoTotal ? 'PASSED' : 'NOT PASSED'}
                    </Text>
                  </View>
                  <Text style={{ fontSize: 12, color: colors.textMuted }}>
                    {relatedDivisions.length} division{relatedDivisions.length !== 1 ? 's' : ''}
                  </Text>
                </View>
              </View>

              {/* Your MP's vote */}
              {myMP && (() => {
                // Check divisions for MP vote data
                return (
                  <View style={{
                    backgroundColor: colors.surface, borderRadius: BORDER_RADIUS.md,
                    padding: SPACING.md, marginBottom: SPACING.sm,
                    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
                  }}>
                    <Ionicons name="person-outline" size={16} color="#00843D" />
                    <Text style={{ fontSize: 13, color: colors.textBody, flex: 1 }}>
                      See how {myMP.first_name} {myMP.last_name} voted on the MP profile.
                    </Text>
                    <Pressable
                      onPress={() => navigation.navigate('MemberProfile', { member: myMP })}
                      hitSlop={8}
                      accessibilityRole="button"
                      accessibilityLabel={`View ${myMP.first_name} ${myMP.last_name}'s profile`}
                    >
                      <Text style={{ fontSize: 13, fontWeight: '600', color: '#00843D' }}>View</Text>
                    </Pressable>
                  </View>
                );
              })()}

              {/* Division list */}
              {relatedDivisions.map(d => {
                const passed = d.aye_votes > d.no_votes;
                return (
                  <View key={d.id} style={{
                    backgroundColor: colors.card, borderRadius: 10,
                    padding: 12, marginBottom: 8, ...SHADOWS.sm, gap: 4,
                  }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Text style={{ fontSize: 11, color: colors.textMuted }}>{timeAgo(d.date)}</Text>
                      <View style={{
                        backgroundColor: passed ? '#E8F5EE' : '#FDECEA',
                        borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2,
                      }}>
                        <Text style={{ fontSize: 10, fontWeight: '700', color: passed ? '#00843D' : '#DC3545' }}>
                          {passed ? 'PASSED' : 'NOT PASSED'}
                        </Text>
                      </View>
                    </View>
                    <Text style={{ fontSize: 13, color: colors.text, lineHeight: 18 }} numberOfLines={2}>
                      {cleanDivisionTitle(d.name)}
                    </Text>
                    <Text style={{ fontSize: 11, color: colors.textMuted }}>
                      Aye {d.aye_votes} · No {d.no_votes}
                    </Text>
                  </View>
                );
              })}
            </>
          ) : (
            <View style={{
              backgroundColor: colors.surface, borderRadius: BORDER_RADIUS.lg,
              padding: SPACING.lg, flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
            }}>
              <Ionicons name="time-outline" size={20} color={colors.textMuted} />
              <Text style={{ flex: 1, fontSize: 14, color: colors.textBody, lineHeight: 20 }}>
                This bill hasn't been voted on yet. Follow it to be notified when a vote happens.
              </Text>
            </View>
          )}
        </View>

        {/* ═══ 7. HISTORY TIMELINE ═══ */}
        {billHistory.length > 0 && (
          <View style={{ paddingHorizontal: SPACING.xl, marginBottom: SPACING.xl }}>
            <Text style={{ fontSize: 11, fontWeight: '700', letterSpacing: 1, color: colors.textMuted, textTransform: 'uppercase', marginBottom: SPACING.md }}>
              History
            </Text>
            {billHistory.map((change, i) => {
              const isLatest = i === 0;
              return (
                <View key={change.id} style={{ flexDirection: 'row', marginBottom: 14 }}>
                  <View style={{ width: 24, alignItems: 'center' }}>
                    <View style={{
                      width: 12, height: 12, borderRadius: 6,
                      backgroundColor: isLatest ? '#00843D' : colors.cardAlt,
                      borderWidth: 2, borderColor: isLatest ? '#00843D' : colors.border,
                      marginTop: 4,
                    }} />
                    {i < billHistory.length - 1 && (
                      <View style={{ width: 2, flex: 1, backgroundColor: colors.border, marginTop: 4, minHeight: 30 }} />
                    )}
                  </View>
                  <View style={{ flex: 1, paddingBottom: 4 }}>
                    <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text, lineHeight: 20 }}>
                      {change.new_status}
                    </Text>
                    {change.change_description && change.change_description !== change.new_status && (
                      <Text style={{ fontSize: 13, color: colors.textBody, lineHeight: 18, marginTop: 2 }} numberOfLines={2}>
                        {change.change_description}
                      </Text>
                    )}
                    <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 4 }}>
                      {timeAgo(change.changed_at)}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* ═══ 8. FOLLOW THIS BILL ═══ */}
        <View style={{ paddingHorizontal: SPACING.xl, marginBottom: SPACING.xl }}>
          <Pressable
            onPress={() => { hapticLight(); requireAuth('follow this bill', toggleBookmark); }}
            accessibilityRole="button"
            accessibilityLabel={bookmarked ? 'Unfollow this bill' : 'Follow this bill for updates'}
            style={{
              flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
              backgroundColor: bookmarked ? '#E8F5EE' : colors.surface,
              borderRadius: BORDER_RADIUS.md, paddingVertical: 14,
            }}
          >
            <Ionicons
              name={bookmarked ? 'notifications' : 'notifications-outline'}
              size={18}
              color={bookmarked ? '#00843D' : colors.text}
            />
            <Text style={{ fontSize: 14, fontWeight: '600', color: bookmarked ? '#00843D' : colors.text }}>
              {bookmarked ? 'Following — you\'ll be notified of updates' : 'Follow this bill for updates'}
            </Text>
          </Pressable>
        </View>

        {/* ── Source footer ── */}
        <View style={{ paddingHorizontal: SPACING.xl, marginBottom: SPACING.lg }}>
          <View style={{ backgroundColor: colors.surface, borderRadius: BORDER_RADIUS.lg, padding: SPACING.lg }}>
            <Text style={{ fontSize: 12, color: colors.textMuted, lineHeight: 18 }}>
              Data sourced from the Parliament of Australia, TheyVoteForYou, and the Australian Electoral Commission.
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Hidden share card */}
      <View style={{ position: 'absolute', left: -9999, top: 0 }} pointerEvents="none">
        <View ref={billCardRef}>
          {showBillCard && (
            <BillShareCard
              title={bill.title}
              status={bill.current_status || bill.status}
              summaryPlain={bill.summary_plain}
              ayeVotes={divAyeTotal}
              noVotes={divNoTotal}
            />
          )}
        </View>
      </View>
      <AuthPromptSheet {...authSheetProps} />
    </SafeAreaView>
  );
}
