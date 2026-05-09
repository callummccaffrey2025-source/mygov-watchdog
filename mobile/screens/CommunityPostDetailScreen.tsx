import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, TextInput,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '../lib/storage';
import { useUser } from '../context/UserContext';
import { useCommunityComments } from '../hooks/useCommunityPosts';
import { useCommunityVote } from '../hooks/useCommunityVote';
import { useTheme } from '../context/ThemeContext';
import { AuthPromptSheet } from '../components/AuthPromptSheet';
import { useAuthGate } from '../hooks/useAuthGate';
import { supabase } from '../lib/supabase';
import { timeAgo } from '../lib/timeAgo';
import { decodeHtml } from '../utils/decodeHtml';

const POST_TYPE_COLORS: Record<string, string> = {
  discussion: '#0066CC',
  question: '#7C3AED',
  issue: '#DC3545',
  event: '#D97706',
};

function VoteRow({ targetType, targetId, upvotes, downvotes, deviceId, userId }: {
  targetType: 'post' | 'comment';
  targetId: string;
  upvotes: number;
  downvotes: number;
  deviceId: string | null;
  userId: string | null | undefined;
}) {
  const { vote, toggle } = useCommunityVote(targetType, targetId, deviceId, userId);
  const score = upvotes - downvotes;
  return (
    <View style={voteRowStyles.row}>
      <Pressable onPress={() => toggle('up')} hitSlop={6} accessibilityLabel="Upvote" accessibilityRole="button">
        <Ionicons name={vote === 'up' ? 'arrow-up' : 'arrow-up-outline'} size={18} color={vote === 'up' ? '#00843D' : '#9aabb8'} />
      </Pressable>
      <Text style={voteRowStyles.score}>{score}</Text>
      <Pressable onPress={() => toggle('down')} hitSlop={6} accessibilityLabel="Downvote" accessibilityRole="button">
        <Ionicons name={vote === 'down' ? 'arrow-down' : 'arrow-down-outline'} size={18} color={vote === 'down' ? '#DC3545' : '#9aabb8'} />
      </Pressable>
    </View>
  );
}

const voteRowStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  score: { fontSize: 14, fontWeight: '600', color: '#5a6a7a' },
});

