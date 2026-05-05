import 'react-native-gesture-handler';
import React, { useState, useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Linking, Platform } from 'react-native';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';
import { initAnalytics, track, trackScreen, setAnalyticsUser } from './lib/analytics';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { UserProvider } from './context/UserContext';
import { useUser } from './context/UserContext';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { CommunityScreen } from './screens/CommunityScreen';
import { PollsScreen } from './screens/PollsScreen';
import { CommunityPostDetailScreen } from './screens/CommunityPostDetailScreen';
import { CreateCommunityPostScreen } from './screens/CreateCommunityPostScreen';
import { ErrorBoundary } from './components/ErrorBoundary';
import { OfflineBanner } from './components/OfflineBanner';
import { NotificationPermissionModal } from './components/NotificationPermissionModal';
import { NotificationBanner, BannerNotification } from './components/NotificationBanner';
import { HomeScreen } from './screens/HomeScreen';
import { ExploreScreen } from './screens/ExploreScreen';
// import { NewsScreen } from './screens/NewsScreen'; // preserved for A/B rollback
import { NewsScreenV2 } from './screens/NewsScreenV2';
import { NewsScreen } from './screens/NewsScreen';
import { NewsStoryDetailScreen } from './screens/NewsStoryDetailScreen';
import { ProfileScreen } from './screens/ProfileScreen';
import { MemberProfileScreen } from './screens/MemberProfileScreen';
import { BillDetailScreen } from './screens/BillDetailScreen';
import { PartyProfileScreen } from './screens/PartyProfileScreen';
import { PrivacyPolicyScreen } from './screens/PrivacyPolicyScreen';
import { TermsScreen } from './screens/TermsScreen';
import { OnboardingScreen } from './screens/OnboardingScreen';
import { NotificationPreferencesScreen } from './screens/NotificationPreferencesScreen';
import { ManageTopicsScreen } from './screens/ManageTopicsScreen';
import { TopicBillsScreen } from './screens/TopicBillsScreen';
import { BillListScreen } from './screens/BillListScreen';
import { SubscriptionScreen } from './screens/SubscriptionScreen';
import { CouncilProfileScreen } from './screens/CouncilProfileScreen';
import { WriteToMPScreen } from './screens/WriteToMPScreen';
import { AboutScreen } from './screens/AboutScreen';
import { DailyBriefScreen } from './screens/DailyBriefScreen';
import { ActivityScreen } from './screens/ActivityScreen';
import { SavedScreen } from './screens/SavedScreen';
import { LocalAnnouncementsScreen } from './screens/LocalAnnouncementsScreen';
import { ContradictionDetailScreen } from './screens/ContradictionDetailScreen';
// Phone verification deferred — see docs/CLEANUP_TODO.md
import { AdminPollsScreen } from './screens/AdminPollsScreen';
import { supabase } from './lib/supabase';
import { initErrorReporting, sentryRoutingInstrumentation, withSentry } from './lib/errorReporting';

// Suppress system notification UI when app is in foreground — we show our own banner instead
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: false,
    shouldShowBanner: false,
    shouldShowList: false,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// Navigation ref for programmatic navigation from notification taps
export const navigationRef = createNavigationContainerRef<any>();

const isExpoGo = Constants.appOwnership === 'expo';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

