import { useState, useEffect, useCallback } from 'react';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { supabase } from '../lib/supabase';
import { track } from '../lib/analytics';

/**
 * Subscription hook — RevenueCat in production builds, DB-only in Expo Go.
 *
 * In production (EAS dev client / release builds):
 *   - Uses react-native-purchases (RevenueCat) for IAP
 *   - Receipt validation handled server-side via RevenueCat webhooks → Supabase
 *   - RevenueCat API key from app.json extra
 *
 * In Expo Go:
 *   - Falls back to DB-only pro status check
 *   - subscribe() logs a warning
 *
 * Product IDs:
 *   - iOS: verity_pro_monthly ($4.99/mo)
 *   - Android: verity_pro_monthly ($4.99/mo)
 */

const PRODUCT_ID = 'verity_pro_monthly';
const isExpoGo = Constants.appOwnership === 'expo';

// Dynamic import — only resolves in production builds where react-native-purchases is installed
let Purchases: any = null;
if (!isExpoGo) {
  try {
    Purchases = require('react-native-purchases').default;
  } catch {
    // Not installed yet — fall back to DB-only
  }
}

export function useSubscription(userId: string | undefined) {
  const [isPro, setIsPro] = useState(false);
  const [loading, setLoading] = useState(true);
  const [offering, setOffering] = useState<any>(null);

  // Initialize RevenueCat + check entitlements
  useEffect(() => {
    if (!userId) { setLoading(false); return; }
    let cancelled = false;

    (async () => {
      try {
        if (Purchases) {
          // Production: use RevenueCat
          const apiKey = Platform.OS === 'ios'
            ? (Constants.expoConfig?.extra?.revenueCatAppleKey ?? '')
            : (Constants.expoConfig?.extra?.revenueCatGoogleKey ?? '');

          if (apiKey) {
            Purchases.configure({ apiKey, appUserID: userId });

            // Check entitlements
            const customerInfo = await Purchases.getCustomerInfo();
            const proEntitlement = customerInfo.entitlements.active['verity_pro'];
            if (!cancelled) setIsPro(!!proEntitlement);

            // Fetch offerings for purchase UI
            const offerings = await Purchases.getOfferings();
            if (!cancelled && offerings.current) {
              setOffering(offerings.current);
            }
          }
        }

        // Always check DB as fallback / source of truth for manual grants
        const { data } = await supabase
          .from('user_preferences')
          .select('is_pro,pro_expires_at')
          .eq('user_id', userId)
          .maybeSingle();

        if (!cancelled && data) {
          const dbActive =
            !!data.is_pro &&
            (!data.pro_expires_at || new Date(data.pro_expires_at) > new Date());
          // Pro if either RevenueCat OR DB says so (DB covers manual grants, promos)
          setIsPro(prev => prev || dbActive);
        }
      } catch {
        // Fall through — leave isPro as default
      }
      if (!cancelled) setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [userId]);

  const subscribe = useCallback(async () => {
    if (!Purchases || !offering) {
      if (isExpoGo) {
        console.warn('IAP not available in Expo Go — use EAS dev build for purchases');
      }
      track('subscription_attempt', { success: false, reason: 'no_iap' }, 'Subscription');
      return { success: false, error: 'IAP not available' };
    }

    try {
      const pkg = offering.availablePackages.find(
        (p: any) => p.product.identifier === PRODUCT_ID,
      ) ?? offering.availablePackages[0];

      if (!pkg) {
        return { success: false, error: 'No package found' };
      }

      const { customerInfo } = await Purchases.purchasePackage(pkg);
      const proActive = !!customerInfo.entitlements.active['verity_pro'];
      setIsPro(proActive);

      // Sync to DB
      if (proActive && userId) {
        await supabase
          .from('user_preferences')
          .upsert({
            user_id: userId,
            is_pro: true,
            pro_started_at: new Date().toISOString(),
          }, { onConflict: 'user_id' });
      }

      track('subscription_purchased', { product: PRODUCT_ID }, 'Subscription');
      return { success: proActive };
    } catch (e: any) {
      if (e.userCancelled) {
        track('subscription_cancelled', {}, 'Subscription');
        return { success: false, error: 'cancelled' };
      }
      track('subscription_error', { error: e.message }, 'Subscription');
      return { success: false, error: e.message };
    }
  }, [offering, userId]);

  const restore = useCallback(async () => {
    if (Purchases) {
      try {
        const customerInfo = await Purchases.restorePurchases();
        const proActive = !!customerInfo.entitlements.active['verity_pro'];
        setIsPro(proActive);
        track('subscription_restored', { success: proActive }, 'Subscription');
        return proActive;
      } catch {
        // Fall through to DB check
      }
    }

    // DB fallback
    if (!userId) return false;
    const { data } = await supabase
      .from('user_preferences')
      .select('is_pro,pro_expires_at')
      .eq('user_id', userId)
      .maybeSingle();
    const active =
      !!data?.is_pro &&
      (!data.pro_expires_at || new Date(data.pro_expires_at) > new Date());
    setIsPro(active);
    return active;
  }, [userId]);

  return {
    isPro,
    loading,
    subscribe,
    restore,
    offering,
    product: offering?.availablePackages?.[0]?.product ?? null,
    isIAPAvailable: !!Purchases,
  };
}
