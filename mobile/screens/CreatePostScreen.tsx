import React, { useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, TextInput,
  ScrollView, Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useUser } from '../context/UserContext';
import { Member } from '../hooks/useMembers';

type PostType = 'update' | 'announcement' | 'opinion' | 'event' | 'policy';

const POST_TYPES: { value: PostType; label: string; icon: string }[] = [
  { value: 'update',       label: 'Update',       icon: 'megaphone-outline' },
  { value: 'announcement', label: 'Announcement', icon: 'notifications-outline' },
  { value: 'opinion',      label: 'Opinion',      icon: 'chatbubble-outline' },
  { value: 'event',        label: 'Event',        icon: 'calendar-outline' },
  { value: 'policy',       label: 'Policy',       icon: 'document-text-outline' },
];

const MAX_CHARS = 1000;

export function CreatePostScreen({ route, navigation }: any) {
  const { member, officialId }: { member: Member; officialId: string } = route.params;
  const { user } = useUser();

  const [content, setContent] = useState('');
  const [postType, setPostType] = useState<PostType>('update');
  const [submitting, setSubmitting] = useState(false);

  const remaining = MAX_CHARS - content.length;
  const canPost = content.trim().length > 0 && !submitting;

  const handlePost = async () => {
    if (!user || !canPost) return;
    setSubmitting(true);
    const { error } = await supabase.from('official_posts').insert({
      author_id: member.id,
      author_type: 'mp',
      content: content.trim(),
      post_type: postType,
    });
    setSubmitting(false);
    if (error) {
      Alert.alert('Error', 'Failed to post. Please try again.');
      return;
    }
    navigation.goBack();
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <Pressable style={styles.cancelBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
          <Text style={styles.headerTitle}>New Post</Text>
          <Pressable
            style={[styles.postBtn, !canPost && styles.postBtnDisabled]}
            onPress={handlePost}
            disabled={!canPost}
          >
            {submitting
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={styles.postBtnText}>Post</Text>
            }
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Author info */}
          <View style={styles.authorRow}>
            <View style={[styles.avatar, { backgroundColor: (member.party?.colour || '#9aabb8') + '22' }]}>
              <Text style={[styles.avatarText, { color: member.party?.colour || '#9aabb8' }]}>
                {(member.first_name[0] || '') + (member.last_name[0] || '')}
              </Text>
            </View>
            <View>
              <View style={styles.nameRow}>
                <Text style={styles.authorName}>{member.first_name} {member.last_name}</Text>
                <Ionicons name="checkmark-circle" size={16} color="#1D9BF0" />
              </View>
              <Text style={styles.authorMeta}>
                {member.party?.short_name || member.party?.name || ''}
                {member.electorate ? ` · ${member.electorate.name}` : ''}
              </Text>
            </View>
          </View>

          {/* Post type selector */}
          <Text style={styles.label}>Post type</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.typeRow}
          >
            {POST_TYPES.map(t => (
              <Pressable
                key={t.value}
                style={[styles.typeChip, postType === t.value && styles.typeChipActive]}
                onPress={() => setPostType(t.value)}
              >
                <Ionicons
                  name={t.icon as any}
                  size={14}
                  color={postType === t.value ? '#ffffff' : '#5a6a7a'}
                />
                <Text style={[styles.typeChipText, postType === t.value && styles.typeChipTextActive]}>
                  {t.label}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          {/* Content input */}
          <Text style={styles.label}>Content</Text>
          <TextInput
            style={styles.textInput}
            value={content}
            onChangeText={setContent}
            placeholder="Write your update for your constituents..."
            placeholderTextColor="#9aabb8"
            multiline
            maxLength={MAX_CHARS}
            textAlignVertical="top"
            autoFocus
          />
          <Text style={[styles.charCount, remaining < 100 && styles.charCountWarn]}>
            {remaining} characters remaining
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#ffffff' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#e8ecf0',
  },
  cancelBtn: { padding: 4 },
  cancelText: { fontSize: 16, color: '#5a6a7a' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#1a2332' },
  postBtn: { backgroundColor: '#00843D', borderRadius: 20, paddingHorizontal: 18, paddingVertical: 8 },
  postBtnDisabled: { backgroundColor: '#c4cdd5' },
  postBtnText: { color: '#ffffff', fontWeight: '700', fontSize: 15 },
  content: { padding: 20, gap: 12, paddingBottom: 40 },
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 4 },
  avatar: { width: 46, height: 46, borderRadius: 23, justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: 16, fontWeight: '700' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  authorName: { fontSize: 15, fontWeight: '700', color: '#1a2332' },
  authorMeta: { fontSize: 12, color: '#9aabb8', marginTop: 2 },
  label: { fontSize: 13, fontWeight: '600', color: '#5a6a7a', textTransform: 'uppercase' },
  typeRow: { gap: 8, paddingBottom: 4 },
  typeChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#f3f4f6', borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 8,
  },
  typeChipActive: { backgroundColor: '#00843D' },
  typeChipText: { fontSize: 13, fontWeight: '600', color: '#5a6a7a' },
  typeChipTextActive: { color: '#ffffff' },
  textInput: {
    backgroundColor: '#f8f9fa', borderRadius: 14, padding: 16,
    fontSize: 16, color: '#1a2332', lineHeight: 24,
    minHeight: 180, borderWidth: 1, borderColor: '#e8ecf0',
  },
  charCount: { fontSize: 12, color: '#9aabb8', textAlign: 'right' },
  charCountWarn: { color: '#B45309' },
});
