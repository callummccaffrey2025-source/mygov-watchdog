import React, { useState } from 'react';
import {
  View, Text, Pressable, ScrollView, TextInput,
  Keyboard, Alert, Platform, InputAccessoryView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../context/ThemeContext';
import { useUser } from '../context/UserContext';
import { useMyRepresentatives, Representative, RepresentativeGroup } from '../hooks/useMyRepresentatives';
import { SkeletonLoader } from '../components/SkeletonLoader';
import { SPACING, FONT_SIZE, FONT_WEIGHT, BORDER_RADIUS, SHADOWS } from '../constants/design';

const LEVEL_CONFIG: Record<string, { color: string; bg: string; icon: string }> = {
  federal: { color: '#00843D', bg: '#E8F5EE', icon: 'flag' },
  state:   { color: '#2563EB', bg: '#EFF6FF', icon: 'business' },
  local:   { color: '#7C3AED', bg: '#F5F3FF', icon: 'home' },
};

function RepCard({
  rep,
  onPress,
  colors,
}: {
  rep: Representative;
  onPress: () => void;
  colors: any;
}) {
  const config = LEVEL_CONFIG[rep.level] || LEVEL_CONFIG.federal;
  const hasNav = !!rep.navScreen;

  return (
    <Pressable
      onPress={hasNav ? onPress : undefined}
      disabled={!hasNav}
      accessibilityRole={hasNav ? 'button' : 'text'}
      accessibilityLabel={`${rep.name}, ${rep.role}`}
      style={({ pressed }) => ({
        backgroundColor: colors.card,
        borderRadius: BORDER_RADIUS.lg,
        padding: SPACING.lg,
        marginBottom: SPACING.sm,
        opacity: pressed && hasNav ? 0.92 : 1,
        borderLeftWidth: 3,
        borderLeftColor: config.color,
        ...SHADOWS.sm,
      })}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.md }}>
        {/* Avatar */}
        <View style={{
          width: 44, height: 44, borderRadius: 22,
          backgroundColor: rep.partyColor || config.color,
          justifyContent: 'center', alignItems: 'center',
        }}>
          <Text style={{ fontSize: 14, fontWeight: FONT_WEIGHT.bold, color: '#fff' }}>
            {rep.name.split(' ').map(w => w[0]).join('').slice(0, 2)}
          </Text>
        </View>

        <View style={{ flex: 1 }}>
          <Text style={{
            fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.bold, color: colors.text,
          }} numberOfLines={1}>
            {rep.name}
          </Text>
          <Text style={{
            fontSize: FONT_SIZE.small, color: colors.textMuted, marginTop: 1,
          }} numberOfLines={1}>
            {rep.role}
          </Text>
          {rep.party ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, marginTop: 4 }}>
              <View style={{
                width: 8, height: 8, borderRadius: 4,
                backgroundColor: rep.partyColor || '#6B7280',
              }} />
              <Text style={{ fontSize: FONT_SIZE.caption, color: colors.textMuted }}>
                {rep.party}
              </Text>
            </View>
          ) : null}
        </View>

        {hasNav && <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />}
      </View>
    </Pressable>
  );
}

