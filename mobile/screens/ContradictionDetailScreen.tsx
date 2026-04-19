/**
 * ContradictionDetailScreen — Full evidence view for a single contradiction.
 * Shows side-by-side comparison of an MP's public statement vs parliamentary record,
 * timeline, AI explanation, and share functionality.
 */
import React, { useState, useEffect, useRef } from 'react';
import { View, Text, ScrollView, Pressable, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useUser } from '../context/UserContext';
import { supabase } from '../lib/supabase';
import { decodeHtml } from '../utils/decodeHtml';
import { timeAgo } from '../lib/timeAgo';
import { captureAndShare } from '../utils/shareContent';
import { ContradictionShareCard } from '../components/ContradictionShareCard';
import { SPACING, FONT_SIZE, FONT_WEIGHT, BORDER_RADIUS, SHADOWS } from '../constants/design';
import type { Contradiction } from '../hooks/useContradictions';

function formatDate(dateStr: string | null): string {
  if (!dateStr) return 'Unknown date';
  return new Date(dateStr).toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function ContradictionDetailScreen({ route, navigation }: any) {
  const { contradictionId } = route.params as { contradictionId: string };
  const { colors } = useTheme();
  const { user } = useUser();
  const [contradiction, setContradiction] = useState<Contradiction | null>(null);
  const [loading, setLoading] = useState(true);
  const shareCardRef = useRef<any>(null);
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase
          .from('mp_contradictions')
          .select('*, member:members(id, first_name, last_name, photo_url, party:parties(name, short_name, colour))')
          .eq('id', contradictionId)
          .maybeSingle();
        if (data) setContradiction(data as Contradiction);
      } catch {
        // Network failure
      } finally {
        setLoading(false);
      }
    })();
  }, [contradictionId]);

  useEffect(() => {
    if (sharing && contradiction) {
      captureAndShare(shareCardRef, 'mp_vote', contradiction.id, user?.id)
        .finally(() => setSharing(false));
    }
  }, [sharing]);

  if (loading || !contradiction) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: colors.textMuted, fontSize: FONT_SIZE.body }}>Loading...</Text>
      </SafeAreaView>
    );
  }

  const c = contradiction;
  const member = c.member;
  const memberName = member ? `${member.first_name} ${member.last_name}` : 'MP';
  const partyName = member?.party?.short_name || member?.party?.name || '';
  const partyColour = member?.party?.colour || '#9aabb8';
  const accentColor = c.confidence >= 0.9 ? '#DC3545' : '#F0AD4E';

  // Timeline events sorted chronologically
  const events: { date: string | null; label: string; type: 'claim' | 'record' }[] = [];
  if (c.contra_date) events.push({ date: c.contra_date, label: 'Parliamentary record', type: 'record' });
  if (c.claim_date) events.push({ date: c.claim_date, label: 'Public statement', type: 'claim' });
  events.sort((a, b) => {
    if (!a.date) return -1;
    if (!b.date) return 1;
    return new Date(a.date).getTime() - new Date(b.date).getTime();
  });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: SPACING.lg,
          paddingVertical: SPACING.md,
        }}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={8}>
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </Pressable>
          <Text style={{
            fontSize: FONT_SIZE.subtitle,
            fontWeight: FONT_WEIGHT.semibold,
            color: colors.text,
          }}>
            Contradiction evidence
          </Text>
          <Pressable onPress={() => setSharing(true)} hitSlop={8}>
            <Ionicons
              name={Platform.OS === 'ios' ? 'share-outline' : 'share-social-outline'}
              size={20}
              color={colors.textBody}
            />
          </Pressable>
        </View>

        {/* MP identity */}
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: SPACING.sm,
          paddingHorizontal: SPACING.lg,
          marginBottom: SPACING.lg,
        }}>
          <Ionicons name="alert-circle" size={20} color={accentColor} />
          <Text style={{ fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.semibold, color: colors.text }}>
            {memberName}
          </Text>
          {partyName ? (
            <View style={{
              backgroundColor: partyColour + '18',
              borderRadius: BORDER_RADIUS.sm,
              paddingHorizontal: SPACING.sm,
              paddingVertical: 2,
            }}>
              <Text style={{ fontSize: FONT_SIZE.caption, fontWeight: FONT_WEIGHT.semibold, color: partyColour }}>
                {partyName}
              </Text>
            </View>
          ) : null}
          <View style={{
            backgroundColor: accentColor + '18',
            borderRadius: BORDER_RADIUS.sm,
            paddingHorizontal: SPACING.sm,
            paddingVertical: 2,
            marginLeft: 'auto',
          }}>
            <Text style={{ fontSize: FONT_SIZE.caption, fontWeight: FONT_WEIGHT.bold, color: accentColor }}>
              {Math.round(c.confidence * 100)}% confidence
            </Text>
          </View>
        </View>

        {/* Side-by-side evidence cards */}
        <View style={{ paddingHorizontal: SPACING.lg, marginBottom: SPACING.xl }}>
          {/* What they said */}
          <View style={{
            backgroundColor: colors.card,
            borderRadius: BORDER_RADIUS.lg,
            padding: SPACING.lg,
            marginBottom: SPACING.md,
            ...SHADOWS.md,
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.sm }}>
              <View style={{
                width: 24,
                height: 24,
                borderRadius: 12,
                backgroundColor: '#DC354518',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <Ionicons name="chatbubble-outline" size={13} color="#DC3545" />
              </View>
              <Text style={{
                fontSize: FONT_SIZE.small,
                fontWeight: FONT_WEIGHT.bold,
                color: '#DC3545',
                letterSpacing: 0.5,
              }}>
                WHAT THEY SAID
              </Text>
            </View>
            <Text style={{
              fontSize: FONT_SIZE.body,
              color: colors.text,
              lineHeight: 22,
              marginBottom: SPACING.sm,
            }}>
              "{decodeHtml(c.claim_text)}"
            </Text>
            {c.claim_source ? (
              <Text style={{ fontSize: FONT_SIZE.caption, color: colors.textMuted }}>
                Source: {decodeHtml(c.claim_source)}
              </Text>
            ) : null}
            {c.claim_date ? (
              <Text style={{ fontSize: FONT_SIZE.caption, color: colors.textMuted, marginTop: SPACING.xs }}>
                {formatDate(c.claim_date)}
              </Text>
            ) : null}
          </View>

          {/* What the record shows */}
          <View style={{
            backgroundColor: colors.card,
            borderRadius: BORDER_RADIUS.lg,
            padding: SPACING.lg,
            ...SHADOWS.md,
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.sm }}>
              <View style={{
                width: 24,
                height: 24,
                borderRadius: 12,
                backgroundColor: colors.greenBg,
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <Ionicons name="document-text-outline" size={13} color={colors.green} />
              </View>
              <Text style={{
                fontSize: FONT_SIZE.small,
                fontWeight: FONT_WEIGHT.bold,
                color: colors.green,
                letterSpacing: 0.5,
              }}>
                WHAT THE RECORD SHOWS
              </Text>
            </View>
            <Text style={{
              fontSize: FONT_SIZE.body,
              color: colors.text,
              lineHeight: 22,
              marginBottom: SPACING.sm,
            }}>
              "{decodeHtml(c.contra_text)}"
            </Text>
            {c.contra_type ? (
              <View style={{
                backgroundColor: colors.greenBg,
                borderRadius: BORDER_RADIUS.sm,
                paddingHorizontal: SPACING.sm,
                paddingVertical: 2,
                alignSelf: 'flex-start',
                marginBottom: SPACING.xs,
              }}>
                <Text style={{ fontSize: FONT_SIZE.caption, fontWeight: FONT_WEIGHT.semibold, color: colors.green }}>
                  {c.contra_type.toUpperCase()}
                </Text>
              </View>
            ) : null}
            {c.contra_date ? (
              <Text style={{ fontSize: FONT_SIZE.caption, color: colors.textMuted }}>
                {formatDate(c.contra_date)}
              </Text>
            ) : null}
          </View>
        </View>

        {/* Timeline */}
        {events.length > 0 ? (
          <View style={{ paddingHorizontal: SPACING.lg, marginBottom: SPACING.xl }}>
            <Text style={{
              fontSize: FONT_SIZE.small,
              fontWeight: FONT_WEIGHT.bold,
              color: colors.textMuted,
              letterSpacing: 0.5,
              marginBottom: SPACING.md,
            }}>
              TIMELINE
            </Text>
            {events.map((event, idx) => (
              <View key={idx} style={{ flexDirection: 'row', gap: SPACING.md, marginBottom: SPACING.md }}>
                {/* Timeline dot + line */}
                <View style={{ alignItems: 'center', width: 20 }}>
                  <View style={{
                    width: 10,
                    height: 10,
                    borderRadius: 5,
                    backgroundColor: event.type === 'claim' ? '#DC3545' : colors.green,
                    marginTop: 4,
                  }} />
                  {idx < events.length - 1 ? (
                    <View style={{
                      width: 2,
                      flex: 1,
                      backgroundColor: colors.border,
                      marginTop: 4,
                    }} />
                  ) : null}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: FONT_SIZE.small, fontWeight: FONT_WEIGHT.semibold, color: colors.text }}>
                    {event.label}
                  </Text>
                  <Text style={{ fontSize: FONT_SIZE.caption, color: colors.textMuted }}>
                    {event.date ? formatDate(event.date) : 'Date unknown'}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        ) : null}

        {/* AI explanation */}
        {c.ai_explanation ? (
          <View style={{
            marginHorizontal: SPACING.lg,
            marginBottom: SPACING.xl,
            backgroundColor: colors.surface,
            borderRadius: BORDER_RADIUS.lg,
            padding: SPACING.lg,
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.sm }}>
              <Ionicons name="sparkles" size={14} color={colors.green} />
              <Text style={{
                fontSize: FONT_SIZE.small,
                fontWeight: FONT_WEIGHT.bold,
                color: colors.green,
                letterSpacing: 0.5,
              }}>
                AI ANALYSIS
              </Text>
            </View>
            <Text style={{
              fontSize: FONT_SIZE.small,
              color: colors.textBody,
              lineHeight: 20,
            }}>
              {decodeHtml(c.ai_explanation)}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, marginTop: SPACING.md }}>
              <Ionicons name="sparkles" size={10} color={colors.textMuted} />
              <Text style={{ fontSize: FONT_SIZE.caption, color: colors.textMuted, fontWeight: FONT_WEIGHT.medium }}>
                Powered by Verity AI
              </Text>
            </View>
          </View>
        ) : null}

        {/* Bottom padding */}
        <View style={{ height: SPACING.xxxl }} />
      </ScrollView>

      {/* Offscreen share card */}
      <View style={{ position: 'absolute', left: -9999 }} ref={shareCardRef} collapsable={false}>
        <ContradictionShareCard
          mpName={memberName}
          partyName={partyName}
          claimText={c.claim_text}
          contraText={c.contra_text}
          claimDate={c.claim_date}
          contraDate={c.contra_date}
        />
      </View>
    </SafeAreaView>
  );
}