export function CommunityPostDetailScreen({ route, navigation }: any) {
  const { postId } = route.params;
  const { colors } = useTheme();
  const { user } = useUser();
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [post, setPost] = useState<any>(null);
  const [loadingPost, setLoadingPost] = useState(true);
  const [commentText, setCommentText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const { comments, loading: commentsLoading, refresh } = useCommunityComments(postId);
  const { requireAuth, authSheetProps } = useAuthGate();

  useEffect(() => {
    AsyncStorage.getItem('device_id').then(id => setDeviceId(id));
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase.from('community_posts').select('*').eq('id', postId).maybeSingle();
        setPost(data);
      } catch {
        // Network failure
      }
      setLoadingPost(false);
    })();
  }, [postId]);

  const handleSubmitComment = async () => {
    if (!commentText.trim() || commentText.trim().length < 2) return;
    if (!deviceId && !user?.id) return;
    setSubmitting(true);
    await supabase.from('community_comments').insert({
      post_id: postId,
      user_id: user?.id ?? null,
      device_id: deviceId,
      body: commentText.trim(),
    });
    // increment comment_count
    await supabase.from('community_posts').update({
      comment_count: (post?.comment_count ?? 0) + 1,
    }).eq('id', postId);
    setCommentText('');
    setSubmitting(false);
    refresh();
  };

  const handleReport = () => {
    Alert.alert('Report', 'Are you sure you want to report this post?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Report', style: 'destructive', onPress: async () => {
          await supabase.from('community_reports').insert({
            target_type: 'post', target_id: postId,
            user_id: user?.id ?? null, device_id: deviceId, reason: 'user_report',
          });
          Alert.alert('Reported', 'Thank you. We will review this post.');
        },
      },
    ]);
  };

  if (loadingPost) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
        <ActivityIndicator style={{ marginTop: 60 }} color="#00843D" />
      </SafeAreaView>
    );
  }

  const typeColor = POST_TYPE_COLORS[post?.post_type ?? ''] ?? '#9aabb8';

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
        {/* Nav */}
        <View style={[styles.navBar, { borderBottomColor: colors.border }]}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={8} accessibilityLabel="Go back" accessibilityRole="button">
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </Pressable>
          <Text style={[styles.navTitle, { color: colors.text }]}>Discussion</Text>
          <Pressable onPress={handleReport} hitSlop={8} accessibilityLabel="Report this post" accessibilityRole="button">
            <Ionicons name="flag-outline" size={20} color={colors.textMuted} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {/* Post */}
          {post && (
            <View style={styles.postSection}>
              <View style={styles.postTypeRow}>
                <View style={[styles.typePill, { backgroundColor: typeColor + '18' }]}>
                  <Text style={[styles.typePillText, { color: typeColor }]}>{post.post_type}</Text>
                </View>
                {post.topic && (
                  <View style={styles.topicChip}>
                    <Text style={styles.topicChipText}>{post.topic}</Text>
                  </View>
                )}
              </View>
              <Text style={[styles.postTitle, { color: colors.text }]}>{post.title}</Text>
              <Text style={[styles.postBody, { color: colors.textBody }]}>{decodeHtml(post.body)}</Text>
              <View style={styles.postFooter}>
                <VoteRow
                  targetType="post"
                  targetId={post.id}
                  upvotes={post.upvotes}
                  downvotes={post.downvotes}
                  deviceId={deviceId}
                  userId={user?.id}
                />
                <Text style={[styles.postTime, { color: colors.textMuted }]}>{timeAgo(post.created_at)}</Text>
              </View>
            </View>
          )}

          {/* Comments */}
          <View style={[styles.commentsDivider, { borderTopColor: colors.border }]}>
            <Text style={[styles.commentsLabel, { color: colors.textMuted }]}>
              {comments.length} comment{comments.length !== 1 ? 's' : ''}
            </Text>
          </View>

          {commentsLoading ? (
            <ActivityIndicator color="#00843D" style={{ marginTop: 20 }} />
          ) : (
            comments.map(comment => (
              <View key={comment.id} style={[styles.commentCard, { borderBottomColor: colors.border }]}>
                <Text style={[styles.commentBody, { color: colors.textBody }]}>{comment.body}</Text>
                <View style={styles.commentFooter}>
                  <VoteRow
                    targetType="comment"
                    targetId={comment.id}
                    upvotes={comment.upvotes}
                    downvotes={0}
                    deviceId={deviceId}
                    userId={user?.id}
                  />
                  <Text style={[styles.commentTime, { color: colors.textMuted }]}>{timeAgo(comment.created_at)}</Text>
                </View>
              </View>
            ))
          )}
          <View style={{ height: 80 }} />
        </ScrollView>

        {/* Comment input */}
        <View style={[styles.inputBar, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
          <TextInput
            style={[styles.commentInput, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
            placeholder="Add a comment..."
            placeholderTextColor={colors.textMuted}
            value={commentText}
            onChangeText={setCommentText}
            multiline
            maxLength={500}
            accessibilityLabel="Comment text field"
          />
          <Pressable
            style={[styles.sendBtn, (!commentText.trim() || submitting) && styles.sendBtnDisabled]}
            onPress={() => requireAuth('comment on this post', handleSubmitComment)}
            disabled={!commentText.trim() || submitting}
            accessibilityLabel="Send comment"
            accessibilityRole="button"
          >
            {submitting
              ? <ActivityIndicator color="#ffffff" size="small" />
              : <Ionicons name="send" size={20} color="#ffffff" />
            }
          </Pressable>
        </View>
        <AuthPromptSheet {...authSheetProps} />
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  navBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 },
  navTitle: { fontSize: 17, fontWeight: '700' },
  content: { paddingBottom: 20 },
  postSection: { padding: 16, paddingBottom: 12 },
  postTypeRow: { flexDirection: 'row', gap: 6, marginBottom: 8 },
  typePill: { borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  typePillText: { fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
  topicChip: { borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2, backgroundColor: '#00843D18' },
  topicChipText: { fontSize: 11, fontWeight: '600', color: '#00843D' },
  postTitle: { fontSize: 20, fontWeight: '800', marginBottom: 10, lineHeight: 26 },
  postBody: { fontSize: 15, lineHeight: 22, marginBottom: 12 },
  postFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  postTime: { fontSize: 13 },
  commentsDivider: { borderTopWidth: 1, paddingHorizontal: 16, paddingVertical: 10 },
  commentsLabel: { fontSize: 13, fontWeight: '600', textTransform: 'uppercase' },
  commentCard: { paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 },
  commentBody: { fontSize: 14, lineHeight: 20, marginBottom: 8 },
  commentFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  commentTime: { fontSize: 12 },
  inputBar: { flexDirection: 'row', alignItems: 'flex-end', padding: 10, gap: 8, borderTopWidth: 1 },
  commentInput: { flex: 1, borderRadius: 20, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, maxHeight: 100 },
  sendBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#00843D', justifyContent: 'center', alignItems: 'center' },
  sendBtnDisabled: { opacity: 0.4 },
});
