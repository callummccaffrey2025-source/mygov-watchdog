/**
 * CommunityFactCheck — Community fact-check verdicts for a news story.
 *
 * Reads from story_factchecks table and shows existing verdicts with upvote
 * counts. Submissions are auth-gated via useAuthGate.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, Pressable, ActivityIndicator, TextInput, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { supabase } from '../lib/supabase';
import { useTheme } from '../context/ThemeContext';
import { useUser } from '../context/UserContext';
import { useAuthGate } from '../hooks/useAuthGate';
import { AuthPromptSheet } from './AuthPromptSheet';
import { timeAgo } from '../lib/timeAgo';
import { SPACING, FONT_SIZE, FONT_WEIGHT, BORDER_RADIUS, SHADOWS } from '../constants/design';

interface Props {
  storyId: number;
}

interface FactCheck {
  id: string;
  story_id: number;
  verdict: string;
  evidence_url: string | null;
  submitted_by: string | null;
  vote_count: number;
  created_at: string;
}

const VERDICT_CONFIG: Record<string, { color: string; icon: keyof typeof Ionicons.glyphMap }> = {
  true: { color: '#22C55E', icon: 'checkmark-circle' },
  mostly_true: { color: '#10B981', icon: 'checkmark-circle-outline' },
  mixed: { color: '#D97706', icon: 'alert-circle-outline' },
  mostly_false: { color: '#F97316', icon: 'close-circle-outline' },
  false: { color: '#DC3545', icon: 'close-circle' },
  unverified: { color: '#6B7280', icon: 'help-circle-outline' },
};

function getVerdictConfig(verdict: string) {
  const key = verdict.toLowerCase().replace(/\s+/g, '_');
  return VERDICT_CONFIG[key] || VERDICT_CONFIG.unverified;
}

function formatVerdict(verdict: string): string {
  return verdict.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function CommunityFactCheck({ storyId }: Props) {
  const { colors } = useTheme();
  const { user } = useUser();
  const { requireAuth, authSheetProps } = useAuthGate();
  const [factChecks, setFactChecks] = useState<FactCheck[]>([]);
  const [loading, setLoading] = useState(true);
  const [votedIds, setVotedIds] = useState<Set<string>>(new Set());
  const [showSubmit, setShowSubmit] = useState(false);

  const fetchFactChecks = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('story_factchecks')
        .select('*')
        .eq('story_id', storyId)
        .order('vote_count', { ascending: false })
        .limit(10);

      setFactChecks((data as FactCheck[]) || []);
    } catch {
      setFactChecks([]);
    }
    setLoading(false);
  }, [storyId]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    (async () => {
      await fetchFactChecks();
      if (cancelled) return;
    })();

    return () => { cancelled = true; };
  }, [fetchFactChecks]);

  const handleUpvote = useCallback(
    (factCheckId: string) => {
      requireAuth('upvote a fact-check', async () => {
        if (votedIds.has(factCheckId)) return;

        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setVotedIds((prev) => new Set(prev).add(factCheckId));

        // Optimistic update
        setFactChecks((prev) =>
          prev.map((fc) =>
            fc.id === factCheckId ? { ...fc, vote_count: fc.vote_count + 1 } : fc
          )
        );

        try {
          await supabase.rpc('increment_factcheck_vote', { factcheck_id: factCheckId });
        } catch {
          // Revert on error
          setVotedIds((prev) => {
            const next = new Set(prev);
            next.delete(factCheckId);
            return next;
          });
          setFactChecks((prev) =>
            prev.map((fc) =>
              fc.id === factCheckId ? { ...fc, vote_count: fc.vote_count - 1 } : fc
            )
          );
        }
      });
    },
    [requireAuth, votedIds]
  );

  if (loading) {
    return (
      <View style={{ padding: SPACING.xl, alignItems: 'center' }}>
        <ActivityIndicator color={colors.green} />
      </View>
    );
  }

  return (
    <View style={{ marginBottom: SPACING.xl }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.lg }}>
        <Ionicons name="shield-checkmark-outline" size={18} color={colors.green} />
        <Text style={{ fontSize: FONT_SIZE.title, fontWeight: FONT_WEIGHT.bold, color: colors.text, flex: 1 }}>
          Community fact-checks
        </Text>
        <Pressable
          onPress={() => requireAuth('submit a fact-check', () => setShowSubmit((v) => !v))}
          style={{
            backgroundColor: colors.greenBg,
            borderRadius: BORDER_RADIUS.sm,
            paddingHorizontal: SPACING.md,
            paddingVertical: SPACING.xs,
            flexDirection: 'row',
            alignItems: 'center',
            gap: SPACING.xs,
          }}
        >
          <Ionicons name="add" size={14} color={colors.green} />
          <Text style={{ fontSize: FONT_SIZE.caption, fontWeight: FONT_WEIGHT.semibold, color: colors.green }}>
            Add
          </Text>
        </Pressable>
      </View>

      {/* Empty state */}
      {factChecks.length === 0 && !showSubmit && (
        <View style={{
          backgroundColor: colors.card,
          borderRadius: BORDER_RADIUS.lg,
          padding: SPACING.xl,
          alignItems: 'center',
          ...SHADOWS.sm,
        }}>
          <Ionicons name="shield-outline" size={32} color={colors.textMuted} style={{ marginBottom: SPACING.sm }} />
          <Text style={{
            fontSize: FONT_SIZE.body,
            fontWeight: FONT_WEIGHT.semibold,
            color: colors.textMuted,
            textAlign: 'center',
            marginBottom: SPACING.xs,
          }}>
            No fact-checks yet
          </Text>
          <Text style={{
            fontSize: FONT_SIZE.small,
            color: colors.textMuted,
            textAlign: 'center',
            lineHeight: 18,
          }}>
            Be the first to verify claims in this story.
          </Text>
        </View>
      )}

      {/* Fact-check list */}
      {factChecks.map((fc) => {
        const config = getVerdictConfig(fc.verdict);
        const hasVoted = votedIds.has(fc.id);

        return (
          <View
            key={fc.id}
            style={{
              backgroundColor: colors.card,
              borderRadius: BORDER_RADIUS.lg,
              padding: SPACING.lg,
              marginBottom: SPACING.sm,
              ...SHADOWS.sm,
            }}
          >
            {/* Verdict badge row */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.sm }}>
              <Ionicons name={config.icon} size={18} color={config.color} />
              <View style={{
                backgroundColor: config.color + '18',
                borderRadius: BORDER_RADIUS.sm,
                paddingHorizontal: SPACING.sm,
                paddingVertical: 2,
              }}>
                <Text style={{
                  fontSize: FONT_SIZE.caption,
                  fontWeight: FONT_WEIGHT.bold,
                  color: config.color,
                  letterSpacing: 0.3,
                }}>
                  {formatVerdict(fc.verdict).toUpperCase()}
                </Text>
              </View>
              <Text style={{ fontSize: FONT_SIZE.caption, color: colors.textMuted, marginLeft: 'auto' }}>
                {timeAgo(fc.created_at)}
              </Text>
            </View>

            {/* Evidence link */}
            {fc.evidence_url && (
              <Pressable
                onPress={() => Linking.openURL(fc.evidence_url!)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, marginBottom: SPACING.sm }}
              >
                <Ionicons name="link-outline" size={12} color={colors.green} />
                <Text
                  style={{ fontSize: FONT_SIZE.small, color: colors.green, flex: 1 }}
                  numberOfLines={1}
                >
                  {fc.evidence_url}
                </Text>
              </Pressable>
            )}

            {/* Vote row */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              {fc.submitted_by && (
                <Text style={{ fontSize: FONT_SIZE.caption, color: colors.textMuted }}>
                  by {fc.submitted_by}
                </Text>
              )}
              <Pressable
                onPress={() => handleUpvote(fc.id)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: SPACING.xs,
                  backgroundColor: hasVoted ? colors.greenBg : colors.surface,
                  borderRadius: BORDER_RADIUS.sm,
                  paddingHorizontal: SPACING.md,
                  paddingVertical: SPACING.xs,
                  marginLeft: 'auto',
                }}
              >
                <Ionicons
                  name={hasVoted ? 'arrow-up-circle' : 'arrow-up-circle-outline'}
                  size={16}
                  color={hasVoted ? colors.green : colors.textMuted}
                />
                <Text style={{
                  fontSize: FONT_SIZE.small,
                  fontWeight: FONT_WEIGHT.semibold,
                  color: hasVoted ? colors.green : colors.textMuted,
                }}>
                  {fc.vote_count}
                </Text>
              </Pressable>
            </View>
          </View>
        );
      })}

      <AuthPromptSheet {...authSheetProps} />
    </View>
  );
}
