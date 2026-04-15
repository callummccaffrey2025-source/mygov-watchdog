import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Pressable,
  TextInput, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { OfficialPost } from '../hooks/useOfficialPosts';
import { POST_TYPE_CONFIG } from '../components/PostCard';
import { StatusBadge } from '../components/StatusBadge';
import { SkeletonLoader } from '../components/SkeletonLoader';
import { timeAgo } from '../lib/timeAgo';
import { supabase } from '../lib/supabase';
import { useUser } from '../context/UserContext';
import { useTheme } from '../context/ThemeContext';
import { decodeHtml } from '../utils/decodeHtml';

interface Comment {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
}

export function PostDetailScreen({ route, navigation }: any) {
  const { colors } = useTheme();
  const { post }: { post: OfficialPost } = route.params;
  const { user } = useUser();
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(true);
  const [commentText, setCommentText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const author = post.author;
  const partyColour = author?.party?.colour || '#9aabb8';
  const firstName = author?.first_name || '';
  const lastParts = (author?.last_name || '').split(' ');
  const initials = ((firstName[0] || '') + (lastParts[lastParts.length - 1]?.[0] || '')).toUpperCase();
  const displayName = author ? `${firstName} ${author.last_name}`.trim() : 'MP';
  const typeConfig = POST_TYPE_CONFIG[post.post_type] ?? POST_TYPE_CONFIG.update;

  useEffect(() => {
    supabase
      .from('post_comments')
      .select('*')
      .eq('post_id', post.id)
      .order('created_at', { ascending: true })
      .then(({ data }) => {
        setComments(data || []);
        setCommentsLoading(false);
      });
  }, [post.id]);

  const submitComment = async () => {
    if (!commentText.trim() || !user) return;
    setSubmitting(true);
    const { data } = await supabase
      .from('post_comments')
      .insert({ post_id: post.id, user_id: user.id, content: commentText.trim() })
      .select()
      .single();
    if (data) setComments(c => [...c, data as Comment]);
    setCommentText('');
    setSubmitting(false);
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <Pressable style={styles.back} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </Pressable>

          <View style={styles.content}>
            {/* Author card */}
            <View style={[styles.authorCard, { backgroundColor: colors.surface }]}>
              <View style={[styles.avatar, { backgroundColor: partyColour + '22' }]}>
                <Text style={[styles.avatarText, { color: partyColour }]}>{initials}</Text>
              </View>
              <View style={styles.authorInfo}>
                <View style={styles.nameRow}>
                  <Text style={[styles.authorName, { color: colors.text }]}>{displayName}</Text>
                  <Ionicons name="checkmark-circle" size={16} color="#1D9BF0" />
                </View>
                <Text style={[styles.authorMeta, { color: colors.textMuted }]}>
                  {author?.party?.short_name || author?.party?.name || ''}
                  {' · '}
                  {timeAgo(post.created_at)}
                </Text>
              </View>
              <View style={[styles.typeBadge, { backgroundColor: typeConfig.bg }]}>
                <Text style={[styles.typeText, { color: typeConfig.text }]}>{typeConfig.label}</Text>
              </View>
            </View>

            {/* Full content */}
            <Text style={[styles.postContent, { color: colors.text }]}>{decodeHtml(post.content)}</Text>

            {/* Linked bill */}
            {post.bill && (
              <Pressable
                style={[styles.billCard, { backgroundColor: colors.surface }]}
                onPress={() => navigation.navigate('BillDetail', { bill: post.bill })}
              >
                <Ionicons name="document-text" size={18} color="#0066CC" />
                <View style={{ flex: 1, gap: 6 }}>
                  <Text style={[styles.billTitle, { color: colors.text }]} numberOfLines={2}>
                    {post.bill.short_title || post.bill.title}
                  </Text>
                  <StatusBadge status={post.bill.current_status} />
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
              </Pressable>
            )}

            {/* Reactions */}
            <View style={styles.reactions}>
              <View style={[styles.reactionBtn, { backgroundColor: colors.cardAlt }]}>
                <Ionicons name="thumbs-up-outline" size={20} color={colors.textMuted} />
                <Text style={[styles.reactionCount, { color: colors.text }]}>{post.likes_count}</Text>
              </View>
              <View style={[styles.reactionBtn, { backgroundColor: colors.cardAlt }]}>
                <Ionicons name="thumbs-down-outline" size={20} color={colors.textMuted} />
                <Text style={[styles.reactionCount, { color: colors.text }]}>{post.dislikes_count}</Text>
              </View>
            </View>

            <View style={[styles.divider, { backgroundColor: colors.border }]} />

            {/* Comments */}
            <Text style={[styles.commentsTitle, { color: colors.text }]}>Comments ({comments.length})</Text>
            {commentsLoading
              ? [1, 2].map(i => <SkeletonLoader key={i} height={60} borderRadius={12} style={{ marginBottom: 8 }} />)
              : comments.length === 0
                ? <Text style={[styles.noComments, { color: colors.textMuted }]}>No comments yet. Be the first!</Text>
                : comments.map(c => (
                  <View key={c.id} style={[styles.commentBubble, { backgroundColor: colors.cardAlt }]}>
                    <Text style={[styles.commentContent, { color: colors.text }]}>{c.content}</Text>
                    <Text style={[styles.commentTime, { color: colors.textMuted }]}>{timeAgo(c.created_at)}</Text>
                  </View>
                ))
            }
          </View>
        </ScrollView>

        {/* Comment input */}
        <View style={[styles.commentBar, { backgroundColor: colors.background, borderTopColor: colors.border }]}>
          <TextInput
            style={[styles.commentInput, { backgroundColor: colors.cardAlt, color: colors.text }]}
            placeholder={user ? 'Add a comment...' : 'Sign in to comment'}
            placeholderTextColor={colors.textMuted}
            value={commentText}
            onChangeText={setCommentText}
            editable={!!user}
            multiline
            maxLength={500}
          />
          <Pressable
            style={[styles.sendBtn, (!commentText.trim() || !user || submitting) && styles.sendBtnOff]}
            onPress={submitComment}
            disabled={!commentText.trim() || !user || submitting}
          >
            <Ionicons name="send" size={18} color="#ffffff" />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#ffffff' },
  back: { padding: 20, paddingBottom: 0 },
  content: { padding: 20, gap: 16, paddingBottom: 40 },
  authorCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#F9FAFB', borderRadius: 14, padding: 14,
  },
  avatar: { width: 46, height: 46, borderRadius: 23, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  avatarText: { fontSize: 16, fontWeight: '700' },
  authorInfo: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  authorName: { fontSize: 15, fontWeight: '700', color: '#1a2332' },
  authorMeta: { fontSize: 12, color: '#9aabb8', marginTop: 2 },
  typeBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  typeText: { fontSize: 11, fontWeight: '700' },
  postContent: { fontSize: 16, color: '#1a2332', lineHeight: 26 },
  billCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#F0F6FF', borderRadius: 12, padding: 14,
  },
  billTitle: { fontSize: 13, color: '#1a2332', fontWeight: '500', lineHeight: 18 },
  reactions: { flexDirection: 'row', gap: 12 },
  reactionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#F3F4F6', borderRadius: 20, paddingHorizontal: 18, paddingVertical: 10,
  },
  reactionCount: { fontSize: 14, color: '#1a2332', fontWeight: '600' },
  divider: { height: 1, backgroundColor: '#e8ecf0' },
  commentsTitle: { fontSize: 16, fontWeight: '700', color: '#1a2332' },
  noComments: { fontSize: 14, color: '#9aabb8', textAlign: 'center', paddingVertical: 20 },
  commentBubble: { backgroundColor: '#F3F4F6', borderRadius: 12, padding: 12, gap: 4, marginBottom: 8 },
  commentContent: { fontSize: 14, color: '#1a2332', lineHeight: 20 },
  commentTime: { fontSize: 11, color: '#9aabb8' },
  commentBar: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 10,
    padding: 14, borderTopWidth: 1, borderTopColor: '#e8ecf0', backgroundColor: '#ffffff',
  },
  commentInput: {
    flex: 1, backgroundColor: '#F3F4F6', borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: '#1a2332', maxHeight: 100,
  },
  sendBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#00843D', justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  sendBtnOff: { backgroundColor: '#c4cdd5' },
});
