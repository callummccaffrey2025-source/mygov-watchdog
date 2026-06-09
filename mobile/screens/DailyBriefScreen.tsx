import React from 'react';
import { View, ScrollView, RefreshControl, Share } from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useDailyBrief } from '../hooks/useDailyBrief';
import { spacing, radius, elevation, colors as tokenColors } from '../theme/tokens';
import { PressableScale, AppText, Card, Skeleton } from '../components/ui';

export function DailyBriefScreen({ navigation }: any) {
  const { brief, loading } = useDailyBrief();
  const [refreshing, setRefreshing] = React.useState(false);

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: tokenColors.background }} edges={['top']}>
        <View style={{ padding: spacing.xl, gap: spacing.lg }}>
          <Skeleton width={200} height={28} />
          <Skeleton width="100%" height={180} borderRadius={radius.md} />
          <Skeleton width="100%" height={120} borderRadius={radius.md} />
          <Skeleton width="100%" height={100} borderRadius={radius.md} />
        </View>
      </SafeAreaView>
    );
  }

  const handleShare = () => {
    const text = [
      `Your Daily Brief — ${brief?.date || 'Today'}`,
      brief?.mp ? `\n${brief.mp.mp_name} voted ${brief.mp.votes.length} times recently.` : '',
      brief?.one_thing ? `\nOne thing to know: ${brief.one_thing}` : '',
      '\nRead more on Verity.',
    ].join('');
    Share.share({ message: text });
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: tokenColors.background }} edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: spacing.xxxl + 56 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => { setRefreshing(true); setTimeout(() => setRefreshing(false), 1000); }}
            tintColor="#FFFFFF"
          />
        }
      >
        {/* ═══ 1. GREEN GRADIENT HEADER ═══ */}
        <LinearGradient
          colors={['#00843D', '#006B31']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            paddingTop: spacing.lg,
            paddingBottom: spacing.xxxl,
            paddingHorizontal: spacing.xl,
            borderBottomLeftRadius: 24,
            borderBottomRightRadius: 24,
          }}
        >
          {/* Back button */}
          <PressableScale
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center', marginBottom: spacing.xl }}
          >
            <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
          </PressableScale>

          {/* Date label */}
          <AppText variant="label" style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: spacing.xs }}>
            {brief?.date || 'Today'}
          </AppText>

          {/* Title */}
          <AppText variant="display" style={{ color: '#FFFFFF', fontSize: 32 }}>
            Your Daily Brief
          </AppText>
        </LinearGradient>

        {/* ═══ 2. WHAT HAPPENED ═══ */}
        <View style={{ paddingHorizontal: spacing.xl, marginTop: spacing.xxl }}>
          <AppText variant="label" color="textMuted" style={{ fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: spacing.sm }}>
            What happened
          </AppText>

          {brief?.ai_text?.what_happened?.length > 0 ? (
            (brief!.ai_text.what_happened as any[]).map((story: any, i: number) => (
              <Card key={i} elevated style={{ marginBottom: spacing.md }}>
                {story.topic && (
                  <View style={{ backgroundColor: tokenColors.accentMuted, borderRadius: 6, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, alignSelf: 'flex-start', marginBottom: spacing.sm }}>
                    <AppText variant="caption" style={{ fontWeight: '600', color: tokenColors.accent }}>{story.topic}</AppText>
                  </View>
                )}
                <AppText variant="heading" style={{ marginBottom: spacing.xs }}>
                  {story.headline || story}
                </AppText>
                {story.summary && (
                  <AppText variant="body" color="textSecondary" numberOfLines={2}>
                    {story.summary}
                  </AppText>
                )}
                {story.source_count && (
                  <AppText variant="caption" color="textMuted" style={{ marginTop: spacing.sm }}>
                    from {story.source_count} sources
                  </AppText>
                )}
              </Card>
            ))
          ) : brief?.bills && brief.bills.length > 0 ? (
            brief.bills.slice(0, 3).map(bill => (
              <Card key={bill.id} elevated onPress={() => navigation.navigate('BillDetail', { billId: bill.id })} style={{ marginBottom: spacing.md }}>
                <AppText variant="heading" numberOfLines={2}>{bill.title}</AppText>
                <AppText variant="caption" color="textMuted" style={{ marginTop: spacing.xs }}>
                  {bill.status === 'introduced' ? 'Introduced' : bill.status === 'passed_house' ? 'Passed House' : bill.status}
                </AppText>
              </Card>
            ))
          ) : (
            <Card>
              <AppText variant="body" color="textMuted">No stories available today. Check back tomorrow.</AppText>
            </Card>
          )}
        </View>

        {/* ═══ 3. YOUR MP'S WEEK ═══ */}
        {brief?.mp && (
          <View style={{ paddingHorizontal: spacing.xl, marginTop: spacing.xxl }}>
            <AppText variant="label" color="textMuted" style={{ fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: spacing.sm }}>
              Your MP's week
            </AppText>

            <Card elevated>
              {/* MP header */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.md }}>
                {brief.mp.mp_photo ? (
                  <Image source={{ uri: brief.mp.mp_photo }} style={{ width: 48, height: 48, borderRadius: 24 }} contentFit="cover" />
                ) : (
                  <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: tokenColors.surfaceMuted, justifyContent: 'center', alignItems: 'center' }}>
                    <AppText variant="body" style={{ fontWeight: '700' }}>
                      {brief.mp.mp_name.split(' ').map(n => n[0]).join('')}
                    </AppText>
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <AppText variant="body" style={{ fontWeight: '600' }}>{brief.mp.mp_name}</AppText>
                  <AppText variant="caption" color="textMuted">{brief.mp.mp_party} · {brief.mp.electorate}</AppText>
                </View>
              </View>

              {/* Vote list */}
              {brief.mp.votes.slice(0, 5).map((v, i) => (
                <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xs }}>
                  <AppText variant="body" style={{ color: v.vote === 'aye' ? tokenColors.success : tokenColors.danger, fontWeight: '600' }}>
                    {v.vote === 'aye' ? 'AYE' : 'NO'}
                  </AppText>
                  <AppText variant="caption" style={{ flex: 1 }} numberOfLines={1}>{v.division_name}</AppText>
                </View>
              ))}

              {/* Rebellion flag */}
              {brief.mp.rebellions > 0 && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md, backgroundColor: tokenColors.warning + '1A', borderRadius: 6, padding: spacing.sm }}>
                  <Ionicons name="warning-outline" size={14} color={tokenColors.warning} />
                  <AppText variant="caption" style={{ color: tokenColors.warning, fontWeight: '600' }}>
                    Crossed the floor {brief.mp.rebellions} time{brief.mp.rebellions !== 1 ? 's' : ''}
                  </AppText>
                </View>
              )}
            </Card>
          </View>
        )}

        {/* ═══ 4. BILLS TO WATCH ═══ */}
        {brief?.bills && brief.bills.length > 0 && (
          <View style={{ paddingHorizontal: spacing.xl, marginTop: spacing.xxl }}>
            <AppText variant="label" color="textMuted" style={{ fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: spacing.sm }}>
              Bills to watch
            </AppText>

            {brief.bills.slice(0, 3).map(bill => (
              <Card key={bill.id} elevated onPress={() => navigation.navigate('BillDetail', { billId: bill.id })} style={{ marginBottom: spacing.md }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                  <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: tokenColors.accentMuted, justifyContent: 'center', alignItems: 'center' }}>
                    <Ionicons name="document-text" size={16} color={tokenColors.accent} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <AppText variant="body" style={{ fontWeight: '600' }} numberOfLines={1}>{bill.title}</AppText>
                    <AppText variant="caption" color="textMuted" style={{ marginTop: spacing.xs }}>
                      {bill.status === 'introduced' ? 'Introduced' : bill.status === 'passed_house' ? 'Passed House' : bill.status}
                    </AppText>
                  </View>
                  <Ionicons name="chevron-forward" size={14} color={tokenColors.textMuted} />
                </View>
              </Card>
            ))}
          </View>
        )}

        {/* ═══ 5. ONE THING TO KNOW ═══ */}
        {brief?.one_thing && (
          <View style={{ paddingHorizontal: spacing.xl, marginTop: spacing.xxl }}>
            <AppText variant="label" color="textMuted" style={{ fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: spacing.sm }}>
              One thing to know
            </AppText>

            <Card elevated style={{ padding: 20 }}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md }}>
                <Ionicons name="bulb-outline" size={24} color={tokenColors.warning} style={{ marginTop: 2 }} />
                <AppText variant="body" style={{ flex: 1, lineHeight: 24 }}>
                  {brief.one_thing}
                </AppText>
              </View>
            </Card>
          </View>
        )}

        {/* Footer */}
        <View style={{ paddingHorizontal: spacing.xl, marginTop: spacing.xxl }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xs }}>
            <Ionicons name="information-circle-outline" size={13} color={tokenColors.textMuted} style={{ marginTop: 1 }} />
            <AppText variant="caption" color="textMuted" style={{ flex: 1 }}>
              Data from TheyVoteForYou, Australian Parliament House, and AEC. Updated daily at 7am AEST.
            </AppText>
          </View>
        </View>
      </ScrollView>

      {/* ═══ SHARE FAB ═══ */}
      <PressableScale
        onPress={handleShare}
        accessibilityRole="button"
        accessibilityLabel="Share daily brief"
        style={{
          position: 'absolute',
          bottom: spacing.xl,
          right: spacing.xl,
          width: 56,
          height: 56,
          borderRadius: 28,
          backgroundColor: tokenColors.success,
          justifyContent: 'center',
          alignItems: 'center',
          ...elevation.lg,
        }}
      >
        <Ionicons name="share-outline" size={24} color="#FFFFFF" />
      </PressableScale>
    </SafeAreaView>
  );
}
