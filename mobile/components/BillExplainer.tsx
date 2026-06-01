/**
 * BillExplainer — plain-English bill summary component.
 * Shows AI-generated 3-line summary, "what it changes for you", and caveats.
 * Clearly labelled as AI summary with one-tap access to original bill text.
 */
import React from 'react';
import { View, Text, Pressable, Linking, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useBillExplainer } from '../hooks/useBillExplainer';
import { SourceTrace } from './SourceTrace';
import { SPACING, FONT_SIZE, FONT_WEIGHT, BORDER_RADIUS, SHADOWS } from '../constants/design';

interface BillExplainerProps {
  billId: string;
  billTitle: string;
  textUrl?: string | null;     // APH bill text URL
  aphUrl?: string | null;      // APH bill page URL
}

export function BillExplainerCard({ billId, billTitle, textUrl, aphUrl }: BillExplainerProps) {
  const { colors } = useTheme();
  const { explainer, loading, error } = useBillExplainer(billId);

  if (error && !explainer) return null; // Silent fail — existing summary still shows

  if (loading) {
    return (
      <View style={{
        backgroundColor: colors.card, borderRadius: BORDER_RADIUS.lg,
        padding: SPACING.lg, ...SHADOWS.sm, alignItems: 'center', gap: SPACING.sm,
      }}>
        <ActivityIndicator size="small" color="#00843D" />
        <Text style={{ fontSize: FONT_SIZE.small, color: colors.textMuted }}>
          Generating plain-English summary...
        </Text>
      </View>
    );
  }

  if (!explainer) return null;

  const sourceUrl = textUrl || aphUrl;

  return (
    <View style={{
      backgroundColor: colors.card, borderRadius: BORDER_RADIUS.lg,
      padding: SPACING.lg, ...SHADOWS.sm,
    }}>
      {/* AI label */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.md }}>
        <View style={{
          backgroundColor: '#E8F5EE', borderRadius: BORDER_RADIUS.sm,
          paddingHorizontal: SPACING.sm, paddingVertical: 2,
        }}>
          <Text style={{ fontSize: 10, fontWeight: FONT_WEIGHT.bold, color: '#00843D', letterSpacing: 0.5 }}>
            AI SUMMARY
          </Text>
        </View>
        <View style={{ flex: 1 }} />
        {sourceUrl && (
          <Pressable onPress={() => Linking.openURL(sourceUrl)} hitSlop={8}>
            <Text style={{ fontSize: FONT_SIZE.caption, color: '#00843D', fontWeight: FONT_WEIGHT.medium }}>
              Original text →
            </Text>
          </Pressable>
        )}
      </View>

      {/* 3-line summary */}
      <Text style={{
        fontSize: FONT_SIZE.body, color: colors.text, lineHeight: 22,
        marginBottom: SPACING.md,
      }}>
        {explainer.summary_3line}
      </Text>

      {/* What it changes for you */}
      {explainer.what_it_changes_for_you && (
        <View style={{
          backgroundColor: '#F0F9FF', borderRadius: BORDER_RADIUS.md,
          padding: SPACING.md, marginBottom: SPACING.md,
          borderLeftWidth: 3, borderLeftColor: '#2563EB',
        }}>
          <Text style={{ fontSize: FONT_SIZE.caption, fontWeight: FONT_WEIGHT.bold, color: '#2563EB', marginBottom: SPACING.xs }}>
            WHAT IT CHANGES FOR YOU
          </Text>
          <Text style={{ fontSize: FONT_SIZE.body, color: colors.text, lineHeight: 20 }}>
            {explainer.what_it_changes_for_you}
          </Text>
        </View>
      )}

      {/* Caveats */}
      {explainer.caveats && (
        <View style={{ flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.md }}>
          <Ionicons name="information-circle-outline" size={16} color={colors.textMuted} style={{ marginTop: 2 }} />
          <Text style={{ fontSize: FONT_SIZE.small, color: colors.textMuted, lineHeight: 18, flex: 1, fontStyle: 'italic' }}>
            {explainer.caveats}
          </Text>
        </View>
      )}

      {/* Source trace */}
      <SourceTrace
        label="AI-generated · Verify with official parliamentary records"
        sourceUrl={sourceUrl}
      />
    </View>
  );
}