function HomeTabs() {
  const { colors } = useTheme();
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        animation: 'fade' as const,
        tabBarActiveTintColor: '#00843D',
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.tabBar,
          borderTopColor: colors.border,
          borderTopWidth: 0.5,
          paddingBottom: 6,
          paddingTop: 6,
          height: 64,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.04,
          shadowRadius: 6,
          elevation: 8,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '700', letterSpacing: 0.2 },
        tabBarIcon: ({ focused }) => {
          const icons: Record<string, [string, string]> = {
            Home:      ['home',        'home-outline'],
            Explore:   ['search',      'search-outline'],
            News:      ['newspaper',   'newspaper-outline'],
            Polls:     ['bar-chart', 'bar-chart-outline'],
            Profile:   ['person',      'person-outline'],
          };
          const [active, inactive] = icons[route.name] ?? ['ellipse', 'ellipse-outline'];
          return (
            <Ionicons
              name={(focused ? active : inactive) as any}
              size={focused ? 26 : 22}
              color={focused ? '#00843D' : colors.textMuted}
            />
          );
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Explore" component={ExploreScreen} />
      <Tab.Screen name="News" component={NewsScreenV2} />
      <Tab.Screen name="Polls" component={PollsScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

// Handles first-run notification permission modal and token registration.
// Must be rendered inside UserProvider so it can access user context.
function AppNotificationGate() {
  const { user } = useUser();
  const [showModal, setShowModal] = useState(false);
  const [mpName, setMpName] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      // Increment app open count
      const raw = await AsyncStorage.getItem('app_open_count');
      const count = parseInt(raw ?? '0') + 1;
      await AsyncStorage.setItem('app_open_count', String(count));

      // Show permission modal on 3rd open if not already granted/snoozed
      const { status } = await Notifications.getPermissionsAsync();
      if (status !== 'granted' && count === 3) {
        const snoozedUntil = await AsyncStorage.getItem('notification_modal_snoozed_until');
        const isSnoozed = snoozedUntil ? new Date(snoozedUntil) > new Date() : false;
        if (!isSnoozed) {
          // Try to personalise with MP name from postcode
          const postcode = await AsyncStorage.getItem('postcode');
          if (postcode) {
            try {
              const { data: electorates } = await supabase
                .from('electorates')
                .select('id')
                .contains('postcodes', [postcode])
                .eq('level', 'federal')
                .limit(1);
              const elecId = electorates?.[0]?.id;
              if (elecId) {
                const { data: members } = await supabase
                  .from('members')
                  .select('first_name, last_name')
                  .eq('electorate_id', elecId)
                  .eq('chamber', 'house')
                  .eq('is_active', true)
                  .limit(1);
                const mp = members?.[0];
                if (mp) setMpName(`${mp.first_name} ${mp.last_name}`);
              }
            } catch {
              // non-critical
            }
          }
          setShowModal(true);
        }
      }

      // Re-register token on open if permission already granted (keeps token fresh)
      if (status === 'granted' && user && !isExpoGo) {
        try {
          const tokenData = await Notifications.getExpoPushTokenAsync();
          await supabase.from('push_tokens').upsert(
            {
              user_id: user.id,
              token: tokenData.data,
              platform: Platform.OS === 'ios' ? 'ios' : 'android',
            },
            { onConflict: 'token' },
          );
        } catch {
          // non-critical
        }
      }
    };
    run();
  }, [user?.id]);

  const handleEnable = async () => {
    setShowModal(false);
    try {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status === 'granted' && user && !isExpoGo) {
        const tokenData = await Notifications.getExpoPushTokenAsync();
        await supabase.from('push_tokens').upsert(
          {
            user_id: user.id,
            token: tokenData.data,
            platform: Platform.OS === 'ios' ? 'ios' : 'android',
          },
          { onConflict: 'token' },
        );
      }
    } catch {
      // non-critical
    }
  };

  const handleDismiss = async () => {
    setShowModal(false);
    const snoozeUntil = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();
    await AsyncStorage.setItem('notification_modal_snoozed_until', snoozeUntil);
  };

  return (
    <NotificationPermissionModal
      visible={showModal}
      mpName={mpName}
      onEnable={handleEnable}
      onDismiss={handleDismiss}
    />
  );
}

function ThemedStatusBar() {
  const { colors } = useTheme();
  return <StatusBar style={colors.statusBar} />;
}

