/**
 * VerityVerdictCard — AI-generated sourced analysis for a news story.
 *
 * Reads from story_verdicts table and displays the verdict with confidence
 * indicator, methodology note, and source links. Clearly labelled as AI-generated.
 */
import React, { useState, useEffect } from 'react';
import { View, Text, Pressable, ActivityIndicator, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useTheme } from '../context/ThemeContext';
import { decodeHtml } from '../utils/decodeHtml';
import { timeAgo } from '../lib/timeAgo';
import { SPACING, FONT_SIZE, FONT_WEIGHT, BORDER_RADIUS, SHADOWS } from '../constants/design';

interface Props {
  storyId: number;
}

interface StoryVerdict {
  id: string;
  story_id: number;
  verdict_text: string;
  confidence: number | null;
  sources_cited: string[] | null;
  methodology: string | null;
  created_at: string;
}

function confidenceConfig(confidence: number | null): { label: string; color: string; width: number } {
  if (confidence === null) return { label: 'Unrated', color: '#6B7280', width: 0 };
  if (confidence >= 0.8) return { label: 'High confidence', color: '#22C55E', width: confidence * 100 };
  if (confidence >= 0.5) return { label: 'Moderate confidence', color: '#D97706', width: confidence * 100 };
  return { label: 'Low confidence', color: '#DC3545', width: confidence * 100 };
}

