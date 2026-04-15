import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { OfficialPost } from '../hooks/useOfficialPosts';
import { timeAgo } from '../lib/timeAgo';
import { decodeHtml } from '../utils/decodeHtml';

export const POST_TYPE_CONFIG: Record<string, { bg: string; text: string; label: string }> = {
  update:       { bg: '#E8F0FE', text: '#0066CC', label: 'Update' },
  announcement: { bg: '#E8F5EE', text: '#00843D', label: 'Announcement' },
  opinion:      { bg: '#FFF7E6', text: '#B45309', label: 'Opinion' },
  event:        { bg: '#F3E8FF', text: '#7C3AED', label: 'Event' },
  policy:       { bg: '#E8F5F5', text: '#0F766E', label: 'Policy' },
};

interface Props {
  post: OfficialPost;
  onPress: () => void;
}

export function PostCard({ post, onPress }: Props) {
  const [expanded, setExpanded] = useState(false);
  const author = post.author;
  const partyColour = author?.party?.colour || '#9aabb8';
  const firstName = author?.first_name || '';
  const lastName = (author?.last_name || '').split(' ');
  const initials = (firstName[0] || '') + (lastName[lastName.length - 1]?.[0] || '');
  const displayName = author ? `${firstName} ${author.last_name}`.trim() : 'MP';
  const typeConfig = POST_TYPE_CONFIG[post.post_type] ?? POST_TYPE_CONFIG.update;

  return (
    <Pressable style={styles.card} onPress={onPress}>
      {/* Author row */}
      <View style={styles.authorRow}>
        <View style={[styles.avatar, { backgroundColor: partyColour + '22' }]}>
          <Text style={[styles.avatarText, { color: partyColour }]}>{initials.toUpperCase()}</Text>
        </View>
        <View style={styles.authorInfo}>
          <View style={styles.nameRow}>
            <Text style={styles.authorName} numberOfLines={1}>{displayName}</Text>
            <Ionicons name="checkmark-circle" size={14} color="#1D9BF0" />
            <View style={[styles.typeBadge, { backgroundColor: typeConfig.bg }]}>
              <Text style={[styles.typeText, { color: typeConfig.text }]}>{typeConfig.label}</Text>
            </View>
          </View>
          <Text style={styles.meta}>
            {author?.party?.short_name || author?.party?.abbreviation || ''}
            {' · '}
            {timeAgo(post.created_at)}
          </Text>
        </View>
      </View>

      {/* Content */}
      <Pressable onPress={() => setExpanded(e => !e)}>
        <Text style={styles.content} numberOfLines={expanded ? undefined : 3}>
          {decodeHtml(post.content)}
        </Text>
        {!expanded && post.content.length > 140 && (
          <Text style={styles.readMore}>Read more</Text>
        )}
      </Pressable>

      {/* Verified source link */}
      {post.media_urls && post.media_urls[0] && (
        <Pressable
          style={styles.sourceLink}
          onPress={() => Linking.openURL(post.media_urls![0]).catch(() => {})}
        >
          <Ionicons name="link-outline" size={13} color="#00843D" />
          <Text style={styles.sourceLinkText}>View source</Text>
          <Ionicons name="open-outline" size={12} color="#00843D" />
        </Pressable>
      )}

      {/* Bill reference */}
      {post.bill && (
        <View style={styles.billRef}>
          <Ionicons name="document-text-outline" size={13} color="#0066CC" />
          <Text style={styles.billRefText} numberOfLines={1}>
            {post.bill.short_title || post.bill.title}
          </Text>
        </View>
      )}

      {/* Footer */}
      <View style={styles.footer}>
        <View style={styles.footerLeft}>
          <View style={styles.footerBtn}>
            <Ionicons name="thumbs-up-outline" size={15} color="#9aabb8" />
            <Text style={styles.footerCount}>{post.likes_count}</Text>
          </View>
          <View style={styles.footerBtn}>
            <Ionicons name="thumbs-down-outline" size={15} color="#9aabb8" />
            <Text style={styles.footerCount}>{post.dislikes_count}</Text>
          </View>
          <View style={styles.footerBtn}>
            <Ionicons name="chatbubble-outline" size={14} color="#9aabb8" />
            <Text style={styles.footerCount}>{post.comments_count}</Text>
          </View>
        </View>
        <Ionicons name="arrow-forward-outline" size={15} color="#c4cdd5" />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.07,
    shadowRadius: 4,
    elevation: 2,
    gap: 10,
  },
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: {
    width: 40, height: 40, borderRadius: 20,
    justifyContent: 'center', alignItems: 'center', flexShrink: 0,
  },
  avatarText: { fontSize: 13, fontWeight: '700' },
  authorInfo: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 5, flexWrap: 'nowrap' },
  authorName: { fontSize: 14, fontWeight: '700', color: '#1a2332', flexShrink: 1 },
  typeBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6, flexShrink: 0 },
  typeText: { fontSize: 10, fontWeight: '700' },
  meta: { fontSize: 12, color: '#9aabb8', marginTop: 2 },
  content: { fontSize: 14, color: '#1a2332', lineHeight: 21 },
  readMore: { fontSize: 13, color: '#00843D', fontWeight: '600', marginTop: 2 },
  billRef: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#E8F0FE', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7,
  },
  billRefText: { flex: 1, fontSize: 12, color: '#0066CC', fontWeight: '500' },
  sourceLink: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    alignSelf: 'flex-start',
    backgroundColor: '#E8F5EE',
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 6,
  },
  sourceLinkText: { fontSize: 12, fontWeight: '700', color: '#00843D' },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  footerLeft: { flexDirection: 'row', gap: 16 },
  footerBtn: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  footerCount: { fontSize: 13, color: '#9aabb8' },
});
