import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { VerifiedBadge } from './VerifiedBadge';
import { ReactionBar } from './ReactionBar';
import { timeAgo } from '../lib/timeAgo';
import { SPACING, FONT_SIZE, FONT_WEIGHT, BORDER_RADIUS, SHADOWS } from '../constants/design';
import type { MPPost } from '../hooks/useMPPosts';
import type { ReactionType } from '../hooks/useMPPostReaction';

interface MPPostCardProps {
  post: MPPost;
  myReaction: ReactionType | null;
  onReact: (type: ReactionType) => void;
  onPress: () => void;
  maxLines?: number;
}

export function MPPostCard({ post, myReaction, onReact, onPress, maxLines = 3 }: MPPostCardProps) {
  const { colors } = useTheme();
  const member = post.member;
  const partyColor = member?.party?.colour || colors.green;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Post by ${member?.first_name} ${member?.last_name}: ${post.title || post.body.slice(0, 60)}`}
      style={({ pressed }) => ({
        flexDirection: 'row',
        backgroundColor: colors.card,
        borderRadius: BORDER_RADIUS.lg,
        overflow: 'hidden',
        opacity: pressed ? 0.92 : 1,
        ...SHADOWS.md,
      })}
    >
      {/* Party color accent */}
      <View style={{ width: 4, backgroundColor: partyColor }} />

      <View style={{ flex: 1, padding: SPACING.lg }}>
        {/* Header: photo + name + verified + party + time */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.sm }}>
          {member?.photo_url ? (
            <Image
              source={{ uri: member.photo_url }}
              style={{ width: 36, height: 36, borderRadius: 18, marginRight: SPACING.sm }}
              contentFit="cover"
            />
          ) : (
            <View style={{
              width: 36, height: 36, borderRadius: 18, marginRight: SPACING.sm,
              backgroundColor: partyColor + '20',
              justifyContent: 'center', alignItems: 'center',
            }}>
              <Text style={{ fontSize: FONT_SIZE.small, fontWeight: FONT_WEIGHT.bold, color: partyColor }}>
                {member?.first_name?.[0]}{member?.last_name?.[0]}
              </Text>
            </View>
          )}
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={{ fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.semibold, color: colors.text }}>
                {member?.first_name} {member?.last_name}
              </Text>
              <VerifiedBadge size={14} />
            </View>
            <Text style={{ fontSize: FONT_SIZE.caption, color: colors.textMuted }}>
              {member?.party?.short_name} · {timeAgo(post.created_at)}
            </Text>
          </View>
        </View>

        {/* Title (if present) */}
        {post.title && (
          <Text style={{
            fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.bold, color: colors.text,
            marginBottom: SPACING.xs, lineHeight: 20,
          }} numberOfLines={2}>
            {post.title}
          </Text>
        )}

        {/* Body */}
        <Text style={{
          fontSize: FONT_SIZE.body, color: colors.textBody, lineHeight: 22,
          marginBottom: SPACING.md,
        }} numberOfLines={maxLines}>
          {post.body}
        </Text>

        {/* Reactions */}
        <View onStartShouldSetResponder={() => true}>
          <ReactionBar
            agreeCt={post.agree_count}
            disagreeCt={post.disagree_count}
            insightfulCt={post.insightful_count}
            myReaction={myReaction}
            onReact={onReact}
          />
        </View>
      </View>
    </Pressable>
  );
}
