/**
 * YourMPsTake — Shows what the user's MP said about a story topic.
 *
 * Queries story_mp_context for the given story and member. Shows a quote
 * or speech excerpt if available, otherwise an empty state.
 */
import React, { useState, useEffect } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useTheme } from '../context/ThemeContext';
import { decodeHtml } from '../utils/decodeHtml';
import { timeAgo } from '../lib/timeAgo';
import { SPACING, FONT_SIZE, FONT_WEIGHT, BORDER_RADIUS, SHADOWS } from '../constants/design';

interface Props {
  storyId: number;
  memberId: string;
}

interface MpContext {
  id: string;
  member_id: string;
  context_type: string;
  excerpt: string | null;
  source_url: string | null;
  spoken_at: string | null;
  metadata: Record<string, any> | null;
}

export function YourMPsTake({ storyId, memberId }: Props) {
  const { colors } = useTheme();
  const [context, setContext] = useState<MpContext | null>(null);
  const [memberName, setMemberName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!storyId || !memberId) {
      setContext(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        const [contextRes, memberRes] = await Promise.all([
          supabase
            .from('story_mp_context')
            .select('*')
            .eq('story_id', storyId)
            .eq('member_id', memberId)
            .order('spoken_at', { ascending: false })
            .limit(1)
            .maybeSingle(),
          supabase
            .from('members')
            .select('first_name, last_name, party:parties!members_party_id_fkey(short_name)')
            .eq('id', memberId)
            .maybeSingle(),
        ]);

        if (!cancelled) {
          setContext((contextRes.data as MpContext | null) || null);
          if (memberRes.data) {
            const partyRaw = memberRes.data.party as any;
            const partyObj = Array.isArray(partyRaw) ? partyRaw[0] : partyRaw;
            const partyLabel = partyObj?.short_name ? ` (${partyObj.short_name})` : '';
            setMemberName(`${memberRes.data.first_name} ${memberRes.data.last_name}${partyLabel}`);
          }
          setLoading(false);
        }
      } catch {
        if (!cancelled) {
          setContext(null);
          setLoading(false);
        }
      }
    })();

    return () => { cancelled = true; };
  }, [storyId, memberId]);

  if (loading) {
    return (
      <View style={{ padding: SPACING.xl, alignItems: 'center' }}>
        <ActivityIndicator color={colors.green} />
      </View>
    );
  }

  const displayName = memberName || 'Your MP';

  // Empty state
  if (!context || !context.excerpt) {
    return (
      <View style={{
        backgroundColor: colors.card,
        borderRadius: BORDER_RADIUS.lg,
        padding: SPACING.lg,
        ...SHADOWS.sm,
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.sm }}>
          <Ionicons name="chatbubble-ellipses-outline" size={18} color={colors.green} />
          <Text style={{ fontSize: FONT_SIZE.subtitle, fontWeight: FONT_WEIGHT.bold, color: colors.text }}>
            Your MP's take
          </Text>
        </View>
        <View style={{
          backgroundColor: colors.surface,
          borderRadius: BORDER_RADIUS.md,
          padding: SPACING.lg,
          alignItems: 'center',
        }}>
          <Ionicons name="chatbubble-outline" size={28} color={colors.textMuted} style={{ marginBottom: SPACING.sm }} />
          <Text style={{
            fontSize: FONT_SIZE.body,
            fontWeight: FONT_WEIGHT.semibold,
            color: colors.textMuted,
            textAlign: 'center',
            marginBottom: SPACING.xs,
          }}>
            No comment on record
          </Text>
          <Text style={{
            fontSize: FONT_SIZE.small,
            color: colors.textMuted,
            textAlign: 'center',
            lineHeight: 18,
          }}>
            {displayName} has not made a public statement on this topic in parliament.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={{
      backgroundColor: colors.card,
      borderRadius: BORDER_RADIUS.lg,
      padding: SPACING.lg,
      ...SHADOWS.sm,
    }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.md }}>
        <Ionicons name="chatbubble-ellipses-outline" size={18} color={colors.green} />
        <Text style={{ fontSize: FONT_SIZE.subtitle, fontWeight: FONT_WEIGHT.bold, color: colors.text, flex: 1 }}>
          Your MP's take
        </Text>
        {context.spoken_at && (
          <Text style={{ fontSize: FONT_SIZE.caption, color: colors.textMuted }}>
            {timeAgo(context.spoken_at)}
          </Text>
        )}
      </View>

      {/* MP name */}
      <Text style={{
        fontSize: FONT_SIZE.small,
        fontWeight: FONT_WEIGHT.semibold,
        color: colors.green,
        marginBottom: SPACING.sm,
      }}>
        {displayName}
      </Text>

      {/* Quote */}
      <View style={{
        borderLeftWidth: 3,
        borderLeftColor: colors.green,
        paddingLeft: SPACING.md,
        marginBottom: SPACING.sm,
      }}>
        <Text style={{
          fontSize: FONT_SIZE.body,
          color: colors.textBody,
          lineHeight: 22,
          fontStyle: 'italic',
        }}>
          "{decodeHtml(context.excerpt)}"
        </Text>
      </View>

      {/* Context type badge */}
      {context.context_type && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.sm }}>
          <View style={{
            backgroundColor: colors.greenLight,
            borderRadius: BORDER_RADIUS.sm,
            paddingHorizontal: SPACING.sm,
            paddingVertical: 2,
          }}>
            <Text style={{
              fontSize: FONT_SIZE.caption,
              fontWeight: FONT_WEIGHT.bold,
              color: colors.green,
              letterSpacing: 0.3,
            }}>
              {context.context_type.toUpperCase().replace('_', ' ')}
            </Text>
          </View>
          {context.source_url && (
            <Text style={{ fontSize: FONT_SIZE.caption, color: colors.textMuted }}>
              Source available
            </Text>
          )}
        </View>
      )}
    </View>
  );
}
