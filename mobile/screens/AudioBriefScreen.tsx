import React from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../context/ThemeContext';
import { useAudioBrief } from '../hooks/useAudioBrief';
import { SkeletonLoader } from '../components/SkeletonLoader';
import { SPACING, FONT_SIZE, FONT_WEIGHT, BORDER_RADIUS, SHADOWS } from '../constants/design';
import { hapticLight } from '../lib/haptics';
import { track } from '../lib/analytics';

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatBriefDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' });
}

export function AudioBriefScreen({ navigation }: any) {
  const { colors } = useTheme();
  const { brief, loading, playing, progress, toggle } = useAudioBrief();

  const handleToggle = () => {
    hapticLight();
    track('audio_brief_toggle', { action: playing ? 'pause' : 'play' }, 'AudioBrief');
    toggle();
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Hero */}
        <LinearGradient
          colors={['#1E1B4B', '#312E81']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            paddingTop: SPACING.lg,
            paddingHorizontal: 20,
            paddingBottom: SPACING.xxxl,
            overflow: 'hidden',
          }}
        >
          {/* Decorative */}
          <View
            pointerEvents="none"
            style={{
              position: 'absolute', top: -30, right: -30,
              width: 140, height: 140, borderRadius: 70,
              backgroundColor: 'rgba(255,255,255,0.04)',
            }}
          />

          {/* Back */}
          <Pressable
            onPress={() => navigation.goBack()}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={{ marginBottom: SPACING.xl }}
          >
            <Ionicons name="arrow-back" size={22} color="#ffffff" />
          </Pressable>

          {/* Title */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.sm }}>
            <Ionicons name="headset-outline" size={20} color="#A78BFA" />
            <Text style={{
              fontSize: FONT_SIZE.caption, fontWeight: FONT_WEIGHT.bold,
              color: '#A78BFA', letterSpacing: 1, textTransform: 'uppercase',
            }}>
              YOUR DAILY BRIEF
            </Text>
          </View>

          <Text style={{
            fontSize: FONT_SIZE.heading + 6, fontWeight: FONT_WEIGHT.bold,
            color: '#ffffff', letterSpacing: -0.5,
          }}>
            Listen to today's brief
          </Text>

          {brief && (
            <Text style={{
              fontSize: FONT_SIZE.body, color: 'rgba(255,255,255,0.6)',
              marginTop: SPACING.sm,
            }}>
              {formatBriefDate(brief.date)} · ~{formatDuration(brief.totalDurationEstimate)}
            </Text>
          )}
        </LinearGradient>

        {loading ? (
          <View style={{ padding: 20, gap: SPACING.md }}>
            <SkeletonLoader height={80} borderRadius={BORDER_RADIUS.lg} />
            <SkeletonLoader height={160} borderRadius={BORDER_RADIUS.lg} />
          </View>
        ) : !brief ? (
          /* No brief available */
          <View style={{ padding: 20, alignItems: 'center', marginTop: SPACING.xxl }}>
            <Ionicons name="mic-off-outline" size={48} color={colors.textMuted} />
            <Text style={{
              fontSize: FONT_SIZE.subtitle, fontWeight: FONT_WEIGHT.bold,
              color: colors.text, marginTop: SPACING.lg, textAlign: 'center',
            }}>
              No brief available yet
            </Text>
            <Text style={{
              fontSize: FONT_SIZE.body, color: colors.textMuted,
              textAlign: 'center', marginTop: SPACING.sm, lineHeight: 22,
            }}>
              Briefs are generated each morning at 7am AEST.
              Check back tomorrow.
            </Text>
          </View>
        ) : (
          <View style={{ paddingHorizontal: 20 }}>
            {/* ── Player card ── */}
            <View style={{
              marginTop: -SPACING.xl,
              backgroundColor: colors.card,
              borderRadius: BORDER_RADIUS.xl,
              padding: SPACING.xl,
              ...SHADOWS.lg,
            }}>
              {/* Play button */}
              <Pressable
                onPress={handleToggle}
                accessibilityRole="button"
                accessibilityLabel={playing ? 'Pause brief' : 'Play brief'}
                style={({ pressed }) => ({
                  width: 72, height: 72, borderRadius: 36,
                  backgroundColor: pressed ? '#4C1D95' : '#312E81',
                  justifyContent: 'center', alignItems: 'center',
                  alignSelf: 'center',
                  marginBottom: SPACING.lg,
                  ...SHADOWS.md,
                })}
              >
                <Ionicons
                  name={playing ? 'pause' : 'play'}
                  size={32}
                  color="#ffffff"
                  style={playing ? {} : { marginLeft: 4 }}
                />
              </Pressable>

              {/* Progress bar */}
              <View style={{
                height: 4, borderRadius: 2,
                backgroundColor: colors.border,
                overflow: 'hidden',
                marginBottom: SPACING.sm,
              }}>
                <View style={{
                  height: '100%',
                  width: `${progress * 100}%`,
                  backgroundColor: '#312E81',
                  borderRadius: 2,
                }} />
              </View>

              {/* Time labels */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ fontSize: FONT_SIZE.caption, color: colors.textMuted }}>
                  {formatDuration(Math.floor(progress * brief.totalDurationEstimate))}
                </Text>
                <Text style={{ fontSize: FONT_SIZE.caption, color: colors.textMuted }}>
                  {formatDuration(brief.totalDurationEstimate)}
                </Text>
              </View>

              {/* Status */}
              <View style={{
                flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                gap: SPACING.sm, marginTop: SPACING.lg,
              }}>
                {playing && (
                  <>
                    <View style={{
                      width: 6, height: 6, borderRadius: 3,
                      backgroundColor: '#22C55E',
                    }} />
                    <Text style={{ fontSize: FONT_SIZE.small, color: colors.textMuted }}>
                      Playing — on-device audio
                    </Text>
                  </>
                )}
                {!playing && progress > 0 && progress < 1 && (
                  <Text style={{ fontSize: FONT_SIZE.small, color: colors.textMuted }}>
                    Paused
                  </Text>
                )}
                {!playing && progress === 0 && (
                  <Text style={{ fontSize: FONT_SIZE.small, color: colors.textMuted }}>
                    Tap to listen · ~{formatDuration(brief.totalDurationEstimate)}
                  </Text>
                )}
              </View>
            </View>

            {/* ── Transcript sections ── */}
            <Text style={{
              fontSize: FONT_SIZE.caption, fontWeight: FONT_WEIGHT.bold,
              color: colors.textMuted, letterSpacing: 0.8,
              marginTop: SPACING.xxl, marginBottom: SPACING.md,
            }}>
              TRANSCRIPT
            </Text>

            {brief.sections.map((section, i) => (
              <View
                key={section.id}
                style={{
                  backgroundColor: colors.card,
                  borderRadius: BORDER_RADIUS.lg,
                  padding: SPACING.lg,
                  marginBottom: SPACING.sm,
                  ...SHADOWS.sm,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.sm }}>
                  <View style={{
                    width: 24, height: 24, borderRadius: 12,
                    backgroundColor: i === 0 ? '#E8F5EE' : i === 1 ? '#EFF6FF' : '#FFF7ED',
                    justifyContent: 'center', alignItems: 'center',
                  }}>
                    <Text style={{
                      fontSize: 11, fontWeight: FONT_WEIGHT.bold,
                      color: i === 0 ? '#00843D' : i === 1 ? '#2563EB' : '#EA580C',
                    }}>
                      {i + 1}
                    </Text>
                  </View>
                  <Text style={{
                    fontSize: FONT_SIZE.caption, fontWeight: FONT_WEIGHT.bold,
                    color: colors.textMuted, letterSpacing: 0.5, textTransform: 'uppercase',
                  }}>
                    {section.label}
                  </Text>
                </View>
                <Text style={{
                  fontSize: FONT_SIZE.body, color: colors.textBody, lineHeight: 22,
                }}>
                  {section.text}
                </Text>
              </View>
            ))}

            {/* ── Footer note ── */}
            <View style={{
              padding: SPACING.lg,
              backgroundColor: colors.surface,
              borderRadius: BORDER_RADIUS.lg,
              marginTop: SPACING.md,
              marginBottom: SPACING.xxl,
              flexDirection: 'row',
              gap: SPACING.sm,
            }}>
              <Ionicons name="information-circle-outline" size={16} color={colors.textMuted} style={{ marginTop: 1 }} />
              <Text style={{ flex: 1, fontSize: FONT_SIZE.small, color: colors.textMuted, lineHeight: 18 }}>
                Audio is generated on-device using text-to-speech. A higher-quality hosted voice is coming soon.
              </Text>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
