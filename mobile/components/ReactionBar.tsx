import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { SPACING, FONT_SIZE, FONT_WEIGHT, BORDER_RADIUS } from '../constants/design';
import type { ReactionType } from '../hooks/useMPPostReaction';

interface ReactionBarProps {
  agreeCt: number;
  disagreeCt: number;
  insightfulCt: number;
  myReaction: ReactionType | null;
  onReact: (type: ReactionType) => void;
  disabled?: boolean;
}

const REACTIONS: { type: ReactionType; icon: string; activeIcon: string; activeColor: string }[] = [
  { type: 'agree', icon: 'thumbs-up-outline', activeIcon: 'thumbs-up', activeColor: '#00843D' },
  { type: 'disagree', icon: 'thumbs-down-outline', activeIcon: 'thumbs-down', activeColor: '#DC3545' },
  { type: 'insightful', icon: 'bulb-outline', activeIcon: 'bulb', activeColor: '#92710C' },
];

export function ReactionBar({ agreeCt, disagreeCt, insightfulCt, myReaction, onReact, disabled }: ReactionBarProps) {
  const { colors } = useTheme();
  const counts: Record<ReactionType, number> = { agree: agreeCt, disagree: disagreeCt, insightful: insightfulCt };

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.lg }}>
      {REACTIONS.map(r => {
        const active = myReaction === r.type;
        const count = counts[r.type];
        return (
          <Pressable
            key={r.type}
            onPress={() => onReact(r.type)}
            disabled={disabled}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={`${r.type}, currently ${count}${active ? ', selected' : ''}`}
            accessibilityState={{ selected: active }}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: SPACING.xs,
              opacity: pressed ? 0.7 : 1,
              paddingVertical: SPACING.xs,
              paddingHorizontal: SPACING.sm,
              borderRadius: BORDER_RADIUS.full,
              backgroundColor: active ? (r.activeColor + '14') : 'transparent',
            })}
          >
            <Ionicons
              name={(active ? r.activeIcon : r.icon) as any}
              size={18}
              color={active ? r.activeColor : colors.textMuted}
            />
            {count > 0 && (
              <Text style={{
                fontSize: FONT_SIZE.caption,
                fontWeight: active ? FONT_WEIGHT.bold : FONT_WEIGHT.medium,
                color: active ? r.activeColor : colors.textMuted,
              }}>
                {count}
              </Text>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}
