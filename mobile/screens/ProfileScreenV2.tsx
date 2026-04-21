import React, { useState, useCallback } from 'react';
import {
  View, Text, Pressable, ScrollView, Alert, ActivityIndicator,
  Modal, Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useUser } from '../context/UserContext';
import { useUserProfile } from '../hooks/useUserProfile';
import { SPACING, FONT_SIZE, FONT_WEIGHT, BORDER_RADIUS, SHADOWS } from '../constants/design';

// ── Picker options ──────────────────────────────────────────────────────
const HOUSING_OPTIONS = ['Owner', 'Renter', 'Shared housing', 'Living with family', 'Social housing', 'Prefer not to say'];
const AGE_OPTIONS = ['18-24', '25-34', '35-44', '45-54', '55-64', '65+', 'Prefer not to say'];
const INCOME_OPTIONS = ['Under $45k', '$45k-$90k', '$90k-$120k', '$120k-$180k', '$180k+', 'Prefer not to say'];
const HOUSEHOLD_OPTIONS = ['Single', 'Couple, no kids', 'Family with kids', 'Single parent', 'Shared household', 'Retired', 'Prefer not to say'];

const ALL_TOPICS = [
  'Economy', 'Health', 'Education', 'Environment', 'Housing',
  'Defence', 'Immigration', 'Indigenous Affairs', 'Technology',
  'Agriculture', 'Infrastructure', 'Foreign Policy', 'Justice',
  'Social Services',
];

interface FieldConfig {
  key: string;
  label: string;
  options: string[];
  whyWeAsk: string;
}

const DEMOGRAPHIC_FIELDS: FieldConfig[] = [
  {
    key: 'housing_status',
    label: 'Housing status',
    options: HOUSING_OPTIONS,
    whyWeAsk: 'Helps us surface bills and votes related to rent, property, or housing affordability that directly affect you.',
  },
  {
    key: 'age_bracket',
    label: 'Age bracket',
    options: AGE_OPTIONS,
    whyWeAsk: 'Different age groups are affected by different policies (superannuation, HECS, aged care). This helps us highlight what matters to you.',
  },
  {
    key: 'income_bracket',
    label: 'Income bracket',
    options: INCOME_OPTIONS,
    whyWeAsk: 'Lets us explain how tax changes, cost of living measures, and welfare policies affect your bracket specifically.',
  },
  {
    key: 'household_type',
    label: 'Household type',
    options: HOUSEHOLD_OPTIONS,
    whyWeAsk: 'Family, single, or retired households are impacted differently by childcare, pension, and welfare legislation.',
  },
];