export function MyRepresentativesScreen({ navigation }: any) {
  const { colors } = useTheme();
  const { postcode, setPostcode } = useUser();
  const [postcodeInput, setPostcodeInput] = useState(postcode || '');
  const { groups, loading } = useMyRepresentatives(postcode);

  const handleSetPostcode = () => {
    Keyboard.dismiss();
    const trimmed = postcodeInput.trim();
    if (trimmed.length === 4 && /^\d{4}$/.test(trimmed)) {
      setPostcode(trimmed);
    } else {
      Alert.alert('Invalid postcode', 'Please enter a valid 4-digit Australian postcode.');
    }
  };

  const handleRepPress = (rep: Representative) => {
    if (rep.navScreen) {
      navigation.navigate(rep.navScreen, rep.navParams);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <LinearGradient
          colors={['#00843D', '#005C2B']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ paddingTop: SPACING.lg, paddingHorizontal: 20, paddingBottom: SPACING.xxl }}
        >
          <Pressable
            onPress={() => navigation.goBack()}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={{ marginBottom: SPACING.lg }}
          >
            <Ionicons name="arrow-back" size={22} color="#ffffff" />
          </Pressable>

          <Text style={{
            fontSize: FONT_SIZE.heading + 4, fontWeight: FONT_WEIGHT.bold,
            color: '#ffffff', marginBottom: SPACING.xs,
          }}>
            Who represents you
          </Text>
          <Text style={{
            fontSize: FONT_SIZE.body, color: 'rgba(255,255,255,0.7)',
            lineHeight: 22,
          }}>
            Every elected representative from your postcode — federal, state, and local.
          </Text>
        </LinearGradient>

        {/* Postcode input */}
        <View style={{ paddingHorizontal: 20, marginTop: -SPACING.lg }}>
          <View style={{
            backgroundColor: colors.card,
            borderRadius: BORDER_RADIUS.lg,
            padding: SPACING.lg,
            ...SHADOWS.md,
          }}>
            <Text style={{
              fontSize: FONT_SIZE.caption, fontWeight: FONT_WEIGHT.semibold,
              color: colors.textMuted, letterSpacing: 0.5, marginBottom: SPACING.sm,
            }}>
              ENTER YOUR POSTCODE
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.sm }}>
              <Ionicons name="location-outline" size={18} color={colors.green} />
              <TextInput
                style={{
                  flex: 1, height: 44, borderRadius: BORDER_RADIUS.md,
                  backgroundColor: colors.surface,
                  paddingHorizontal: 14,
                  fontSize: FONT_SIZE.body, color: colors.text,
                }}
                value={postcodeInput}
                onChangeText={setPostcodeInput}
                placeholder="e.g. 2000"
                placeholderTextColor="#9aabb8"
                keyboardType="number-pad"
                maxLength={4}
                returnKeyType="done"
                onSubmitEditing={handleSetPostcode}
                inputAccessoryViewID="reps-postcode-done"
              />
              {Platform.OS === 'ios' && (
                <InputAccessoryView nativeID="reps-postcode-done">
                  <View style={{ flexDirection: 'row', justifyContent: 'flex-end', backgroundColor: '#F1F1F1', paddingHorizontal: 16, paddingVertical: 8, borderTopWidth: 0.5, borderTopColor: '#C8C8C8' }}>
                    <Pressable onPress={() => { Keyboard.dismiss(); handleSetPostcode(); }} hitSlop={8}>
                      <Text style={{ fontSize: 17, fontWeight: '600', color: '#007AFF' }}>Done</Text>
                    </Pressable>
                  </View>
                </InputAccessoryView>
              )}
              <Pressable
                style={{
                  height: 44, paddingHorizontal: 20,
                  backgroundColor: colors.green,
                  borderRadius: BORDER_RADIUS.md,
                  justifyContent: 'center', alignItems: 'center',
                }}
                onPress={handleSetPostcode}
                accessibilityRole="button"
                accessibilityLabel="Find representatives"
              >
                <Text style={{ fontSize: 14, fontWeight: FONT_WEIGHT.bold, color: '#ffffff' }}>Find</Text>
              </Pressable>
            </View>
          </View>
        </View>

        {/* Results */}
        {loading ? (
          <View style={{ padding: 20, gap: SPACING.md }}>
            <SkeletonLoader height={100} borderRadius={BORDER_RADIUS.lg} />
            <SkeletonLoader height={100} borderRadius={BORDER_RADIUS.lg} />
            <SkeletonLoader height={100} borderRadius={BORDER_RADIUS.lg} />
          </View>
        ) : groups.length === 0 && postcode ? (
          <View style={{ padding: 20, alignItems: 'center', marginTop: SPACING.xxl }}>
            <Ionicons name="search-outline" size={48} color={colors.textMuted} />
            <Text style={{
              fontSize: FONT_SIZE.subtitle, fontWeight: FONT_WEIGHT.bold,
              color: colors.text, marginTop: SPACING.lg, textAlign: 'center',
            }}>
              No representatives found
            </Text>
            <Text style={{
              fontSize: FONT_SIZE.body, color: colors.textMuted,
              textAlign: 'center', marginTop: SPACING.sm, lineHeight: 22,
            }}>
              Try a different postcode. We're adding more coverage over time.
            </Text>
          </View>
        ) : (
          <View style={{ paddingHorizontal: 20, paddingTop: SPACING.xl, paddingBottom: SPACING.xxl }}>
            {groups.map((group) => {
              const config = LEVEL_CONFIG[group.level] || LEVEL_CONFIG.federal;
              return (
                <View key={group.level} style={{ marginBottom: SPACING.xl }}>
                  {/* Group header */}
                  <View style={{
                    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
                    marginBottom: SPACING.md,
                  }}>
                    <View style={{
                      width: 28, height: 28, borderRadius: 14,
                      backgroundColor: config.bg,
                      justifyContent: 'center', alignItems: 'center',
                    }}>
                      <Ionicons name={config.icon as any} size={14} color={config.color} />
                    </View>
                    <Text style={{
                      fontSize: FONT_SIZE.caption, fontWeight: FONT_WEIGHT.bold,
                      color: config.color, letterSpacing: 0.8, textTransform: 'uppercase',
                    }}>
                      {group.label}
                    </Text>
                    <View style={{
                      backgroundColor: config.bg, borderRadius: BORDER_RADIUS.sm,
                      paddingHorizontal: 6, paddingVertical: 2,
                    }}>
                      <Text style={{ fontSize: 10, fontWeight: FONT_WEIGHT.bold, color: config.color }}>
                        {group.representatives.length}
                      </Text>
                    </View>
                  </View>

                  {group.representatives.map((rep) => (
                    <RepCard
                      key={rep.id}
                      rep={rep}
                      onPress={() => handleRepPress(rep)}
                      colors={colors}
                    />
                  ))}
                </View>
              );
            })}
          </View>
        )}

        {/* Info footer */}
        {!loading && groups.length > 0 && (
          <View style={{
            marginHorizontal: 20, marginBottom: SPACING.xxl,
            padding: SPACING.lg,
            backgroundColor: colors.surface,
            borderRadius: BORDER_RADIUS.lg,
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.sm }}>
              <Ionicons name="information-circle-outline" size={16} color={colors.textMuted} />
              <Text style={{ fontSize: FONT_SIZE.caption, fontWeight: FONT_WEIGHT.semibold, color: colors.textMuted }}>
                About your representatives
              </Text>
            </View>
            <Text style={{ fontSize: FONT_SIZE.small, color: colors.textMuted, lineHeight: 18 }}>
              Federal MPs represent your electorate in the House of Representatives.
              Senators represent your state. State members serve in your state parliament.
              Your local council handles planning, roads, and community services.
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
