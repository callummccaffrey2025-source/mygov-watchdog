import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TextInput, Pressable, ScrollView,
  KeyboardAvoidingView, Platform, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useUser } from '../context/UserContext';
import { useTheme } from '../context/ThemeContext';
import { supabase } from '../lib/supabase';

const POST_TYPES = ['discussion', 'question', 'issue', 'event'] as const;
type PostType = typeof POST_TYPES[number];

const TOPICS = [
  'housing', 'healthcare', 'economy', 'climate', 'immigration',
  'defence', 'education', 'cost_of_living', 'indigenous', 'technology',
  'agriculture', 'infrastructure', 'foreign_policy', 'justice',
];

const POST_TYPE_COLORS: Record<string, string> = {
  discussion: '#0066CC',
  question: '#7C3AED',
  issue: '#DC3545',
  event: '#D97706',
};

export function CreateCommunityPostScreen({ route, navigation }: any) {
  const { electorate } = route.params ?? {};
  const { colors } = useTheme();
  const { user } = useUser();
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [postType, setPostType] = useState<PostType>('discussion');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [topic, setTopic] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem('device_id').then(id => setDeviceId(id));
  }, []);

  const canPost = title.trim().length > 0 && body.trim().length >= 10 && !!electorate;

  const handlePost = async () => {
    if (!canPost || submitting) return;
    setSubmitting(true);
    const { error } = await supabase.from('community_posts').insert({
      electorate,
      user_id: user?.id ?? null,
      device_id: deviceId,
      post_type: postType,
      title: title.trim(),
      body: body.trim(),
      topic: topic ?? null,
    });
    setSubmitting(false);
    if (error) {
      Alert.alert('Error', 'Could not post. Please try again.');
    } else {
      navigation.goBack();
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
        {/* Nav */}
        <View style={[styles.navBar, { borderBottomColor: colors.border }]}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={8}>
            <Text style={[styles.navCancel, { color: colors.textBody }]}>Cancel</Text>
          </Pressable>
          <Text style={[styles.navTitle, { color: colors.text }]}>New Post</Text>
          <Pressable
            style={[styles.postBtn, !canPost && styles.postBtnDisabled]}
            onPress={handlePost}
            disabled={!canPost || submitting}
          >
            {submitting
              ? <ActivityIndicator color="#ffffff" size="small" />
              : <Text style={styles.postBtnText}>Post</Text>
            }
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {/* Post type */}
          <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>TYPE</Text>
          <View style={styles.typeRow}>
            {POST_TYPES.map(t => {
              const c = POST_TYPE_COLORS[t];
              const active = postType === t;
              return (
                <Pressable
                  key={t}
                  style={[styles.typePill, { backgroundColor: active ? c : c + '18', borderColor: active ? c : 'transparent' }]}
                  onPress={() => setPostType(t)}
                >
                  <Text style={[styles.typePillText, { color: active ? '#fff' : c }]}>{t}</Text>
                </Pressable>
              );
            })}
          </View>

          {/* Title */}
          <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>TITLE *</Text>
          <View style={styles.inputWrapper}>
            <TextInput
              style={[styles.titleInput, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
              placeholder="What's this about?"
              placeholderTextColor={colors.textMuted}
              value={title}
              onChangeText={setTitle}
              maxLength={120}
            />
            <Text style={[styles.charCount, { color: colors.textMuted }]}>{title.length}/120</Text>
          </View>

          {/* Body */}
          <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>DETAILS *</Text>
          <View style={styles.inputWrapper}>
            <TextInput
              style={[styles.bodyInput, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
              placeholder="Share your thoughts, ask a question, or describe the issue..."
              placeholderTextColor={colors.textMuted}
              value={body}
              onChangeText={setBody}
              multiline
              maxLength={2000}
              textAlignVertical="top"
            />
            <Text style={[styles.charCount, { color: colors.textMuted }]}>{body.length}/2000</Text>
          </View>

          {/* Topic */}
          <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>TOPIC (optional)</Text>
          <View style={styles.topicGrid}>
            {TOPICS.map(t => {
              const active = topic === t;
              return (
                <Pressable
                  key={t}
                  style={[styles.topicChip, { backgroundColor: active ? '#00843D' : colors.surface, borderColor: active ? '#00843D' : colors.border }]}
                  onPress={() => setTopic(active ? null : t)}
                >
                  <Text style={[styles.topicChipText, { color: active ? '#fff' : colors.textBody }]}>
                    {t.replace('_', ' ')}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Guidelines */}
          <View style={[styles.guidelinesCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Ionicons name="shield-checkmark-outline" size={16} color={colors.textMuted} />
            <Text style={[styles.guidelinesText, { color: colors.textBody }]}>
              Be respectful. Discuss issues, not people. No spam or misinformation.
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  navBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 },
  navCancel: { fontSize: 16 },
  navTitle: { fontSize: 17, fontWeight: '700' },
  postBtn: { backgroundColor: '#00843D', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 7 },
  postBtnDisabled: { opacity: 0.4 },
  postBtnText: { color: '#ffffff', fontWeight: '700', fontSize: 14 },
  content: { padding: 16, paddingBottom: 40 },
  sectionLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', marginBottom: 8, marginTop: 16 },
  typeRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  typePill: { borderRadius: 6, paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1.5 },
  typePillText: { fontSize: 13, fontWeight: '700', textTransform: 'capitalize' },
  inputWrapper: { marginBottom: 4 },
  titleInput: { borderRadius: 10, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
  bodyInput: { borderRadius: 10, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, minHeight: 120 },
  charCount: { fontSize: 12, textAlign: 'right', marginTop: 4 },
  topicGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  topicChip: { borderRadius: 6, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1 },
  topicChipText: { fontSize: 13, fontWeight: '600', textTransform: 'capitalize' },
  guidelinesCard: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', borderRadius: 10, borderWidth: 1, padding: 12, marginTop: 20 },
  guidelinesText: { flex: 1, fontSize: 13, lineHeight: 18 },
});
