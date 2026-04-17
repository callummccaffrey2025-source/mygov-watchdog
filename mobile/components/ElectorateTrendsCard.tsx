import React from 'react';
import { View, Text, Pressable, Share } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ElectorateTrends } from '../hooks/useElectorateTrends';
import { useTheme } from '../context/ThemeContext';

interface Props {
  electorate: string;
  trends: ElectorateTrends;
  onBillTap?: (billId: string) => void;
}

export function ElectorateTrendsCard({ electorate, trends, onBillTap }: Props) {
  const { colors } = useTheme();

  const handleShare = () => {
    Share.share({
      message: `I'm tracking Australian politics in ${electorate} with Verity. Join me so we can see what our local community cares about.\n\nverity.run`,
    });
  };

  // ── Empty state: not enough data ─────────────────────────────────────────

  if (!trends.hasEnoughData) {
    return (
      <View style={{ marginHorizontal: 20, marginBottom: 24, backgroundColor: colors.card, borderRadius: 14, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2, borderLeftWidth: 4, borderLeftColor: '#00843D' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <Ionicons name="location-outline" size={18} color="#00843D" />
          <Text style={{ fontSize: 11, fontWeight: '700', color: '#00843D', letterSpacing: 0.8 }}>YOUR ELECTORATE</Text>
        </View>

        <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text, lineHeight: 22, marginBottom: 4 }}>
          Be one of the first in {electorate} to use Verity
        </Text>
        <Text style={{ fontSize: 14, color: '#6B7280', lineHeight: 20, marginBottom: 14 }}>
          Share with your neighbours to unlock local trends — most-discussed topics, most-viewed bills, and community sentiment in your area.
        </Text>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <Ionicons name="people-outline" size={14} color="#9CA3AF" />
          <Text style={{ fontSize: 12, color: '#9CA3AF' }}>
            {trends.activeUsers} {trends.activeUsers === 1 ? 'person' : 'people'} in {electorate} this week
          </Text>
        </View>

        <Pressable
          style={{ backgroundColor: '#00843D', borderRadius: 10, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}
          onPress={handleShare}
        >
          <Ionicons name="share-outline" size={16} color="#fff" />
          <Text style={{ fontSize: 14, fontWeight: '600', color: '#fff' }}>Share Verity with your electorate</Text>
        </Pressable>
      </View>
    );
  }

  // ── Full trends card ─────────────────────────────────────────────────────

  const hasAnyContent = trends.mostDiscussedTopic || trends.mostDiscussedPostTitle || trends.mostViewedBillTitle;

  return (
    <View style={{ marginHorizontal: 20, marginBottom: 24, backgroundColor: colors.card, borderRadius: 14, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: '#FEF3C7', justifyContent: 'center', alignItems: 'center' }}>
          <Ionicons name="flame-outline" size={14} color="#D97706" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 11, fontWeight: '700', color: '#D97706', letterSpacing: 0.8 }}>TRENDING IN</Text>
          <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }}>{electorate}</Text>
        </View>
      </View>

      {/* Most discussed */}
      {trends.mostDiscussedTopic || trends.mostDiscussedPostTitle ? (
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' }}>
          <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: '#EEF2FF', justifyContent: 'center', alignItems: 'center' }}>
            <Ionicons name="chatbubbles-outline" size={16} color="#4338CA" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 11, fontWeight: '600', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.5 }}>Most discussed</Text>
            <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text, marginTop: 2 }} numberOfLines={1}>
              {trends.mostDiscussedTopic
                ? trends.mostDiscussedTopic.charAt(0).toUpperCase() + trends.mostDiscussedTopic.slice(1).replace(/_/g, ' ')
                : trends.mostDiscussedPostTitle}
            </Text>
          </View>
        </View>
      ) : null}

      {/* Most viewed bill */}
      {trends.mostViewedBillTitle ? (
        <Pressable
          style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' }}
          onPress={() => trends.mostViewedBillId && onBillTap?.(trends.mostViewedBillId)}
        >
          <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: '#D1FAE5', justifyContent: 'center', alignItems: 'center' }}>
            <Ionicons name="document-text-outline" size={16} color="#059669" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 11, fontWeight: '600', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.5 }}>Most viewed bill</Text>
            <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text, marginTop: 2 }} numberOfLines={2}>
              {trends.mostViewedBillTitle}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.textMuted} style={{ marginTop: 8 }} />
        </Pressable>
      ) : null}

      {/* Active users */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: 10 }}>
        <Ionicons name="people" size={14} color="#00843D" />
        <Text style={{ fontSize: 13, color: colors.textBody }}>
          <Text style={{ fontWeight: '700', color: colors.text }}>{trends.activeUsers}</Text> {trends.activeUsers === 1 ? 'person' : 'people'} in {electorate} used Verity this week
        </Text>
      </View>

      {!hasAnyContent && (
        <Text style={{ fontSize: 12, color: '#9CA3AF', marginTop: 8, fontStyle: 'italic' }}>
          Start reading bills and posting in the community to generate local trends.
        </Text>
      )}
    </View>
  );
}