function App() {
  const [onboardingDone, setOnboardingDone] = useState<boolean | null>(null);
  const [bannerNotif, setBannerNotif] = useState<BannerNotification | null>(null);
  const notifResponseSub = useRef<Notifications.Subscription | null>(null);
  const notifReceivedSub = useRef<Notifications.Subscription | null>(null);

  useEffect(() => {
    AsyncStorage.getItem('onboarding_complete').then(val => {
      setOnboardingDone(val !== null);
    });
    initErrorReporting();
    initAnalytics().then(() => track('app_open'));
  }, []);

  useEffect(() => {
    const handleUrl = async ({ url }: { url: string }) => {
      if (!url.startsWith('verity://')) return;
      const fragment = url.includes('#') ? url.split('#')[1] : url.split('?')[1] ?? '';
      const params = Object.fromEntries(new URLSearchParams(fragment));
      if (params.access_token && params.refresh_token) {
        await supabase.auth.setSession({
          access_token: params.access_token,
          refresh_token: params.refresh_token,
        });
      }
    };
    Linking.getInitialURL().then(url => { if (url) handleUrl({ url }); });
    const sub = Linking.addEventListener('url', handleUrl);
    return () => sub.remove();
  }, []);

  // Handle notification received while app is in foreground — show in-app banner
  useEffect(() => {
    notifReceivedSub.current = Notifications.addNotificationReceivedListener(notification => {
      const content = notification.request.content;
      setBannerNotif({
        id: notification.request.identifier,
        title: content.title ?? 'Verity',
        body: content.body ?? '',
        data: (content.data as Record<string, any>) ?? {},
      });
    });
    return () => {
      notifReceivedSub.current?.remove();
    };
  }, []);

  const handleBannerPress = (data: Record<string, any>) => {
    if (!navigationRef.isReady()) return;
    if (data?.screen === 'bill' && data.billId) {
      navigationRef.navigate('BillDetail', { billId: data.billId });
    } else if (data?.screen === 'member' && data.memberId) {
      navigationRef.navigate('MemberProfile', { memberId: data.memberId });
    } else if (data?.screen === 'news' && data.storyId) {
      navigationRef.navigate('NewsStoryDetail', { storyId: data.storyId });
    } else if (data?.screen === 'DailyBrief') {
      navigationRef.navigate('DailyBrief');
    } else if (data?.screen === 'ContradictionDetail' && data.contradictionId) {
      navigationRef.navigate('ContradictionDetail', { contradictionId: data.contradictionId });
    }
  };

  // Handle notification taps (from background/killed) — deep link to relevant screen
  useEffect(() => {
    notifResponseSub.current = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data as any;
      handleBannerPress(data);
    });
    return () => {
      notifResponseSub.current?.remove();
    };
  }, []);

  const handleOnboardingComplete = async () => {
    await AsyncStorage.setItem('onboarding_complete', 'true');
    setOnboardingDone(true);
  };

  if (onboardingDone === null) return null;

  if (!onboardingDone) {
    return (
      <SafeAreaProvider initialMetrics={initialWindowMetrics}>
        <ErrorBoundary>
          <ThemeProvider>
            <OnboardingScreen onComplete={handleOnboardingComplete} />
          </ThemeProvider>
        </ErrorBoundary>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
    <ErrorBoundary>
      <ThemeProvider>
        <UserProvider>
          <NavigationContainer
            ref={navigationRef}
            onReady={() => {
              if (sentryRoutingInstrumentation) {
                sentryRoutingInstrumentation.registerNavigationContainer(navigationRef);
              }
            }}
            onStateChange={(state) => {
              const route = state?.routes?.[state.index ?? 0];
              if (route?.name) trackScreen(route.name);
            }}
          >
            <ThemedStatusBar />
            <OfflineBanner />
            <NotificationBanner
              notification={bannerNotif}
              onPress={handleBannerPress}
              onDismiss={() => setBannerNotif(null)}
            />
            <Stack.Navigator screenOptions={{ headerShown: false }}>
              <Stack.Screen name="Main" component={HomeTabs} />
              <Stack.Screen name="MemberProfile" component={MemberProfileScreen} />
              <Stack.Screen name="BillDetail" component={BillDetailScreen} />
              <Stack.Screen name="PartyProfile" component={PartyProfileScreen} />
              <Stack.Screen name="PrivacyPolicy" component={PrivacyPolicyScreen} />
              <Stack.Screen name="Terms" component={TermsScreen} />
              <Stack.Screen name="NotificationPreferences" component={NotificationPreferencesScreen} />
              <Stack.Screen name="ManageTopics" component={ManageTopicsScreen} />
              <Stack.Screen name="TopicBills" component={TopicBillsScreen} />
              <Stack.Screen name="BillList" component={BillListScreen} />
              <Stack.Screen name="Subscription" component={SubscriptionScreen} />
              <Stack.Screen name="Council" component={CouncilProfileScreen} />
              <Stack.Screen name="News" component={NewsScreen} />
              <Stack.Screen name="NewsStoryDetail" component={NewsStoryDetailScreen} />
              <Stack.Screen name="Community" component={CommunityScreen} />
              <Stack.Screen name="CommunityPostDetail" component={CommunityPostDetailScreen} />
              <Stack.Screen name="CreateCommunityPost" component={CreateCommunityPostScreen} />
              <Stack.Screen name="WriteToMP" component={WriteToMPScreen} />
              <Stack.Screen name="About" component={AboutScreen} />
              <Stack.Screen name="DailyBrief" component={DailyBriefScreen} />
              <Stack.Screen name="Activity" component={ActivityScreen} />
              <Stack.Screen name="Saved" component={SavedScreen} />
              <Stack.Screen name="LocalAnnouncements" component={LocalAnnouncementsScreen} />
              <Stack.Screen name="ContradictionDetail" component={ContradictionDetailScreen} options={{ headerShown: false }} />
              <Stack.Screen name="AdminPolls" component={AdminPollsScreen} />
            </Stack.Navigator>
            <AppNotificationGate />
          </NavigationContainer>
        </UserProvider>
      </ThemeProvider>
    </ErrorBoundary>
    </SafeAreaProvider>
  );
}

export default withSentry(App);
