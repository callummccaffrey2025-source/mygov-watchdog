import React from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useUser } from '../context/UserContext';
import { useMPPostReaction } from '../hooks/useMPPostReaction';
import { useAuthGate } from '../hooks/useAuthGate';
import { VerifiedBadge } from '../components/VerifiedBadge';
import { ReactionBar } from '../components/ReactionBar';
import { AuthPromptSheet } from '../components/AuthPromptSheet';
import { timeAgo } from '../lib/timeAgo';
import { SPACING, FONT_SIZE, FONT_WEIGHT, BORDER_RADIUS, SHADOWS } from '../constants/design';
import type { MPPost } from '../hooks/useMPPosts';

export function MPPostDetailScreen({ navigation, route }: any) {
  const { post } = route.params as { post: MPPost };
  const { colors } = useTheme();
  const { user } = useUser();
  const { myReaction, react } = useMPPostReaction(post.id);
  const { requireAuth, authSheetProps } = useAuthGate();
  const member = post.member;
  const partyColor = member?.party?.colour || colors.green;

  const handleReact = (type: 'agree' | 'disagree' | 'insightful') => {
    if (!user) { requireAuth('react to this post', () => react(type)); return; }
    react(type);
  };

  if (!post) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }} edges={['top']}>
        <Ionicons name="document-text-outline" size={48} color={colors.textMuted} />
        <Text style={{ fontSize: FONT_SIZE.body, color: colors.textMuted, marginTop: SPACING.md }}>Post unavailable</Text>
        <Pressable onPress={() => navigation.goBack()} style={{ marginTop: SPACING.lg }}>
          <Text style={{ fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.semibold, color: colors.green }}>Go back</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      {/* Header */}
      <View style={{
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md,
        borderBottomWidth: 0.5, borderBottomColor: colors.border,
      }}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={8} accessibilityRole="button" accessibilityLabel="Go back">
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={{ fontSize: FONT_SIZE.subtitle, fontWeight: FONT_WEIGHT.semibold, color: colors.text }}>Post</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: SPACING.lg, paddingBottom: SPACING.xxxl }} showsVerticalScrollIndicator={false}>
        {/* MP header */}
        <Pressable
          onPress={() => navigation.navigate('MemberProfile', { member })}
          accessibilityRole="button"
          accessibilityLabel={`View ${member?.first_name} ${member?.last_name}'s profile`}
          style={({ pressed }) => ({
            flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.xl,
            opacity: pressed ? 0.8 : 1,
          })}
        >
          {member?.photo_url ? (
            <Image
              source={{ uri: member.photo_url }}
              style={{ width: 48, height: 48, borderRadius: 24, marginRight: SPACING.md }}
              contentFit="cover"
            />
          ) : (
            <View style={{
              width: 48, height: 48, borderRadius: 24, marginRight: SPACING.md,
              backgroundColor: partyColor + '20',
              justifyContent: 'center', alignItems: 'center',
            }}>
              <Text style={{ fontSize: FONT_SIZE.subtitle, fontWeight: FONT_WEIGHT.bold, color: partyColor }}>
                {member?.first_name?.[0]}{member?.last_name?.[0]}
              </Text>
            </View>
          )}
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={{ fontSize: FONT_SIZE.subtitle, fontWeight: FONT_WEIGHT.bold, color: colors.text }}>
                {member?.first_name} {member?.last_name}
              </Text>
              <VerifiedBadge size={16} />
            </View>
            <Text style={{ fontSize: FONT_SIZE.small, color: colors.textMuted }}>
              {member?.party?.name} · {member?.electorate?.name} · {timeAgo(post.created_at)}
            </Text>
          </View>
          {/* Party accent dot */}
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: partyColor }} />
        </Pressable>

        {/* Post type badge */}
        {post.post_type !== 'update' && (
          <View style={{
            alignSelf: 'flex-start',
            backgroundColor: colors.greenBg,
            borderRadius: BORDER_RADIUS.sm,
            paddingHorizontal: SPACING.sm,
            paddingVertical: SPACING.xs,
            marginBottom: SPACING.md,
          }}>
            <Text style={{ fontSize: FONT_SIZE.caption, fontWeight: FONT_WEIGHT.semibold, color: colors.green, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              {post.post_type}
            </Text>
          </View>
        )}

        {/* Title */}
        {post.title && (
          <Text style={{
            fontSize: FONT_SIZE.title, fontWeight: FONT_WEIGHT.bold, color: colors.text,
            marginBottom: SPACING.md, lineHeight: 26,
          }}>
            {post.title}
          </Text>
        )}

        {/* Body */}
        <Text style={{
          fontSize: FONT_SIZE.body + 1, color: colors.text, lineHeight: 26,
          marginBottom: SPACING.xl,
        }}>
          {post.body}
        </Text>

        {/* Topic tag */}
        {post.topic && (
          <View style={{
            alignSelf: 'flex-start',
            backgroundColor: colors.surface,
            borderRadius: BORDER_RADIUS.sm,
            paddingHorizontal: SPACING.sm + 2,
            paddingVertical: SPACING.xs + 1,
            marginBottom: SPACING.xl,
          }}>
            <Text style={{ fontSize: FONT_SIZE.caption, fontWeight: FONT_WEIGHT.medium, color: colors.textMuted }}>
              {post.topic.charAt(0).toUpperCase() + post.topic.slice(1)}
            </Text>
          </View>
        )}

        {/* Divider */}
        <View style={{ height: 1, backgroundColor: colors.border, marginBottom: SPACING.lg, opacity: 0.5 }} />

        {/* Reactions */}
        <ReactionBar
          agreeCt={post.agree_count}
          disagreeCt={post.disagree_count}
          insightfulCt={post.insightful_count}
          myReaction={myReaction}
          onReact={handleReact}
        />
      </ScrollView>

      <AuthPromptSheet {...authSheetProps} />
    </SafeAreaView>
  );
}
