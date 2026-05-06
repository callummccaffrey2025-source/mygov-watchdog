import React from 'react';
import { View, Text, ScrollView, Pressable, RefreshControl, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useUser } from '../context/UserContext';
import { useElectorateByPostcode } from '../hooks/useElectorateByPostcode';
import { useElectorateAnnouncements, LocalAnnouncement } from '../hooks/useLocalAnnouncements';
import { SkeletonLoader } from '../components/SkeletonLoader';
import { timeAgo } from '../lib/timeAgo';

const CATEGORY_ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  infrastructure: 'construct-outline',
  health: 'medkit-outline',
  education: 'school-outline',
  environment: 'leaf-outline',
  housing: 'home-outline',
  economy: 'cash-outline',
  community: 'people-outline',
};

function formatBudget(raw: string | null): string | null {
  if (!raw) return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000)     return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)         return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toLocaleString('en-AU')}`;
}

function AnnouncementCard({ item, colors }: { item: LocalAnnouncement; colors: any }) {
  const icon = CATEGORY_ICON[item.category ?? ''] ?? 'document-text-outline';
  const budget = formatBudget(item.budget_amount);
  const dateLabel = item.announced_at
    ? timeAgo(item.announced_at)
    : timeAgo(item.created_at);

  return (
    <View
      style={{
        backgroundColor: colors.card,
        borderRadius: 14,
        padding: 16,
        marginHorizontal: 16,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 3,
        elevation: 2,
      }}
    >
      <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: colors.greenBg,
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <Ionicons name={icon} size={20} color="#00843D" />
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', marginBottom: 6 }}>
            {budget && (
              <View style={{ backgroundColor: colors.greenBg, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 }}>
                <Text style={{ fontSize: 11, fontWeight: '800', color: '#00843D', letterSpacing: 0.3 }}>
                  {budget}
                </Text>
              </View>
            )}
            <Text style={{ fontSize: 11, color: colors.textMuted }}>{dateLabel}</Text>
            {item.category && (
              <Text style={{ fontSize: 11, color: colors.textMuted, textTransform: 'capitalize' }}>
                · {item.category}
              </Text>
            )}
          </View>
          <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text, lineHeight: 21 }}>
            {item.title}
          </Text>
          {item.body && (
            <Text
              style={{ fontSize: 13, color: colors.textBody, lineHeight: 19, marginTop: 6 }}
              numberOfLines={3}
            >
              {item.body}
            </Text>
          )}
          {item.member && (
            <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 8 }}>
              Announced by {item.member.first_name} {item.member.last_name}
              {item.member.party?.short_name ? ` (${item.member.party.short_name})` : ''}
            </Text>
          )}
        </View>
      </View>
      <Pressable
        onPress={() => Linking.openURL(item.source_url)}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 4,
          marginTop: 12,
          paddingTop: 10,
          borderTopWidth: 1,
          borderTopColor: colors.border,
        }}
        hitSlop={8}
        accessibilityLabel="View original source"
        accessibilityRole="button"
      >
        <Ionicons name="open-outline" size={13} color={colors.green} />
        <Text style={{ fontSize: 12, fontWeight: '600', color: colors.green }}>
          View original source
        </Text>
      </Pressable>
    </View>
  );
}

export function LocalAnnouncementsScreen({ navigation }: any) {
  const { colors } = useTheme();
  const { postcode } = useUser();
  const { electorate, loading: electorateLoading } = useElectorateByPostcode(postcode);
  const electorateId = electorate?.id ?? null;
  const { announcements, loading } = useElectorateAnnouncements(electorateId);
  const [refreshing, setRefreshing] = React.useState(false);

  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 400);
  }, []);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      {/* Header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 16,
          paddingVertical: 10,
          gap: 10,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
        <Pressable
          onPress={() => navigation.goBack()}
          hitSlop={8}
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: colors.cardAlt,
            justifyContent: 'center',
            alignItems: 'center',
          }}
          accessibilityLabel="Go back"
          accessibilityRole="button"
        >
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 17, fontWeight: '700', color: colors.text }}>Local Funding</Text>
          {electorate && (
            <Text style={{ fontSize: 12, color: colors.textMuted }}>
              {electorate.name} · {electorate.state}
            </Text>
          )}
        </View>
      </View>

      {/* Disclosure — matches DESIGN.md small-caption style */}
      <View
        style={{
          flexDirection: 'row',
          gap: 6,
          paddingHorizontal: 16,
          paddingVertical: 10,
          alignItems: 'flex-start',
        }}
      >
        <Ionicons name="shield-checkmark-outline" size={12} color={colors.textMuted} style={{ marginTop: 2 }} />
        <Text style={{ flex: 1, fontSize: 11, fontWeight: '500', color: colors.textMuted, lineHeight: 15 }}>
          Only federal funding announcements with a verified .gov.au source URL are shown. Tap "View original source" on any card to see the published announcement.
        </Text>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingTop: 8, paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#00843D" />}
      >
        {!postcode ? (
          <View style={{ alignItems: 'center', paddingVertical: 64, paddingHorizontal: 32, gap: 12 }}>
            <Ionicons name="location-outline" size={48} color={colors.textMuted} />
            <Text style={{ fontSize: 17, fontWeight: '600', color: colors.text, textAlign: 'center' }}>
              Add your postcode
            </Text>
            <Text style={{ fontSize: 15, color: colors.textBody, textAlign: 'center', lineHeight: 22 }}>
              Set your postcode on the home screen to see federal funding announcements for your electorate.
            </Text>
          </View>
        ) : electorateLoading || loading ? (
          <>
            {[1, 2, 3].map(i => (
              <SkeletonLoader key={i} height={140} borderRadius={14} style={{ marginHorizontal: 16, marginBottom: 12 }} />
            ))}
          </>
        ) : !electorate ? (
          <View style={{ alignItems: 'center', paddingVertical: 64, paddingHorizontal: 32, gap: 12 }}>
            <Ionicons name="map-outline" size={48} color={colors.textMuted} />
            <Text style={{ fontSize: 17, fontWeight: '600', color: colors.text, textAlign: 'center' }}>
              No electorate found
            </Text>
            <Text style={{ fontSize: 15, color: colors.textBody, textAlign: 'center', lineHeight: 22 }}>
              We couldn't match your postcode to a federal electorate. Check it on the home screen.
            </Text>
          </View>
        ) : announcements.length === 0 ? (
          <View style={{ alignItems: 'center', paddingVertical: 64, paddingHorizontal: 32, gap: 12 }}>
            <Ionicons name="cash-outline" size={48} color={colors.textMuted} />
            <Text style={{ fontSize: 17, fontWeight: '600', color: colors.text, textAlign: 'center' }}>
              Nothing to show yet
            </Text>
            <Text style={{ fontSize: 15, color: colors.textBody, textAlign: 'center', lineHeight: 22 }}>
              No federal funding announcements verified for {electorate.name} yet.
            </Text>
          </View>
        ) : (
          announcements.map(item => (
            <AnnouncementCard key={item.id} item={item} colors={colors} />
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
