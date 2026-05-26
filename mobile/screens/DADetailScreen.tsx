import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, TextInput, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../context/ThemeContext';
import { useUser } from '../context/UserContext';
import { useDADetail } from '../hooks/useNearbyDAs';
import { useDACoalition } from '../hooks/useDACoalition';
import { useAuthGate } from '../hooks/useAuthGate';
import { AuthPromptSheet } from '../components/AuthPromptSheet';
import { supabase } from '../lib/supabase';
import { SPACING, FONT_SIZE, FONT_WEIGHT, BORDER_RADIUS, SHADOWS } from '../constants/design';

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  lodged:         { bg: '#EFF6FF', text: '#1D4ED8' },
  on_exhibition:  { bg: '#FEF3C7', text: '#92400E' },
  determined:     { bg: '#ECFDF5', text: '#065F46' },
  withdrawn:      { bg: '#FEF2F2', text: '#991B1B' },
};

export function DADetailScreen({ navigation, route }: any) {
  const { daId } = route.params;
  const { colors } = useTheme();
  const { user } = useUser();
  const { da, loading } = useDADetail(daId);
  const { coalition, isMember, messages, join, leave, sendMessage } = useDACoalition(daId);
  const { requireAuth, authSheetProps } = useAuthGate();
  const [messageText, setMessageText] = useState('');
  const [objectionLoading, setObjectionLoading] = useState(false);
  const [objectionText, setObjectionText] = useState<string | null>(null);

  if (loading || !da) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }} edges={['top']}>
        <Text style={{ color: colors.textMuted }}>Loading...</Text>
      </SafeAreaView>
    );
  }

  const statusStyle = STATUS_COLORS[da.status] || STATUS_COLORS.lodged;
  const canObject = da.status === 'on_exhibition' && da.exhibition_end;
  const daysLeft = canObject && da.exhibition_end
    ? Math.max(0, Math.ceil((new Date(da.exhibition_end).getTime() - Date.now()) / 86400000))
    : 0;

  const handleGenerateObjection = async () => {
    if (!user) { requireAuth('generate an objection letter', () => handleGenerateObjection()); return; }
    setObjectionLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-objection', {
        body: { daId: da.id, address: da.address, description: da.description, councilName: da.council?.name },
      });
      if (error || !data?.letter) {
        // Fallback: generate a template locally
        setObjectionText(generateLocalTemplate(da));
      } else {
        setObjectionText(data.letter);
      }
    } catch {
      setObjectionText(generateLocalTemplate(da));
    }
    setObjectionLoading(false);
  };

  const handleJoinCoalition = () => {
    if (!user) { requireAuth('join this coalition', () => { join(); }); return; }
    join();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleSendMessage = () => {
    if (!messageText.trim()) return;
    sendMessage(messageText.trim());
    setMessageText('');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

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
        <Text style={{ fontSize: FONT_SIZE.subtitle, fontWeight: FONT_WEIGHT.semibold, color: colors.text }}>
          {da.da_number}
        </Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: SPACING.lg, paddingBottom: SPACING.xxxl }} showsVerticalScrollIndicator={false}>
        {/* Status + type */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.md }}>
          <View style={{ backgroundColor: statusStyle.bg, borderRadius: BORDER_RADIUS.sm, paddingHorizontal: SPACING.sm + 2, paddingVertical: SPACING.xs }}>
            <Text style={{ fontSize: FONT_SIZE.caption, fontWeight: FONT_WEIGHT.bold, color: statusStyle.text, textTransform: 'uppercase' }}>
              {da.status.replace('_', ' ')}
            </Text>
          </View>
          <Text style={{ fontSize: FONT_SIZE.caption, color: colors.textMuted, textTransform: 'uppercase' }}>
            {da.da_type}
          </Text>
        </View>

        {/* Address */}
        <Text style={{ fontSize: FONT_SIZE.title + 2, fontWeight: FONT_WEIGHT.bold, color: colors.text, lineHeight: 28, marginBottom: SPACING.md }}>
          {da.address}
        </Text>

        {/* Description */}
        <Text style={{ fontSize: FONT_SIZE.body + 1, color: colors.textBody, lineHeight: 24, marginBottom: SPACING.xl }}>
          {da.description}
        </Text>

        {/* Stats grid */}
        <View style={{
          flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginBottom: SPACING.xl,
        }}>
          {da.estimated_cost && (
            <StatChip icon="cash-outline" label="Cost" value={`$${(da.estimated_cost / 1000000).toFixed(1)}M`} colors={colors} />
          )}
          {da.storeys && (
            <StatChip icon="layers-outline" label="Height" value={`${da.storeys} storeys`} colors={colors} />
          )}
          {da.dwellings != null && da.dwellings > 0 && (
            <StatChip icon="home-outline" label="Dwellings" value={String(da.dwellings)} colors={colors} />
          )}
          <StatChip icon="calendar-outline" label="Lodged" value={new Date(da.lodged_date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })} colors={colors} />
          {da.applicant && (
            <StatChip icon="person-outline" label="Applicant" value={da.applicant} colors={colors} />
          )}
          {da.council?.name && (
            <StatChip icon="business-outline" label="Council" value={da.council.name} colors={colors} />
          )}
        </View>

        {/* ═══ Exhibition deadline + AI Objection ═══ */}
        {canObject && (
          <View style={{
            backgroundColor: '#FEF3C7', borderRadius: BORDER_RADIUS.lg,
            padding: SPACING.lg, marginBottom: SPACING.xl,
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.sm }}>
              <Ionicons name="alert-circle" size={20} color="#92400E" />
              <Text style={{ fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.bold, color: '#92400E' }}>
                {daysLeft} days left to comment
              </Text>
            </View>
            <Text style={{ fontSize: FONT_SIZE.small, color: '#78350F', lineHeight: 20, marginBottom: SPACING.lg }}>
              Public exhibition closes {new Date(da.exhibition_end!).toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' })}. Submit your objection before then.
            </Text>

            <Pressable
              onPress={handleGenerateObjection}
              disabled={objectionLoading}
              accessibilityRole="button"
              accessibilityLabel="Generate AI objection letter"
              style={({ pressed }) => ({
                backgroundColor: '#92400E',
                borderRadius: BORDER_RADIUS.md,
                paddingVertical: SPACING.md,
                alignItems: 'center',
                opacity: pressed || objectionLoading ? 0.8 : 1,
              })}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.sm }}>
                <Ionicons name="sparkles" size={18} color="#ffffff" />
                <Text style={{ fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.bold, color: '#ffffff' }}>
                  {objectionLoading ? 'Generating...' : 'Generate AI Objection'}
                </Text>
              </View>
            </Pressable>
          </View>
        )}

        {/* Generated objection */}
        {objectionText && (
          <View style={{
            backgroundColor: colors.card, borderRadius: BORDER_RADIUS.lg,
            padding: SPACING.lg, marginBottom: SPACING.xl,
            borderLeftWidth: 4, borderLeftColor: colors.green,
            ...SHADOWS.sm,
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.md }}>
              <Ionicons name="document-text" size={18} color={colors.green} />
              <Text style={{ fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.bold, color: colors.text }}>
                Your Objection Letter
              </Text>
            </View>
            <Text style={{ fontSize: FONT_SIZE.body, color: colors.textBody, lineHeight: 24 }}>
              {objectionText}
            </Text>
            <Pressable
              onPress={() => {
                // Copy to clipboard or share
                Alert.alert('Objection Ready', 'Copy this letter and submit it to your council via their online portal.');
              }}
              style={({ pressed }) => ({
                backgroundColor: colors.green, borderRadius: BORDER_RADIUS.md,
                paddingVertical: SPACING.md, alignItems: 'center',
                marginTop: SPACING.lg, opacity: pressed ? 0.85 : 1,
              })}
            >
              <Text style={{ fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.bold, color: '#ffffff' }}>
                Copy & Submit to Council
              </Text>
            </Pressable>
          </View>
        )}

        {/* ═══ Action Coalition ═══ */}
        {coalition && (
          <View style={{
            backgroundColor: colors.card, borderRadius: BORDER_RADIUS.lg,
            padding: SPACING.lg, marginBottom: SPACING.xl,
            ...SHADOWS.sm,
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.sm }}>
              <View style={{ width: 32, height: 32, borderRadius: BORDER_RADIUS.sm, backgroundColor: '#EDE9FE', justifyContent: 'center', alignItems: 'center' }}>
                <Ionicons name="people" size={18} color="#7C3AED" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.bold, color: colors.text }}>
                  Neighbor Coalition
                </Text>
                <Text style={{ fontSize: FONT_SIZE.caption, color: colors.textMuted }}>
                  {coalition.member_count} neighbor{coalition.member_count !== 1 ? 's' : ''} joined
                </Text>
              </View>
            </View>

            {!isMember ? (
              <Pressable
                onPress={handleJoinCoalition}
                accessibilityRole="button"
                accessibilityLabel="Join neighbor coalition"
                style={({ pressed }) => ({
                  backgroundColor: '#7C3AED', borderRadius: BORDER_RADIUS.md,
                  paddingVertical: SPACING.md, alignItems: 'center',
                  marginTop: SPACING.sm, opacity: pressed ? 0.85 : 1,
                })}
              >
                <Text style={{ fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.bold, color: '#ffffff' }}>
                  Join Coalition
                </Text>
              </Pressable>
            ) : (
              <View style={{ marginTop: SPACING.md }}>
                {/* Messages */}
                {messages.length > 0 ? (
                  <View style={{ maxHeight: 200, marginBottom: SPACING.md }}>
                    {messages.slice(-5).map(msg => (
                      <View key={msg.id} style={{ marginBottom: SPACING.sm }}>
                        <Text style={{ fontSize: FONT_SIZE.small, color: colors.textBody, lineHeight: 18 }}>
                          {msg.body}
                        </Text>
                        <Text style={{ fontSize: 10, color: colors.textMuted, marginTop: 2 }}>
                          {new Date(msg.created_at).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })}
                        </Text>
                      </View>
                    ))}
                  </View>
                ) : (
                  <Text style={{ fontSize: FONT_SIZE.small, color: colors.textMuted, marginBottom: SPACING.md }}>
                    No messages yet. Start the conversation!
                  </Text>
                )}

                {/* Message input */}
                <View style={{ flexDirection: 'row', gap: SPACING.sm }}>
                  <TextInput
                    value={messageText}
                    onChangeText={setMessageText}
                    placeholder="Message your neighbors..."
                    placeholderTextColor={colors.textMuted}
                    style={{
                      flex: 1, backgroundColor: colors.surface, color: colors.text,
                      borderRadius: BORDER_RADIUS.md, paddingHorizontal: SPACING.md,
                      paddingVertical: SPACING.sm, fontSize: FONT_SIZE.body,
                    }}
                    multiline
                    maxLength={1000}
                  />
                  <Pressable
                    onPress={handleSendMessage}
                    disabled={!messageText.trim()}
                    style={({ pressed }) => ({
                      width: 44, height: 44, borderRadius: 22,
                      backgroundColor: messageText.trim() ? '#7C3AED' : colors.surface,
                      justifyContent: 'center', alignItems: 'center',
                      opacity: pressed ? 0.8 : 1,
                    })}
                  >
                    <Ionicons name="send" size={18} color={messageText.trim() ? '#ffffff' : colors.textMuted} />
                  </Pressable>
                </View>

                <Pressable onPress={leave} style={{ marginTop: SPACING.md, alignItems: 'center' }}>
                  <Text style={{ fontSize: FONT_SIZE.small, color: colors.textMuted }}>Leave coalition</Text>
                </Pressable>
              </View>
            )}
          </View>
        )}

        {/* View documents link */}
        {da.documents_url && (
          <Pressable
            onPress={() => {}} // Would use Linking.openURL
            accessibilityRole="link"
            accessibilityLabel="View full documents on council website"
            style={({ pressed }) => ({
              flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
              gap: SPACING.sm, paddingVertical: SPACING.lg,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Ionicons name="open-outline" size={16} color={colors.green} />
            <Text style={{ fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.semibold, color: colors.green }}>
              View full documents on council website
            </Text>
          </Pressable>
        )}
      </ScrollView>

      <AuthPromptSheet {...authSheetProps} />
    </SafeAreaView>
  );
}

function StatChip({ icon, label, value, colors }: { icon: string; label: string; value: string; colors: any }) {
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center', gap: SPACING.xs,
      backgroundColor: colors.surface, borderRadius: BORDER_RADIUS.sm,
      paddingHorizontal: SPACING.sm + 2, paddingVertical: SPACING.xs + 2,
    }}>
      <Ionicons name={icon as any} size={13} color={colors.textMuted} />
      <Text style={{ fontSize: FONT_SIZE.caption, color: colors.textMuted }}>{label}:</Text>
      <Text style={{ fontSize: FONT_SIZE.caption, fontWeight: FONT_WEIGHT.semibold, color: colors.text }}>{value}</Text>
    </View>
  );
}

// Fallback template when Edge Function is unavailable
function generateLocalTemplate(da: any): string {
  return `Dear ${da.council?.name || 'Council'},

I am writing to object to Development Application ${da.da_number} at ${da.address}.

${da.description ? `The proposed development (${da.description.toLowerCase()}) raises the following concerns:` : 'This development raises the following concerns:'}

1. TRAFFIC AND PARKING: The proposed development will significantly increase traffic in the area, which is already congested. Adequate parking provisions must be demonstrated.

2. OVERSHADOWING AND PRIVACY: The height and bulk of the development (${da.storeys ? da.storeys + ' storeys' : 'as proposed'}) will cause overshadowing of adjacent properties and reduce privacy for nearby residents.

3. NEIGHBOURHOOD CHARACTER: The scale of the proposed development is inconsistent with the existing residential character of the area.

4. INFRASTRUCTURE CAPACITY: Local infrastructure including schools, public transport, and stormwater systems may not have capacity to support the additional ${da.dwellings ? da.dwellings + ' dwellings' : 'residents'}.

I respectfully request that the Council give careful consideration to these concerns before making a determination.

Yours faithfully,
[Your name]
[Your address]`;
}
