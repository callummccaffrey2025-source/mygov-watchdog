import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { useUser } from '../context/UserContext';
import { useTheme } from '../context/ThemeContext';

const TOPICS = [
  { id: 'economy',        label: 'Economy',           icon: '💰' },
  { id: 'healthcare',     label: 'Healthcare',         icon: '🏥' },
  { id: 'environment',    label: 'Environment',        icon: '🌿' },
  { id: 'education',      label: 'Education',          icon: '📚' },
  { id: 'defence',        label: 'Defence',            icon: '🛡️' },
  { id: 'immigration',    label: 'Immigration',        icon: '✈️' },
  { id: 'housing',        label: 'Housing',            icon: '🏠' },
  { id: 'welfare',        label: 'Welfare',            icon: '❤️' },
  { id: 'indigenous',     label: 'Indigenous Affairs', icon: '🪃' },
  { id: 'infrastructure', label: 'Infrastructure',     icon: '🚧' },
  { id: 'technology',     label: 'Technology',         icon: '💻' },
  { id: 'foreign_policy', label: 'Foreign Policy',     icon: '🌏' },
  { id: 'agriculture',    label: 'Agriculture',        icon: '🌾' },
  { id: 'justice',        label: 'Justice',            icon: '⚖️' },
];

export function ManageTopicsScreen({ navigation }: any) {
  const { colors } = useTheme();
  const { user } = useUser();
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const deviceId = await AsyncStorage.getItem('device_id');
        if (!deviceId && !user) { setLoading(false); return; }

        let query = supabase
          .from('user_preferences')
          .select('selected_topics');
        if (user) {
          query = query.eq('user_id', user.id);
        } else {
          query = (query as any).eq('device_id', deviceId!);
        }
        const { data } = await (query as any).maybeSingle();
        if (data?.selected_topics) {
          setSelectedTopics(data.selected_topics as string[]);
        }
      } catch {
        // non-critical
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user?.id]);

  const toggleTopic = (id: string) => {
    setSelectedTopics(prev =>
      prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id],
    );
  };

  const handleSave = async () => {
    if (selectedTopics.length < 2) {
      Alert.alert('Select at least 2', 'Please select at least 2 topics to continue.');
      return;
    }
    setSaving(true);
    try {
      const deviceId = await AsyncStorage.getItem('device_id');
      const conflictKey = user ? 'user_id' : 'device_id';
      await supabase.from('user_preferences').upsert(
        {
          user_id: user?.id ?? null,
          device_id: deviceId ?? null,
          selected_topics: selectedTopics,
        },
        { onConflict: conflictKey },
      );
      navigation.goBack();
    } catch {
      Alert.alert('Error', 'Could not save your topics. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={[styles.navBar, { borderBottomColor: colors.border }]}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12} accessibilityLabel="Go back" accessibilityRole="button">
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={[styles.navTitle, { color: colors.text }]}>Your Topics</Text>
        <Pressable onPress={handleSave} disabled={saving} hitSlop={12} accessibilityLabel="Save topics" accessibilityRole="button">
          {saving
            ? <ActivityIndicator size="small" color="#00843D" />
            : <Text style={styles.saveText}>Save</Text>
          }
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color="#00843D" />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <Text style={[styles.subtitle, { color: colors.textBody }]}>Select topics to personalise your Verity feed</Text>
          <View style={styles.topicsGrid}>
            {TOPICS.map(t => {
              const selected = selectedTopics.includes(t.id);
              return (
                <Pressable
                  key={t.id}
                  style={[styles.topicChip, { backgroundColor: colors.background, borderColor: colors.border }, selected && styles.topicChipSelected]}
                  onPress={() => toggleTopic(t.id)}
                  accessibilityLabel={`${selected ? 'Deselect' : 'Select'} ${t.label}`}
                  accessibilityRole="button"
                >
                  <Text style={styles.topicIcon}>{t.icon}</Text>
                  <Text style={[styles.topicLabel, { color: colors.textBody }, selected && styles.topicLabelSelected]}>
                    {t.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={[styles.hint, { color: colors.textMuted }]}>{selectedTopics.length} selected · minimum 2</Text>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#ffffff' },
  navBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#e8ecf0',
  },
  navTitle: { fontSize: 17, fontWeight: '700', color: '#1a2332' },
  saveText: { fontSize: 16, color: '#00843D', fontWeight: '700' },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scrollContent: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40, alignItems: 'center' },
  subtitle: { fontSize: 15, color: '#5a6a7a', textAlign: 'center', marginBottom: 20 },
  topicsGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center',
  },
  topicChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 22,
    borderWidth: 1.5, borderColor: '#e8ecf0', backgroundColor: '#ffffff',
  },
  topicChipSelected: { borderColor: '#00843D', backgroundColor: '#00843D0F' },
  topicIcon: { fontSize: 16 },
  topicLabel: { fontSize: 14, color: '#5a6a7a', fontWeight: '500' },
  topicLabelSelected: { color: '#00843D', fontWeight: '700' },
  hint: { fontSize: 13, color: '#9aabb8', marginTop: 20 },
});