export function ProfileScreenV2({ navigation }: any) {
  const { colors } = useTheme();
  const { user } = useUser();
  const { profile, loading, updateField, deleteAllData, exportData } = useUserProfile();

  const [pickerField, setPickerField] = useState<FieldConfig | null>(null);
  const [whyModalField, setWhyModalField] = useState<FieldConfig | null>(null);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handlePickOption = useCallback(async (field: string, value: string) => {
    setPickerField(null);
    const finalValue = value === 'Prefer not to say' ? null : value;
    await updateField(field, finalValue);
  }, [updateField]);

  const handleRemoveTopic = useCallback(async (topic: string) => {
    if (!profile) return;
    const next = profile.tracked_issues.filter(t => t !== topic);
    await updateField('tracked_issues', next);
  }, [profile, updateField]);

  const handleAddTopic = useCallback(async (topic: string) => {
    if (!profile) return;
    if (profile.tracked_issues.includes(topic)) return;
    const next = [...profile.tracked_issues, topic];
    await updateField('tracked_issues', next);
  }, [profile, updateField]);

  const handleExport = useCallback(async () => {
    setExporting(true);
    try {
      const json = await exportData();
      await Share.share({
        message: json,
        title: 'Verity data export',
      });
    } catch {
      Alert.alert('Export failed', 'Could not export your data. Please try again.');
    } finally {
      setExporting(false);
    }
  }, [exportData]);

  const handleDelete = useCallback(async () => {
    setDeleting(true);
    await deleteAllData();
    setDeleteModalVisible(false);
    setDeleting(false);
  }, [deleteAllData]);

  if (!user) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: SPACING.xxl }}>
          <Ionicons name="lock-closed-outline" size={48} color={colors.textMuted} />
          <Text style={{ fontSize: FONT_SIZE.subtitle, fontWeight: FONT_WEIGHT.semibold, color: colors.text, marginTop: SPACING.lg, textAlign: 'center' }}>
            Sign in to manage your profile
          </Text>
          <Pressable
            style={{ marginTop: SPACING.xl, backgroundColor: colors.green, borderRadius: BORDER_RADIUS.md, paddingHorizontal: SPACING.xxl, paddingVertical: SPACING.md }}
            onPress={() => navigation.navigate('Profile')}
          >
            <Text style={{ fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.bold, color: '#ffffff' }}>Sign in</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (loading || !profile) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={colors.green} />
        </View>
      </SafeAreaView>
    );
  }

  const availableTopics = ALL_TOPICS.filter(t => !profile.tracked_issues.includes(t));

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: SPACING.lg + 4, paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.lg }}>
          <Pressable onPress={() => navigation.goBack()} style={{ marginRight: SPACING.md }}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </Pressable>
          <Text style={{ fontSize: FONT_SIZE.title, fontWeight: FONT_WEIGHT.bold, color: colors.text, flex: 1 }}>Your data</Text>
        </View>

        {/* Privacy header */}
        <View style={{
          backgroundColor: colors.greenBg,
          borderRadius: BORDER_RADIUS.md,
          padding: SPACING.lg,
          marginBottom: SPACING.xl,
          flexDirection: 'row',
          gap: SPACING.md,
        }}>
          <Ionicons name="shield-checkmark-outline" size={22} color={colors.green} style={{ marginTop: 2 }} />
          <Text style={{ flex: 1, fontSize: FONT_SIZE.small, color: colors.textBody, lineHeight: 20 }}>
            Here's everything Verity knows about you. You can edit, export, or delete any of it, anytime.
          </Text>
        </View>

        {/* ── Profile section ──────────────────────────────────────────── */}
        <Text style={{ fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.bold, color: colors.text, marginBottom: SPACING.sm + 2 }}>
          Profile
        </Text>
        <View style={{
          backgroundColor: colors.surface,
          borderRadius: BORDER_RADIUS.md + 2,
          padding: SPACING.lg,
          marginBottom: SPACING.xl,
          ...SHADOWS.sm,
        }}>
          {/* Postcode row */}
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: SPACING.sm + 2 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: FONT_SIZE.small, color: colors.textMuted, fontWeight: FONT_WEIGHT.medium }}>Postcode</Text>
              <Text style={{ fontSize: FONT_SIZE.body, color: colors.text, fontWeight: FONT_WEIGHT.semibold, marginTop: 2 }}>
                {profile.postcode ?? 'Not set'}
              </Text>
            </View>
            <Pressable onPress={() => navigation.navigate('Profile')}>
              <Ionicons name="create-outline" size={20} color={colors.textMuted} />
            </Pressable>
          </View>

          {/* Electorate (read-only, derived) */}
          {profile.electorate && (
            <>
              <View style={{ height: 1, backgroundColor: colors.border, marginVertical: SPACING.sm }} />
              <View style={{ paddingVertical: SPACING.sm + 2 }}>
                <Text style={{ fontSize: FONT_SIZE.small, color: colors.textMuted, fontWeight: FONT_WEIGHT.medium }}>Electorate</Text>
                <Text style={{ fontSize: FONT_SIZE.body, color: colors.text, fontWeight: FONT_WEIGHT.semibold, marginTop: 2 }}>
                  {profile.electorate}
                </Text>
              </View>
            </>
          )}

          {/* Demographic fields */}
          {DEMOGRAPHIC_FIELDS.map((field, idx) => {
            const value = (profile as any)[field.key] as string | null;
            return (
              <View key={field.key}>
                <View style={{ height: 1, backgroundColor: colors.border, marginVertical: SPACING.sm }} />
                <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: SPACING.sm + 2 }}>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.xs }}>
                      <Text style={{ fontSize: FONT_SIZE.small, color: colors.textMuted, fontWeight: FONT_WEIGHT.medium }}>
                        {field.label}
                      </Text>
                      <Pressable onPress={() => setWhyModalField(field)} hitSlop={8}>
                        <Ionicons name="information-circle-outline" size={16} color={colors.textMuted} />
                      </Pressable>
                    </View>
                    <Text style={{ fontSize: FONT_SIZE.body, color: value ? colors.text : colors.textMuted, fontWeight: FONT_WEIGHT.semibold, marginTop: 2 }}>
                      {value ?? 'Not set'}
                    </Text>
                  </View>
                  <Pressable onPress={() => setPickerField(field)} hitSlop={8}>
                    <Ionicons name="create-outline" size={20} color={colors.textMuted} />
                  </Pressable>
                </View>
              </View>
            );
          })}
        </View>

        {/* ── Issues section ───────────────────────────────────────────── */}
        <Text style={{ fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.bold, color: colors.text, marginBottom: SPACING.sm + 2 }}>
          Tracked issues
        </Text>
        <View style={{
          backgroundColor: colors.surface,
          borderRadius: BORDER_RADIUS.md + 2,
          padding: SPACING.lg,
          marginBottom: SPACING.xl,
          ...SHADOWS.sm,
        }}>
          {profile.tracked_issues.length === 0 ? (
            <Text style={{ fontSize: FONT_SIZE.small, color: colors.textMuted }}>
              No issues tracked yet. Add some to personalise your feed.
            </Text>
          ) : (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm }}>
              {profile.tracked_issues.map(issue => (
                <View
                  key={issue}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: colors.greenBg,
                    borderRadius: BORDER_RADIUS.full,
                    paddingHorizontal: SPACING.md,
                    paddingVertical: SPACING.xs + 2,
                    gap: SPACING.xs,
                  }}
                >
                  <Text style={{ fontSize: FONT_SIZE.small, color: colors.green, fontWeight: FONT_WEIGHT.semibold }}>
                    {issue}
                  </Text>
                  <Pressable onPress={() => handleRemoveTopic(issue)} hitSlop={8}>
                    <Ionicons name="close-circle" size={18} color={colors.green} />
                  </Pressable>
                </View>
              ))}
            </View>
          )}

          {availableTopics.length > 0 && (
            <>
              <View style={{ height: 1, backgroundColor: colors.border, marginVertical: SPACING.md }} />
              <Text style={{ fontSize: FONT_SIZE.small, color: colors.textMuted, marginBottom: SPACING.sm }}>Add more</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm }}>
                {availableTopics.map(topic => (
                  <Pressable
                    key={topic}
                    onPress={() => handleAddTopic(topic)}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      backgroundColor: colors.cardAlt,
                      borderRadius: BORDER_RADIUS.full,
                      paddingHorizontal: SPACING.md,
                      paddingVertical: SPACING.xs + 2,
                      gap: SPACING.xs,
                    }}
                  >
                    <Ionicons name="add" size={16} color={colors.textBody} />
                    <Text style={{ fontSize: FONT_SIZE.small, color: colors.textBody, fontWeight: FONT_WEIGHT.medium }}>
                      {topic}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </>
          )}
        </View>

        {/* ── Follows section ──────────────────────────────────────────── */}
        <Pressable
          onPress={() => navigation.navigate('Profile')}
          style={{
            backgroundColor: colors.surface,
            borderRadius: BORDER_RADIUS.md + 2,
            padding: SPACING.lg,
            marginBottom: SPACING.xl,
            flexDirection: 'row',
            alignItems: 'center',
            ...SHADOWS.sm,
          }}
        >
          <Ionicons name="people-outline" size={20} color={colors.textBody} />
          <Text style={{ flex: 1, fontSize: FONT_SIZE.body, color: colors.text, fontWeight: FONT_WEIGHT.medium, marginLeft: SPACING.md }}>
            Followed MPs, parties, and bills
          </Text>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </Pressable>

        {/* ── Data actions ─────────────────────────────────────────────── */}
        <Text style={{ fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.bold, color: colors.text, marginBottom: SPACING.sm + 2 }}>
          Your data
        </Text>

        <Pressable
          onPress={handleExport}
          disabled={exporting}
          style={{
            backgroundColor: colors.surface,
            borderRadius: BORDER_RADIUS.md + 2,
            padding: SPACING.lg,
            marginBottom: SPACING.sm + 2,
            flexDirection: 'row',
            alignItems: 'center',
            opacity: exporting ? 0.6 : 1,
            ...SHADOWS.sm,
          }}
        >
          {exporting ? (
            <ActivityIndicator size="small" color={colors.green} />
          ) : (
            <Ionicons name="download-outline" size={20} color={colors.green} />
          )}
          <Text style={{ flex: 1, fontSize: FONT_SIZE.body, color: colors.text, fontWeight: FONT_WEIGHT.medium, marginLeft: SPACING.md }}>
            Download my data
          </Text>
          <Text style={{ fontSize: FONT_SIZE.small, color: colors.textMuted }}>JSON</Text>
        </Pressable>

        <Pressable
          onPress={() => setDeleteModalVisible(true)}
          style={{
            backgroundColor: colors.redBg,
            borderRadius: BORDER_RADIUS.md + 2,
            padding: SPACING.lg,
            marginBottom: SPACING.xxl,
            flexDirection: 'row',
            alignItems: 'center',
          }}
        >
          <Ionicons name="trash-outline" size={20} color={colors.red} />
          <Text style={{ flex: 1, fontSize: FONT_SIZE.body, color: colors.red, fontWeight: FONT_WEIGHT.semibold, marginLeft: SPACING.md }}>
            Delete my account
          </Text>
        </Pressable>
      </ScrollView>

      {/* ── Picker modal ───────────────────────────────────────────────── */}
      <Modal visible={!!pickerField} transparent animationType="slide" onRequestClose={() => setPickerField(null)}>
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }}
          onPress={() => setPickerField(null)}
        >
          <Pressable
            style={{
              backgroundColor: colors.surface,
              borderTopLeftRadius: BORDER_RADIUS.xl,
              borderTopRightRadius: BORDER_RADIUS.xl,
              padding: SPACING.xl,
              paddingBottom: SPACING.xxxl,
            }}
            onPress={() => {}}
          >
            <View style={{ alignItems: 'center', marginBottom: SPACING.lg }}>
              <View style={{ width: 36, height: 4, backgroundColor: colors.border, borderRadius: 2, marginBottom: SPACING.lg }} />
              <Text style={{ fontSize: FONT_SIZE.subtitle, fontWeight: FONT_WEIGHT.bold, color: colors.text }}>
                {pickerField?.label}
              </Text>
            </View>
            {pickerField?.options.map(option => (
              <Pressable
                key={option}
                onPress={() => handlePickOption(pickerField.key, option)}
                style={{
                  paddingVertical: SPACING.md + 2,
                  paddingHorizontal: SPACING.md,
                  borderRadius: BORDER_RADIUS.sm + 2,
                  backgroundColor: (profile as any)?.[pickerField.key] === option ? colors.greenBg : 'transparent',
                  marginBottom: SPACING.xs,
                }}
              >
                <Text style={{
                  fontSize: FONT_SIZE.body,
                  color: (profile as any)?.[pickerField.key] === option ? colors.green : colors.text,
                  fontWeight: (profile as any)?.[pickerField.key] === option ? FONT_WEIGHT.bold : FONT_WEIGHT.regular,
                }}>
                  {option}
                </Text>
              </Pressable>
            ))}
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── "Why we ask" modal ─────────────────────────────────────────── */}
      <Modal visible={!!whyModalField} transparent animationType="fade" onRequestClose={() => setWhyModalField(null)}>
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center', padding: SPACING.xxl }}
          onPress={() => setWhyModalField(null)}
        >
          <View style={{
            backgroundColor: colors.surface,
            borderRadius: BORDER_RADIUS.lg,
            padding: SPACING.xl,
            width: '100%',
            maxWidth: 340,
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.md }}>
              <Ionicons name="information-circle" size={22} color={colors.green} />
              <Text style={{ fontSize: FONT_SIZE.subtitle, fontWeight: FONT_WEIGHT.bold, color: colors.text }}>
                Why we ask
              </Text>
            </View>
            <Text style={{ fontSize: FONT_SIZE.body, color: colors.textBody, lineHeight: 22, marginBottom: SPACING.lg }}>
              {whyModalField?.whyWeAsk}
            </Text>
            <Text style={{ fontSize: FONT_SIZE.small, color: colors.textMuted, lineHeight: 18, marginBottom: SPACING.lg }}>
              This data never leaves Verity. It is only used to personalise what you see. You can remove it anytime.
            </Text>
            <Pressable
              onPress={() => setWhyModalField(null)}
              style={{
                backgroundColor: colors.green,
                borderRadius: BORDER_RADIUS.md,
                paddingVertical: SPACING.md,
                alignItems: 'center',
              }}
            >
              <Text style={{ fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.bold, color: '#ffffff' }}>Got it</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      {/* ── Delete confirmation modal ──────────────────────────────────── */}
      <Modal visible={deleteModalVisible} transparent animationType="fade" onRequestClose={() => setDeleteModalVisible(false)}>
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center', padding: SPACING.xxl }}
          onPress={() => setDeleteModalVisible(false)}
        >
          <View style={{
            backgroundColor: colors.surface,
            borderRadius: BORDER_RADIUS.lg,
            padding: SPACING.xl,
            width: '100%',
            maxWidth: 340,
          }}>
            <View style={{ alignItems: 'center', marginBottom: SPACING.lg }}>
              <View style={{
                width: 56, height: 56, borderRadius: 28,
                backgroundColor: colors.redBg,
                justifyContent: 'center', alignItems: 'center',
                marginBottom: SPACING.md,
              }}>
                <Ionicons name="warning-outline" size={28} color={colors.red} />
              </View>
              <Text style={{ fontSize: FONT_SIZE.subtitle, fontWeight: FONT_WEIGHT.bold, color: colors.text, textAlign: 'center' }}>
                Delete your account
              </Text>
            </View>
            <Text style={{ fontSize: FONT_SIZE.body, color: colors.textBody, lineHeight: 22, textAlign: 'center', marginBottom: SPACING.xl }}>
              This will permanently delete all your data including your profile, follows, saves, and activity history. This action cannot be undone.
            </Text>
            <Pressable
              onPress={handleDelete}
              disabled={deleting}
              style={{
                backgroundColor: colors.red,
                borderRadius: BORDER_RADIUS.md,
                paddingVertical: SPACING.md,
                alignItems: 'center',
                marginBottom: SPACING.sm,
                opacity: deleting ? 0.6 : 1,
              }}
            >
              {deleting ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Text style={{ fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.bold, color: '#ffffff' }}>Delete everything</Text>
              )}
            </Pressable>
            <Pressable
              onPress={() => setDeleteModalVisible(false)}
              style={{
                borderRadius: BORDER_RADIUS.md,
                paddingVertical: SPACING.md,
                alignItems: 'center',
              }}
            >
              <Text style={{ fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.semibold, color: colors.textBody }}>Cancel</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}
