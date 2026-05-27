import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { SPACING, FONT_SIZE, FONT_WEIGHT, BORDER_RADIUS, SHADOWS } from '../constants/design';

/**
 * ProGate — wraps pro-only content. Shows content if isPro, otherwise shows
 * a tasteful upsell card with a CTA to the subscription screen.
 *
 * Usage:
 *   <ProGate isPro={isPro} navigation={navigation} feature="AI Impact Analysis">
 *     <ExpensiveProContent />
 *   </ProGate>
 */

export function ProGate({
  isPro,
  navigation,
  feature,
  children,
  compact,
}: {
  isPro: boolean;
  navigation: any;
  feature: string;
  children: React.ReactNode;
  compact?: boolean;
}) {
  if (isPro) return <>{children}</>;

  return <ProUpsell navigation={navigation} feature={feature} compact={compact} />;
}

export function ProUpsell({
  navigation,
  feature,
  compact,
}: {
  navigation: any;
  feature: string;
  compact?: boolean;
}) {
  const { colors } = useTheme();

  if (compact) {
    return (
      <Pressable
        onPress={() => navigation.navigate('Subscription')}
        style={({ pressed }) => ({
          flexDirection: 'row', alignItems: 'center',
          backgroundColor: '#E8F5EE',
          borderRadius: BORDER_RADIUS.md,
          padding: SPACING.md,
          opacity: pressed ? 0.8 : 1,
        })}
      >
        <Ionicons name="lock-closed" size={16} color="#00843D" />
        <Text style={{
          fontSize: FONT_SIZE.small, color: '#00843D',
          fontWeight: FONT_WEIGHT.medium, marginLeft: SPACING.sm, flex: 1,
        }}>
          {feature} — Verity Pro
        </Text>
        <Ionicons name="chevron-forward" size={14} color="#00843D" />
      </Pressable>
    );
  }

  return (
    <View style={{
      backgroundColor: colors.card,
      borderRadius: BORDER_RADIUS.lg,
      padding: SPACING.xl,
      alignItems: 'center',
      ...SHADOWS.sm,
    }}>
      <View style={{
        width: 56, height: 56, borderRadius: 28,
        backgroundColor: '#E8F5EE',
        justifyContent: 'center', alignItems: 'center',
        marginBottom: SPACING.lg,
      }}>
        <Ionicons name="diamond-outline" size={28} color="#00843D" />
      </View>
      <Text style={{
        fontSize: FONT_SIZE.subtitle, fontWeight: FONT_WEIGHT.bold,
        color: colors.text, textAlign: 'center', marginBottom: SPACING.sm,
      }}>
        {feature}
      </Text>
      <Text style={{
        fontSize: FONT_SIZE.body, color: colors.textMuted,
        textAlign: 'center', marginBottom: SPACING.lg, lineHeight: 22,
      }}>
        Unlock deeper analysis with Verity Pro
      </Text>
      <Pressable
        onPress={() => navigation.navigate('Subscription')}
        style={({ pressed }) => ({
          backgroundColor: '#00843D',
          borderRadius: BORDER_RADIUS.md,
          paddingVertical: SPACING.md,
          paddingHorizontal: SPACING.xxl,
          opacity: pressed ? 0.9 : 1,
        })}
      >
        <Text style={{
          fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.semibold,
          color: '#fff',
        }}>
          Try Free for 7 Days
        </Text>
      </Pressable>
      <Text style={{
        fontSize: FONT_SIZE.caption, color: colors.textMuted,
        marginTop: SPACING.sm,
      }}>
        $4.99/month after trial · Cancel anytime
      </Text>
    </View>
  );
}
