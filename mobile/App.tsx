import 'react-native-gesture-handler';
import React, { useState, useEffect, useRef, Suspense } from 'react';
import AsyncStorage from './lib/storage';
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
import { ErrorBoundary } from './components/ErrorBoundary';
import { OfflineBanner } from './components/OfflineBanner';
import { NotificationPermissionModal } from './components/NotificationPermissionModal';
import { NotificationBanner, BannerNotification } from './components/NotificationBanner';
// ─── Core screens (the 5 that matter) ─────────────────────────────────────
import { HomeScreen } from './screens/HomeScreen';
import { ExploreScreen } from './screens/ExploreScreen';
import { LearnScreen } from './screens/LearnScreen';
import { ProfileScreen } from './screens/ProfileScreen';
// ─── Lazy-loaded screens (deferred until navigated to) ──────────────────
const lazyNamed = <T extends Record<string, React.ComponentType<any>>>(
  factory: () => Promise<T>,
  name: keyof T,
) => React.lazy(() => factory().then(m => ({ default: m[name] as React.ComponentType<any> })));

const MemberProfileScreen = lazyNamed(() => import('./screens/MemberProfileScreen'), 'MemberProfileScreen');
const BillDetailScreen = lazyNamed(() => import('./screens/BillDetailScreen'), 'BillDetailScreen');
const PartyProfileScreen = lazyNamed(() => import('./screens/PartyProfileScreen'), 'PartyProfileScreen');
const OnboardingScreen = lazyNamed(() => import('./screens/OnboardingScreen'), 'OnboardingScreen');
const TopicBillsScreen = lazyNamed(() => import('./screens/TopicBillsScreen'), 'TopicBillsScreen');
const BillListScreen = lazyNamed(() => import('./screens/BillListScreen'), 'BillListScreen');
const LearnModuleScreen = lazyNamed(() => import('./screens/LearnModuleScreen'), 'LearnModuleScreen');
const LessonScreen = lazyNamed(() => import('./screens/LessonScreen'), 'LessonScreen');
const WriteToMPScreen = lazyNamed(() => import('./screens/WriteToMPScreen'), 'WriteToMPScreen');
const SubscriptionScreen = lazyNamed(() => import('./screens/SubscriptionScreen'), 'SubscriptionScreen');
const AboutScreen = lazyNamed(() => import('./screens/AboutScreen'), 'AboutScreen');
const PrivacyPolicyScreen = lazyNamed(() => import('./screens/PrivacyPolicyScreen'), 'PrivacyPolicyScreen');
const TermsScreen = lazyNamed(() => import('./screens/TermsScreen'), 'TermsScreen');
const NotificationPreferencesScreen = lazyNamed(() => import('./screens/NotificationPreferencesScreen'), 'NotificationPreferencesScreen');
const DailyBriefScreen = lazyNamed(() => import('./screens/DailyBriefScreen'), 'DailyBriefScreen');
const ActivityScreen = lazyNamed(() => import('./screens/ActivityScreen'), 'ActivityScreen');
const WatchlistScreen = lazyNamed(() => import('./screens/WatchlistScreen'), 'WatchlistScreen');
const SavedScreen = lazyNamed(() => import('./screens/SavedScreen'), 'SavedScreen');
const ManageTopicsScreen = lazyNamed(() => import('./screens/ManageTopicsScreen'), 'ManageTopicsScreen');
const MethodologyScreen = lazyNamed(() => import('./screens/MethodologyScreen'), 'MethodologyScreen');
const CouncilProfileScreen = lazyNamed(() => import('./screens/CouncilProfileScreen'), 'CouncilProfileScreen');
const MatchResultScreen = lazyNamed(() => import('./screens/MatchResultScreen'), 'MatchResultScreen');
const HypocrisyDetailScreen = lazyNamed(() => import('./screens/HypocrisyDetailScreen'), 'HypocrisyDetailScreen');
const ContradictionDetailScreen = lazyNamed(() => import('./screens/ContradictionDetailScreen'), 'ContradictionDetailScreen');
const CommunityPostDetailScreen = lazyNamed(() => import('./screens/CommunityPostDetailScreen'), 'CommunityPostDetailScreen');
import { supabase } from './lib/supabase';
import { initErrorReporting, sentryRoutingInstrumentation, withSentry } from './lib/errorReporting';
import { initFeatureFlags } from './lib/featureFlags';

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
        lazy: true,
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
            Learn:     ['school',      'school-outline'],
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
      <Tab.Screen name="Home" component={HomeScreen} options={{ tabBarAccessibilityLabel: 'Home' }} />
      <Tab.Screen name="Explore" component={ExploreScreen} options={{ tabBarAccessibilityLabel: 'Explore' }} />
      <Tab.Screen name="Learn" component={LearnScreen} options={{ tabBarAccessibilityLabel: 'Learn' }} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ tabBarAccessibilityLabel: 'Profile' }} />
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
    initFeatureFlags();
  }, []);

  useEffect(() => {
    const handleUrl = async ({ url }: { url: string }) => {
      // Auth callback (verity://auth-callback#access_token=...)
      if (url.startsWith('verity://')) {
        const fragment = url.includes('#') ? url.split('#')[1] : url.split('?')[1] ?? '';
        const params = Object.fromEntries(new URLSearchParams(fragment));
        if (params.access_token && params.refresh_token) {
          await supabase.auth.setSession({
            access_token: params.access_token,
            refresh_token: params.refresh_token,
          });
        }
        return;
      }

      // Universal links (https://verity.au/mp/uuid, /bill/uuid, /party/uuid)
      if (url.includes('verity.au/') && navigationRef.isReady()) {
        const path = url.split('verity.au/')[1];
        if (!path) return;
        const [type, id] = path.split('/');
        if (!type || !id) return;
        if (type === 'mp') navigationRef.navigate('MemberProfile', { memberId: id });
        else if (type === 'bill') navigationRef.navigate('BillDetail', { billId: id });
        else if (type === 'party') navigationRef.navigate('PartyProfile', { partyId: id });
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
    } else if (data?.screen === 'DailyBrief' || data?.screen === 'news') {
      // Edge functions send DailyBrief taps; news stories surface inside the brief
      navigationRef.navigate('DailyBrief');
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
            <Suspense fallback={null}>
              <Stack.Navigator screenOptions={{ headerShown: false }}>
                <Stack.Screen name="Main" component={HomeTabs} />
                {/* Core drill-downs */}
                <Stack.Screen name="MemberProfile" component={MemberProfileScreen} />
                <Stack.Screen name="BillDetail" component={BillDetailScreen} />
                <Stack.Screen name="PartyProfile" component={PartyProfileScreen} />
                {/* Explore drill-downs */}
                <Stack.Screen name="TopicBills" component={TopicBillsScreen} />
                <Stack.Screen name="BillList" component={BillListScreen} />
                {/* Learn flow */}
                <Stack.Screen name="LearnModule" component={LearnModuleScreen} />
                <Stack.Screen name="Lesson" component={LessonScreen} />
                {/* Actions */}
                <Stack.Screen name="WriteToMP" component={WriteToMPScreen} />
                {/* Settings & legal */}
                <Stack.Screen name="Subscription" component={SubscriptionScreen} />
                <Stack.Screen name="About" component={AboutScreen} />
                <Stack.Screen name="PrivacyPolicy" component={PrivacyPolicyScreen} />
                <Stack.Screen name="Terms" component={TermsScreen} />
                <Stack.Screen name="NotificationPreferences" component={NotificationPreferencesScreen} />
                {/* Home drill-downs */}
                <Stack.Screen name="DailyBrief" component={DailyBriefScreen} />
                <Stack.Screen name="Activity" component={ActivityScreen} />
                <Stack.Screen name="Watchlist" component={WatchlistScreen} />
                {/* Profile drill-downs */}
                <Stack.Screen name="Saved" component={SavedScreen} />
                <Stack.Screen name="ManageTopics" component={ManageTopicsScreen} />
                <Stack.Screen name="Methodology" component={MethodologyScreen} />
                <Stack.Screen name="CommunityPostDetail" component={CommunityPostDetailScreen} />
                {/* Explore drill-downs */}
                <Stack.Screen name="Council" component={CouncilProfileScreen} />
                {/* MP profile drill-downs */}
                <Stack.Screen name="MatchResult" component={MatchResultScreen} />
                <Stack.Screen name="HypocrisyDetail" component={HypocrisyDetailScreen} />
                <Stack.Screen name="ContradictionDetail" component={ContradictionDetailScreen} />
              </Stack.Navigator>
            </Suspense>
            <AppNotificationGate />
          </NavigationContainer>
        </UserProvider>
      </ThemeProvider>
    </ErrorBoundary>
    </SafeAreaProvider>
  );
}

export default withSentry(App);
