import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { NewsStory } from '../hooks/useNewsStories';
import { useTheme } from '../context/ThemeContext';
import { topicBg, topicText } from '../constants/topicColors';
import { timeAgo } from '../lib/timeAgo';

function stripMarkdown(s: string | null | undefined): string {
  if (!s) return '';
  return s.replace(/^#+\s*/, '').trim();
}

interface Props {
  story: NewsStory;
  onPress: () => void;
}

export function EnhancedStoryCard({ story, onPress }: Props) {
  const { colors } = useTheme();
  const total = story.left_count + story.center_count + story.right_count;

  // Blindspot detection
  const blindspot =
    story.blindspot ??
    (story.article_count >= 3
      ? story.left_count === 0 && story.right_count > 0 ? 'left'
      : story.right_count === 0 && story.left_count > 0 ? 'right'
      : story.center_count === 0 && story.left_count + story.right_count > 0 ? 'centre'
      : null
      : null);

  return (
    <Pressable
      style={({ pressed }) => ({
        backgroundColor: colors.card, borderRadius: 14, padding: 16, marginBottom: 12,
        shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06,
        shadowRadius: 4, elevation: 2, opacity: pressed ? 0.92 : 1,
      })}
      onPress={onPress}
      accessibilityLabel={`Read story: ${stripMarkdown(story.headline)}`}
      accessibilityRole="button"
    >
      {/* Top: category + time */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <View style={{ backgroundColor: topicBg(story.category), paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 }}>
          <Text style={{ fontSize: 10, fontWeight: '700', color: topicText(story.category), letterSpacing: 0.4 }}>
            {(story.category ?? 'politics').toUpperCase()}
          </Text>
        </View>
        <Text style={{ fontSize: 12, color: '#9CA3AF' }}>{timeAgo(story.first_seen)}</Text>
      </View>

      {/* AI neutral headline + thumbnail */}
      <View style={{ flexDirection: 'row', gap: 12, marginBottom: 12 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text, lineHeight: 22, marginBottom: 4 }} numberOfLines={3}>
            {stripMarkdown(story.headline)}
          </Text>
          {story.ai_summary && (
            <Text style={{ fontSize: 13, color: colors.textBody, lineHeight: 18, fontStyle: 'italic' }} numberOfLines={2}>
              {stripMarkdown(story.ai_summary)}
            </Text>
          )}
        </View>
        {story.image_url && (
          <ExpoImage
            source={{ uri: story.image_url }}
            style={{ width: 72, height: 72, borderRadius: 10, backgroundColor: '#F3F4F6' }}
          />
        )}
      </View>

      {/* Outlet count */}
      <Text style={{ fontSize: 12, fontWeight: '600', color: '#6B7280', marginBottom: 6 }}>
        {story.article_count} outlet{story.article_count !== 1 ? 's' : ''} covered this story
      </Text>

      {/* Proportional coverage bar */}
      {total > 0 && (
        <View style={{ flexDirection: 'row', height: 6, borderRadius: 3, overflow: 'hidden', backgroundColor: '#E5E7EB', marginBottom: 8 }}>
          {story.left_count > 0 && (
            <View style={{ flex: story.left_count, backgroundColor: '#2563EB' }} />
          )}
          {story.center_count > 0 && (
            <View style={{ flex: story.center_count, backgroundColor: '#8B5CF6' }} />
          )}
          {story.right_count > 0 && (
            <View style={{ flex: story.right_count, backgroundColor: '#DC2626' }} />
          )}
        </View>
      )}

      {/* Coverage breakdown numbers */}
      <View style={{ flexDirection: 'row', gap: 12, marginBottom: blindspot ? 10 : 0 }}>
        {story.left_count > 0 && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#2563EB' }} />
            <Text style={{ fontSize: 11, color: '#6B7280' }}>L · {story.left_count}</Text>
          </View>
        )}
        {story.center_count > 0 && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#8B5CF6' }} />
            <Text style={{ fontSize: 11, color: '#6B7280' }}>C · {story.center_count}</Text>
          </View>
        )}
        {story.right_count > 0 && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#DC2626' }} />
            <Text style={{ fontSize: 11, color: '#6B7280' }}>R · {story.right_count}</Text>
          </View>
        )}
      </View>

      {/* Blindspot tag */}
      {blindspot && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FEF3C7', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 10 }}>
          <Ionicons name="warning-outline" size={14} color="#D97706" />
          <Text style={{ flex: 1, fontSize: 12, color: '#92400E', fontWeight: '600' }}>
            Blindspot: Not covered by any {blindspot === 'centre' ? 'centre' : blindspot + '-leaning'} outlets
          </Text>
        </View>
      )}
    </Pressable>
  );
}
