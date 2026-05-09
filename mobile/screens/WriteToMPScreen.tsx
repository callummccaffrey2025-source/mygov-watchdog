import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Linking,
  Alert,
  Modal,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '../lib/storage';
import { useUser } from '../context/UserContext';
import { useTheme } from '../context/ThemeContext';
import { supabase } from '../lib/supabase';
import { Member } from '../hooks/useMembers';

export interface FromBill {
  title: string;
  vote: string;
  date: string | null;
}

const PRESET_SUBJECTS = [
  'Housing and affordability',
  'Healthcare and Medicare',
  'Climate and environment',
  'Cost of living',
  'Immigration',
  'Defence and security',
  'Education',
  'Indigenous affairs',
  'Infrastructure',
  'Other',
];

export function WriteToMPScreen({ route, navigation }: any) {
  const { member, fromBill }: { member: Member; fromBill?: FromBill } = route.params;
  const { colors } = useTheme();
  const { user } = useUser();
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const insertedIdRef = useRef<string | null>(null);

  useEffect(() => {
    AsyncStorage.getItem('device_id').then(id => setDeviceId(id));
  }, []);

  const displayName = `${member.first_name} ${member.last_name}`;
  const electorate = member.electorate?.name ?? 'your electorate';
  const partyColour = member.party?.colour || '#9aabb8';

  // Subject
  const billSubject = fromBill ? `Regarding your vote on "${fromBill.title}"` : null;
  const [subject, setSubject] = useState<string>(billSubject ?? PRESET_SUBJECTS[0]);
  const [customSubject, setCustomSubject] = useState('');
  const [showSubjectPicker, setShowSubjectPicker] = useState(false);

  const buildTemplate = (subj: string) => {
    let opening = '';
    if (fromBill) {
      const voteWord = fromBill.vote === 'aye' ? 'AYE' : fromBill.vote === 'no' ? 'NO' : 'did not record a vote';
      const dateStr = fromBill.date
        ? ` on ${new Date(fromBill.date).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })}`
        : '';
      opening = `I noticed you voted ${voteWord} on "${fromBill.title}"${dateStr}. I would like to understand your position on this matter.\n\n`;
    }
    const userRef = user?.email?.split('@')[0] ?? '';
    return `Dear ${displayName},\n\nAs a constituent of ${electorate}, I am writing to you regarding ${subj}.\n\n${opening}[Write your message here]\n\nI would appreciate hearing your response on this matter.\n\nRegards,\n${userRef}`;
  };

  const [body, setBody] = useState(() => buildTemplate(billSubject ?? PRESET_SUBJECTS[0]));
  const [emailSent, setEmailSent] = useState(false);
  const [sentiment, setSentiment] = useState<string | null>(null);

  const effectiveSubject = subject === 'Other' ? customSubject : subject;

  const handleSubjectSelect = (s: string) => {
    setSubject(s);
    setBody(buildTemplate(s === 'Other' ? customSubject : s));
    setShowSubjectPicker(false);
  };

  const handleSend = async () => {
    if (!member.email) {
      Alert.alert(
        'No email on record',
        `We don't have ${displayName}'s email address. Visit aph.gov.au to find their contact details.`,
      );
      return;
    }
    const mailto = `mailto:${member.email}?subject=${encodeURIComponent(effectiveSubject)}&body=${encodeURIComponent(body)}`;
    const canOpen = await Linking.canOpenURL(mailto).catch(() => false);
    if (!canOpen) {
      Alert.alert('No email app found', 'Please set up an email app on your device.');
      return;
    }
    await Linking.openURL(mailto);
    setEmailSent(true);

    // Log intent (not full message — privacy). Logging failure must not
    // affect the user flow — email has already been handed off to their mail app.
    try {
      const { data } = await supabase
        .from('mp_messages')
        .insert({
          user_id: user?.id ?? null,
          device_id: deviceId,
          member_id: member.id,
          subject: effectiveSubject,
          message_preview: body.slice(0, 100),
        })
        .select('id')
        .maybeSingle();
      if (data?.id) insertedIdRef.current = data.id;
    } catch {
      // Non-critical — email was still sent
    }
  };

  const handleSentiment = async (s: string) => {
    setSentiment(s);
    if (insertedIdRef.current) {
      try {
        await supabase
          .from('mp_messages')
          .update({ sentiment: s })
          .eq('id', insertedIdRef.current);
      } catch {
        // Non-critical — sentiment is analytics metadata
      }
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
        {/* Nav */}
        <View style={[styles.navBar, { borderBottomColor: colors.border }]}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={8} accessibilityRole="button" accessibilityLabel="Go back">
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </Pressable>
          <Text style={[styles.navTitle, { color: colors.text }]} numberOfLines={1}>
            Write to {member.first_name}
          </Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* MP mini-card */}
          <View style={[styles.mpCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.mpAvatar, { backgroundColor: partyColour + '22', borderColor: partyColour }]}>
              {member.photo_url ? (
                <Image source={{ uri: member.photo_url }} style={styles.mpPhoto} accessibilityLabel={`Photo of ${displayName}`} />
              ) : (
                <Text style={[styles.mpInitials, { color: partyColour }]}>
                  {member.first_name[0]}{member.last_name[0]}
                </Text>
              )}
            </View>
            <View style={styles.mpInfo}>
              <Text style={[styles.mpName, { color: colors.text }]}>{displayName}</Text>
              <Text style={[styles.mpSub, { color: colors.textBody }]}>
                {member.party?.short_name || member.party?.name || ''} · {electorate}
              </Text>
              {member.email ? (
                <Text style={[styles.mpEmail, { color: colors.textMuted }]}>{member.email}</Text>
              ) : (
                <Text style={styles.mpNoEmail}>⚠ No email on record</Text>
              )}
            </View>
          </View>

          {/* Subject */}
          <Text style={[styles.label, { color: colors.textMuted }]}>SUBJECT</Text>
          <Pressable
            style={[styles.subjectRow, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => setShowSubjectPicker(true)}
            accessibilityRole="button"
            accessibilityLabel="Select subject"
          >
            <Text style={[styles.subjectText, { color: colors.text }]} numberOfLines={1}>
              {subject}
            </Text>
            <Ionicons name="chevron-down" size={16} color={colors.textMuted} />
          </Pressable>
          {subject === 'Other' && (
            <TextInput
              style={[styles.customSubjectInput, {
                backgroundColor: colors.surface, color: colors.text, borderColor: colors.border,
              }]}
              placeholder="Enter subject..."
              placeholderTextColor={colors.textMuted}
              value={customSubject}
              onChangeText={setCustomSubject}
              maxLength={100}
              accessibilityLabel="Enter custom subject"
            />
          )}

          {/* Message body */}
          <Text style={[styles.label, { color: colors.textMuted }]}>MESSAGE</Text>
          <View style={styles.bodyWrapper}>
            <TextInput
              style={[styles.bodyInput, {
                backgroundColor: colors.surface, color: colors.text, borderColor: colors.border,
              }]}
              value={body}
              onChangeText={setBody}
              multiline
              maxLength={2000}
              textAlignVertical="top"
              scrollEnabled={false}
              accessibilityLabel="Message body"
            />
            <Text style={[styles.charCount, { color: colors.textMuted }]}>{body.length}/2000</Text>
          </View>

          {/* Info */}
          <View style={[styles.infoCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Ionicons name="information-circle-outline" size={16} color={colors.textMuted} />
            <Text style={[styles.infoText, { color: colors.textBody }]}>
              Tapping Send will open your email app with this message pre-addressed to {displayName}.
            </Text>
          </View>

          {/* Send button */}
          <Pressable
            style={[styles.sendBtn, !member.email && styles.sendBtnNoEmail]}
            onPress={handleSend}
            accessibilityRole="button"
            accessibilityLabel={member.email ? `Send email to ${displayName}` : 'No email address available'}
          >
            <Ionicons name="mail-outline" size={18} color="#ffffff" />
            <Text style={styles.sendBtnText}>
              {member.email ? `Send to ${displayName}` : 'No email address available'}
            </Text>
          </Pressable>

          {/* Post-send sentiment */}
          {emailSent && (
            <View style={[styles.sentimentCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Ionicons name="checkmark-circle" size={20} color="#00843D" />
              <Text style={[styles.sentimentTitle, { color: colors.text }]}>Email app opened!</Text>
              <Text style={[styles.sentimentSub, { color: colors.textBody }]}>
                What's your message about?
              </Text>
              <View style={styles.sentimentRow}>
                {([
                  { key: 'support', icon: 'thumbs-up', label: 'Support' },
                  { key: 'oppose', icon: 'thumbs-down', label: 'Oppose' },
                  { key: 'question', icon: 'help-circle-outline', label: 'Question' },
                ] as const).map(s => (
                  <Pressable
                    key={s.key}
                    style={[
                      styles.sentimentBtn,
                      {
                        borderColor: sentiment === s.key ? '#00843D' : colors.border,
                        backgroundColor: sentiment === s.key ? '#00843D18' : colors.background,
                      },
                    ]}
                    onPress={() => handleSentiment(s.key)}
                    accessibilityRole="button"
                    accessibilityLabel={s.label}
                  >
                    <Ionicons
                      name={s.icon as any}
                      size={22}
                      color={sentiment === s.key ? '#00843D' : colors.textMuted}
                    />
                    <Text style={[styles.sentimentLabel, { color: sentiment === s.key ? '#00843D' : colors.textBody }]}>
                      {s.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>

        {/* Subject picker modal */}
        <Modal visible={showSubjectPicker} animationType="slide" presentationStyle="pageSheet">
          <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
            <View style={[styles.navBar, { borderBottomColor: colors.border }]}>
              <View style={{ width: 24 }} />
              <Text style={[styles.navTitle, { color: colors.text }]}>Select Subject</Text>
              <Pressable onPress={() => setShowSubjectPicker(false)} hitSlop={8} accessibilityRole="button" accessibilityLabel="Close subject picker">
                <Ionicons name="close" size={24} color={colors.text} />
              </Pressable>
            </View>
            <ScrollView>
              {billSubject && (
                <Pressable
                  style={[styles.subjectOption, { borderBottomColor: colors.border }]}
                  onPress={() => handleSubjectSelect(billSubject)}
                  accessibilityRole="button"
                  accessibilityLabel={`Select subject: ${billSubject}`}
                >
                  <Text style={[styles.subjectOptionText, { color: '#00843D' }]} numberOfLines={2}>
                    {billSubject}
                  </Text>
                  {subject === billSubject && <Ionicons name="checkmark" size={18} color="#00843D" />}
                </Pressable>
              )}
              {PRESET_SUBJECTS.map(s => (
                <Pressable
                  key={s}
                  style={[styles.subjectOption, { borderBottomColor: colors.border }]}
                  onPress={() => handleSubjectSelect(s)}
                  accessibilityRole="button"
                  accessibilityLabel={`Select subject: ${s}`}
                >
                  <Text style={[styles.subjectOptionText, { color: colors.text }]}>{s}</Text>
                  {subject === s && <Ionicons name="checkmark" size={18} color="#00843D" />}
                </Pressable>
              ))}
            </ScrollView>
          </SafeAreaView>
        </Modal>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  navTitle: { fontSize: 17, fontWeight: '700', flex: 1, textAlign: 'center' },
  content: { padding: 16, paddingBottom: 40 },

  // MP card
  mpCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    marginBottom: 20,
  },
  mpAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  mpPhoto: { width: 48, height: 48, borderRadius: 24 },
  mpInitials: { fontSize: 16, fontWeight: '700' },
  mpInfo: { flex: 1 },
  mpName: { fontSize: 15, fontWeight: '700' },
  mpSub: { fontSize: 13, marginTop: 1 },
  mpEmail: { fontSize: 12, marginTop: 2 },
  mpNoEmail: { fontSize: 12, color: '#DC3545', marginTop: 2 },

  // Form
  label: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginBottom: 6,
    marginTop: 4,
    letterSpacing: 0.5,
  },
  subjectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 13,
    marginBottom: 12,
  },
  subjectText: { flex: 1, fontSize: 15 },
  customSubjectInput: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    marginBottom: 12,
  },
  bodyWrapper: { marginBottom: 14 },
  bodyInput: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    lineHeight: 20,
    minHeight: 200,
  },
  charCount: { fontSize: 12, textAlign: 'right', marginTop: 4 },

  // Info card
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
    marginBottom: 16,
  },
  infoText: { flex: 1, fontSize: 13, lineHeight: 18 },

  // Send button
  sendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#00843D',
    borderRadius: 12,
    paddingVertical: 15,
    marginBottom: 16,
  },
  sendBtnNoEmail: { backgroundColor: '#9aabb8' },
  sendBtnText: { fontSize: 16, fontWeight: '700', color: '#ffffff' },

  // Sentiment card
  sentimentCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    alignItems: 'center',
    gap: 8,
  },
  sentimentTitle: { fontSize: 16, fontWeight: '700' },
  sentimentSub: { fontSize: 14 },
  sentimentRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  sentimentBtn: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
    borderRadius: 10,
    borderWidth: 1.5,
    paddingVertical: 10,
  },
  sentimentLabel: { fontSize: 12, fontWeight: '600' },

  // Subject picker
  subjectOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  subjectOptionText: { flex: 1, fontSize: 16 },
});
