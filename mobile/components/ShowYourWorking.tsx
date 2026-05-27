import React, { useState } from 'react';
import { View, Text, Pressable, Modal, Linking, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { SPACING, FONT_SIZE, FONT_WEIGHT, BORDER_RADIUS } from '../constants/design';

/**
 * Show-your-working — reusable source transparency component.
 *
 * Use pattern A (inline): wrap any number/score with <TappableStat> to make
 * it show source info on tap.
 *
 * Use pattern B (modal): call <WorkingModal> with structured source data.
 *
 * Every computed number in the app should use one of these patterns.
 */

export interface SourceInfo {
  label: string;         // "Attendance Rate"
  value: string;         // "94.2%"
  source: string;        // "TheyVoteForYou API" | "ABS Census 2021" | "AEC" | ...
  sourceUrl?: string;    // link to primary source
  methodology?: string;  // "Aye votes / total divisions in 47th Parliament"
  period?: string;       // "47th Parliament" | "2021 Census" | "FY2023-24"
  asOf?: string;         // "2026-05-26"
  confidence?: string;   // "High" | "Medium" | "Low"
}

// ── Pattern A: Tappable stat (inline) ───────────────────────────────

export function TappableStat({
  value,
  unit,
  source,
  style,
  valueStyle,
  children,
}: {
  value: string;
  unit?: string;
  source: SourceInfo;
  style?: any;
  valueStyle?: any;
  children?: React.ReactNode;
}) {
  const { colors } = useTheme();
  const [showModal, setShowModal] = useState(false);

  return (
    <>
      <Pressable
        onPress={() => setShowModal(true)}
        accessibilityRole="button"
        accessibilityLabel={`${source.label}: ${value}. Tap to see source.`}
        accessibilityHint="Shows how this number was calculated"
        style={[{ flexDirection: 'row', alignItems: 'baseline' }, style]}
      >
        {children ?? (
          <>
            <Text style={[{
              fontSize: FONT_SIZE.heading, fontWeight: FONT_WEIGHT.bold, color: colors.text,
            }, valueStyle]}>
              {value}
            </Text>
            {unit && (
              <Text style={{ fontSize: FONT_SIZE.small, color: colors.textMuted, marginLeft: 2 }}>
                {unit}
              </Text>
            )}
          </>
        )}
        <View style={{
          marginLeft: SPACING.xs,
          width: 14, height: 14, borderRadius: 7,
          backgroundColor: '#E8F5EE',
          justifyContent: 'center', alignItems: 'center',
        }}>
          <Ionicons name="information-circle" size={12} color="#00843D" />
        </View>
      </Pressable>

      <WorkingModal
        visible={showModal}
        source={source}
        onClose={() => setShowModal(false)}
      />
    </>
  );
}

// ── Pattern B: Working modal ────────────────────────────────────────

const SOURCE_BADGE_COLORS: Record<string, { bg: string; text: string }> = {
  'TheyVoteForYou API': { bg: '#E8F5EE', text: '#00843D' },
  'ABS Census 2021':    { bg: '#E6F1FB', text: '#0C447C' },
  'AEC':                { bg: '#FAEEDA', text: '#633806' },
  'PBO':                { bg: '#EEEDFE', text: '#3C3489' },
  'Treasury':           { bg: '#FBEAF0', text: '#72243E' },
  'Verity-computed':    { bg: '#E8F5EE', text: '#00843D' },
};

export function WorkingModal({
  visible,
  source,
  onClose,
}: {
  visible: boolean;
  source: SourceInfo | null;
  onClose: () => void;
}) {
  const { colors } = useTheme();
  if (!source) return null;

  const badge = SOURCE_BADGE_COLORS[source.source] ?? { bg: '#F3F4F6', text: '#374151' };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <Pressable
        style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' }}
        onPress={onClose}
      >
        <Pressable
          style={{
            backgroundColor: colors.card,
            borderTopLeftRadius: BORDER_RADIUS.lg,
            borderTopRightRadius: BORDER_RADIUS.lg,
            padding: SPACING.xl,
            paddingBottom: SPACING.xxxl,
          }}
          onPress={() => {}} // prevent dismiss when tapping content
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.lg }}>
            <Text style={{ fontSize: FONT_SIZE.title, fontWeight: FONT_WEIGHT.bold, color: colors.text }}>
              Show your working
            </Text>
            <Pressable onPress={onClose} hitSlop={12}>
              <Ionicons name="close" size={24} color={colors.textMuted} />
            </Pressable>
          </View>

          {/* Stat */}
          <View style={{ marginBottom: SPACING.lg }}>
            <Text style={{ fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.semibold, color: colors.text, marginBottom: SPACING.xs }}>
              {source.label}
            </Text>
            <Text style={{ fontSize: FONT_SIZE.heading, fontWeight: FONT_WEIGHT.bold, color: '#00843D' }}>
              {source.value}
            </Text>
          </View>

          {/* Details */}
          <View style={{
            backgroundColor: colors.surface, borderRadius: BORDER_RADIUS.sm,
            padding: SPACING.md, marginBottom: SPACING.md,
          }}>
            <DetailRow label="Source">
              <View style={{
                backgroundColor: badge.bg, paddingHorizontal: SPACING.sm,
                paddingVertical: 2, borderRadius: BORDER_RADIUS.sm,
              }}>
                <Text style={{ fontSize: 10, fontWeight: FONT_WEIGHT.semibold, color: badge.text }}>
                  {source.source}
                </Text>
              </View>
            </DetailRow>
            {source.period && <DetailRow label="Period" value={source.period} />}
            {source.asOf && <DetailRow label="As of" value={source.asOf} />}
            {source.confidence && <DetailRow label="Confidence" value={source.confidence} />}
            {source.sourceUrl && (
              <Pressable onPress={() => Linking.openURL(source.sourceUrl!)}>
                <DetailRow label="Reference" value="View source ↗" isLink />
              </Pressable>
            )}
          </View>

          {/* Methodology */}
          {source.methodology && (
            <View style={{ marginBottom: SPACING.md }}>
              <Text style={{ fontSize: FONT_SIZE.small, fontWeight: FONT_WEIGHT.semibold, color: colors.text, marginBottom: SPACING.xs }}>
                Methodology
              </Text>
              <Text style={{ fontSize: FONT_SIZE.small, color: colors.textMuted, lineHeight: 18 }}>
                {source.methodology}
              </Text>
            </View>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function DetailRow({
  label,
  value,
  isLink,
  children,
}: {
  label: string;
  value?: string;
  isLink?: boolean;
  children?: React.ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: SPACING.xs }}>
      <Text style={{ fontSize: FONT_SIZE.small, color: colors.textMuted }}>{label}</Text>
      {children ?? (
        <Text style={{
          fontSize: FONT_SIZE.small,
          color: isLink ? '#00843D' : colors.text,
          fontWeight: FONT_WEIGHT.medium,
        }}>
          {value}
        </Text>
      )}
    </View>
  );
}
