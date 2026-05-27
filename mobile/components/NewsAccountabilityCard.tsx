/**
 * NewsAccountabilityCard — Source reliability metrics mini card.
 *
 * Shows bias_score, factuality, and correction_rate for a given source
 * from the news_sources table. Rendered as a compact card with colored indicators.
 */
import React, { useState, useEffect } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useTheme } from '../context/ThemeContext';
import { SPACING, FONT_SIZE, FONT_WEIGHT, BORDER_RADIUS, SHADOWS } from '../constants/design';

interface Props {
  sourceName: string;
}

interface SourceMetrics {
  name: string;
  bias_score: number | null;
  factuality: string | null;
  correction_rate: number | null;
  leaning: string | null;
  owner: string | null;
}

function biasLabel(score: number): { label: string; color: string } {
  if (score <= -0.6) return { label: 'Far Left', color: '#1D4ED8' };
  if (score <= -0.2) return { label: 'Left-Lean', color: '#2563EB' };
  if (score <= 0.2) return { label: 'Centre', color: '#6B7280' };
  if (score <= 0.6) return { label: 'Right-Lean', color: '#DC3545' };
  return { label: 'Far Right', color: '#991B1B' };
}

function factualityConfig(factuality: string | null): { label: string; color: string; icon: keyof typeof Ionicons.glyphMap } {
  if (!factuality) return { label: 'Unknown', color: '#6B7280', icon: 'help-circle-outline' };
  const f = factuality.toLowerCase();
  if (f.includes('very high') || f === 'high') return { label: factuality, color: '#22C55E', icon: 'shield-checkmark' };
  if (f.includes('mostly') || f.includes('mixed')) return { label: factuality, color: '#D97706', icon: 'alert-circle-outline' };
  if (f.includes('low')) return { label: factuality, color: '#DC3545', icon: 'warning-outline' };
  return { label: factuality, color: '#6B7280', icon: 'help-circle-outline' };
}

export function NewsAccountabilityCard({ sourceName }: Props) {
  const { colors } = useTheme();
  const [metrics, setMetrics] = useState<SourceMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!sourceName) {
      setMetrics(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        const { data } = await supabase
          .from('news_sources')
          .select('name, bias_score, factuality, correction_rate, leaning, owner')
          .eq('name', sourceName)
          .maybeSingle();

        if (!cancelled) {
          setMetrics((data as SourceMetrics | null) || null);
          setLoading(false);
        }
      } catch {
        if (!cancelled) {
          setMetrics(null);
          setLoading(false);
        }
      }
    })();

    return () => { cancelled = true; };
  }, [sourceName]);

  if (loading) {
    return (
      <View style={{ padding: SPACING.lg, alignItems: 'center' }}>
        <ActivityIndicator color={colors.green} size="small" />
      </View>
    );
  }

  if (!metrics) {
    return (
      <View style={{
        backgroundColor: colors.card,
        borderRadius: BORDER_RADIUS.lg,
        padding: SPACING.lg,
        ...SHADOWS.sm,
      }}>
        <Text style={{ fontSize: FONT_SIZE.small, fontWeight: FONT_WEIGHT.semibold, color: colors.text, marginBottom: SPACING.xs }}>
          {sourceName}
        </Text>
        <Text style={{ fontSize: FONT_SIZE.caption, color: colors.textMuted }}>
          No reliability data available for this source.
        </Text>
      </View>
    );
  }

  const bias = metrics.bias_score !== null ? biasLabel(metrics.bias_score) : null;
  const factuality = factualityConfig(metrics.factuality);

  return (
    <View style={{
      backgroundColor: colors.card,
      borderRadius: BORDER_RADIUS.lg,
      padding: SPACING.lg,
      ...SHADOWS.sm,
    }}>
      {/* Source name + owner */}
      <View style={{ marginBottom: SPACING.md }}>
        <Text style={{
          fontSize: FONT_SIZE.body,
          fontWeight: FONT_WEIGHT.bold,
          color: colors.text,
        }}>
          {metrics.name}
        </Text>
        {metrics.owner && (
          <Text style={{ fontSize: FONT_SIZE.caption, color: colors.textMuted, marginTop: 2 }}>
            Owned by {metrics.owner}
          </Text>
        )}
      </View>

      {/* Metrics row */}
      <View style={{ flexDirection: 'row', gap: SPACING.sm }}>
        {/* Bias */}
        {bias && (
          <View style={{
            flex: 1,
            backgroundColor: colors.surface,
            borderRadius: BORDER_RADIUS.md,
            padding: SPACING.md,
            alignItems: 'center',
          }}>
            <View style={{
              width: 32,
              height: 32,
              borderRadius: 16,
              backgroundColor: bias.color + '18',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: SPACING.xs,
            }}>
              <Ionicons name="swap-horizontal" size={16} color={bias.color} />
            </View>
            <Text style={{
              fontSize: FONT_SIZE.caption,
              fontWeight: FONT_WEIGHT.bold,
              color: bias.color,
              textAlign: 'center',
            }}>
              {bias.label}
            </Text>
            <Text style={{ fontSize: FONT_SIZE.caption - 1, color: colors.textMuted, marginTop: 2 }}>
              Bias
            </Text>
          </View>
        )}

        {/* Factuality */}
        <View style={{
          flex: 1,
          backgroundColor: colors.surface,
          borderRadius: BORDER_RADIUS.md,
          padding: SPACING.md,
          alignItems: 'center',
        }}>
          <View style={{
            width: 32,
            height: 32,
            borderRadius: 16,
            backgroundColor: factuality.color + '18',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: SPACING.xs,
          }}>
            <Ionicons name={factuality.icon} size={16} color={factuality.color} />
          </View>
          <Text style={{
            fontSize: FONT_SIZE.caption,
            fontWeight: FONT_WEIGHT.bold,
            color: factuality.color,
            textAlign: 'center',
          }}>
            {factuality.label}
          </Text>
          <Text style={{ fontSize: FONT_SIZE.caption - 1, color: colors.textMuted, marginTop: 2 }}>
            Factuality
          </Text>
        </View>

        {/* Correction rate */}
        {metrics.correction_rate !== null && (
          <View style={{
            flex: 1,
            backgroundColor: colors.surface,
            borderRadius: BORDER_RADIUS.md,
            padding: SPACING.md,
            alignItems: 'center',
          }}>
            <View style={{
              width: 32,
              height: 32,
              borderRadius: 16,
              backgroundColor: colors.greenLight,
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: SPACING.xs,
            }}>
              <Ionicons name="refresh-outline" size={16} color={colors.green} />
            </View>
            <Text style={{
              fontSize: FONT_SIZE.caption,
              fontWeight: FONT_WEIGHT.bold,
              color: colors.text,
              textAlign: 'center',
            }}>
              {(metrics.correction_rate * 100).toFixed(0)}%
            </Text>
            <Text style={{ fontSize: FONT_SIZE.caption - 1, color: colors.textMuted, marginTop: 2 }}>
              Corrections
            </Text>
          </View>
        )}
      </View>

      {/* Footer */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, marginTop: SPACING.md }}>
        <Ionicons name="information-circle-outline" size={10} color={colors.textMuted} />
        <Text style={{ fontSize: FONT_SIZE.caption, color: colors.textMuted }}>
          Ratings from Media Bias/Fact Check
        </Text>
      </View>
    </View>
  );
}