export function VerityVerdictCard({ storyId }: Props) {
  const { colors } = useTheme();
  const [verdict, setVerdict] = useState<StoryVerdict | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!storyId) {
      setVerdict(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        const { data } = await supabase
          .from('story_verdicts')
          .select('*')
          .eq('story_id', storyId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!cancelled) {
          setVerdict((data as StoryVerdict | null) || null);
          setLoading(false);
        }
      } catch {
        if (!cancelled) {
          setVerdict(null);
          setLoading(false);
        }
      }
    })();

    return () => { cancelled = true; };
  }, [storyId]);

  if (loading) {
    return (
      <View style={{ padding: SPACING.xl, alignItems: 'center' }}>
        <ActivityIndicator color={colors.green} />
      </View>
    );
  }

  // Empty state
  if (!verdict) {
    return (
      <View style={{
        backgroundColor: colors.card,
        borderRadius: BORDER_RADIUS.lg,
        padding: SPACING.lg,
        ...SHADOWS.sm,
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.sm }}>
          <Ionicons name="sparkles-outline" size={18} color={colors.green} />
          <Text style={{ fontSize: FONT_SIZE.subtitle, fontWeight: FONT_WEIGHT.bold, color: colors.text }}>
            Verity analysis
          </Text>
        </View>
        <View style={{
          backgroundColor: colors.surface,
          borderRadius: BORDER_RADIUS.md,
          padding: SPACING.lg,
          alignItems: 'center',
        }}>
          <Ionicons name="analytics-outline" size={28} color={colors.textMuted} style={{ marginBottom: SPACING.sm }} />
          <Text style={{
            fontSize: FONT_SIZE.body,
            fontWeight: FONT_WEIGHT.semibold,
            color: colors.textMuted,
            textAlign: 'center',
            marginBottom: SPACING.xs,
          }}>
            No analysis available
          </Text>
          <Text style={{
            fontSize: FONT_SIZE.small,
            color: colors.textMuted,
            textAlign: 'center',
            lineHeight: 18,
          }}>
            Verity has not yet generated an analysis for this story.
          </Text>
        </View>
      </View>
    );
  }

  const conf = confidenceConfig(verdict.confidence);
  const sources = verdict.sources_cited || [];

  return (
    <View style={{
      backgroundColor: colors.card,
      borderRadius: BORDER_RADIUS.lg,
      padding: SPACING.lg,
      ...SHADOWS.sm,
    }}>
      {/* Header with AI label */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.md }}>
        <Ionicons name="sparkles-outline" size={18} color={colors.green} />
        <Text style={{ fontSize: FONT_SIZE.subtitle, fontWeight: FONT_WEIGHT.bold, color: colors.text, flex: 1 }}>
          Verity analysis
        </Text>
        <View style={{
          backgroundColor: colors.greenBg,
          borderRadius: BORDER_RADIUS.sm,
          paddingHorizontal: SPACING.sm,
          paddingVertical: 2,
          flexDirection: 'row',
          alignItems: 'center',
          gap: SPACING.xs,
        }}>
          <Ionicons name="sparkles" size={10} color={colors.green} />
          <Text style={{
            fontSize: FONT_SIZE.caption - 1,
            fontWeight: FONT_WEIGHT.bold,
            color: colors.green,
            letterSpacing: 0.3,
          }}>
            AI-GENERATED
          </Text>
        </View>
      </View>

      {/* Confidence bar */}
      {verdict.confidence !== null && (
        <View style={{ marginBottom: SPACING.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACING.xs }}>
            <Text style={{ fontSize: FONT_SIZE.caption, color: colors.textMuted }}>
              {conf.label}
            </Text>
            <Text style={{ fontSize: FONT_SIZE.caption, fontWeight: FONT_WEIGHT.semibold, color: conf.color }}>
              {(verdict.confidence * 100).toFixed(0)}%
            </Text>
          </View>
          <View style={{
            height: 4,
            backgroundColor: colors.surface,
            borderRadius: 2,
            overflow: 'hidden',
          }}>
            <View style={{
              height: 4,
              width: `${conf.width}%`,
              backgroundColor: conf.color,
              borderRadius: 2,
            }} />
          </View>
        </View>
      )}

      {/* Verdict text */}
      <Text style={{
        fontSize: FONT_SIZE.body,
        color: colors.textBody,
        lineHeight: 22,
        marginBottom: SPACING.md,
      }}>
        {decodeHtml(verdict.verdict_text)}
      </Text>

      {/* Methodology */}
      {verdict.methodology && (
        <View style={{
          backgroundColor: colors.surface,
          borderRadius: BORDER_RADIUS.md,
          padding: SPACING.md,
          marginBottom: SPACING.md,
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, marginBottom: SPACING.xs }}>
            <Ionicons name="flask-outline" size={12} color={colors.textMuted} />
            <Text style={{ fontSize: FONT_SIZE.caption, fontWeight: FONT_WEIGHT.semibold, color: colors.textMuted }}>
              Methodology
            </Text>
          </View>
          <Text style={{
            fontSize: FONT_SIZE.small,
            color: colors.textBody,
            lineHeight: 18,
          }}>
            {decodeHtml(verdict.methodology)}
          </Text>
        </View>
      )}

      {/* Sources cited */}
      {sources.length > 0 && (
        <View style={{ marginBottom: SPACING.sm }}>
          <Text style={{
            fontSize: FONT_SIZE.caption,
            fontWeight: FONT_WEIGHT.semibold,
            color: colors.textMuted,
            marginBottom: SPACING.xs,
          }}>
            Sources cited ({sources.length})
          </Text>
          {sources.map((url, idx) => (
            <Pressable
              key={`${url}-${idx}`}
              onPress={() => Linking.openURL(url)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: SPACING.xs,
                paddingVertical: SPACING.xs,
              }}
            >
              <Ionicons name="link-outline" size={12} color={colors.green} />
              <Text
                style={{ fontSize: FONT_SIZE.small, color: colors.green, flex: 1 }}
                numberOfLines={1}
              >
                {url}
              </Text>
              <Ionicons name="open-outline" size={12} color={colors.textMuted} />
            </Pressable>
          ))}
        </View>
      )}

      {/* Timestamp */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, paddingTop: SPACING.sm, borderTopWidth: 1, borderTopColor: colors.border }}>
        <Ionicons name="time-outline" size={10} color={colors.textMuted} />
        <Text style={{ fontSize: FONT_SIZE.caption, color: colors.textMuted }}>
          Generated {timeAgo(verdict.created_at)}
        </Text>
        <Text style={{ fontSize: FONT_SIZE.caption, color: colors.textMuted, marginLeft: 'auto' }}>
          This analysis is AI-generated and may contain errors.
        </Text>
      </View>
    </View>
  );
}
