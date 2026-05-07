import { useState, useEffect, useCallback } from 'react';
import { Platform } from 'react-native';
import {
  useIAP,
  getReceiptIOS,
  ErrorCode,
  type Purchase,
  type PurchaseError,
} from 'react-native-iap';
import { supabase } from '../lib/supabase';

const PRODUCT_ID = 'verity_pro_monthly';

export function useSubscription(userId: string | undefined) {
  const [isPro, setIsPro] = useState(false);
  const [dbLoading, setDbLoading] = useState(true);

  const {
    connected,
    subscriptions,
    fetchProducts,
    requestPurchase,
    restorePurchases,
    finishTransaction,
  } = useIAP({
    onPurchaseSuccess: async (purchase: Purchase) => {
      if (userId) {
        try {
          const receipt = Platform.OS === 'ios'
            ? await getReceiptIOS()
            : purchase.transactionId;

          if (receipt) {
            await supabase.functions.invoke('validate-receipt', {
              body: {
                platform: Platform.OS,
                receipt,
                userId,
                productId: PRODUCT_ID,
              },
            });
          }

          await finishTransaction({ purchase, isConsumable: false });
          setIsPro(true);
        } catch (err) {
          console.error('Receipt validation failed:', err);
        }
      }
    },
    onPurchaseError: (error: PurchaseError) => {
      if (error.code !== ErrorCode.UserCancelled) {
        console.error('IAP purchase error:', error);
      }
    },
  });

  // Check DB for current pro status
  useEffect(() => {
    if (!userId) { setDbLoading(false); return; }
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase
          .from('user_preferences')
          .select('is_pro,pro_expires_at')
          .eq('user_id', userId)
          .maybeSingle();
        if (!cancelled) {
          const active =
            !!data?.is_pro &&
            (!data.pro_expires_at || new Date(data.pro_expires_at) > new Date());
          setIsPro(active);
        }
      } catch {
        // leave isPro as default false
      }
      if (!cancelled) setDbLoading(false);
    })();
    return () => { cancelled = true; };
  }, [userId]);

  // Fetch subscription product once connected
  useEffect(() => {
    if (connected) {
      fetchProducts({ skus: [PRODUCT_ID] }).catch((err) => {
        console.warn('Failed to fetch subscription products:', err);
      });
    }
  }, [connected, fetchProducts]);

  const product = subscriptions.length > 0 ? subscriptions[0] : null;

  const subscribe = useCallback(async () => {
    if (!product) {
      console.warn('Product not loaded — cannot subscribe');
      return;
    }
    try {
      await requestPurchase({
        type: 'subs',
        request: {
          apple: { sku: PRODUCT_ID },
        },
      });
    } catch (err) {
      console.error('Subscription request failed:', err);
    }
  }, [product, requestPurchase]);

  const restore = useCallback(async () => {
    if (!userId) return;
    try {
      await restorePurchases();
      // Re-check DB after restore
      const { data } = await supabase
        .from('user_preferences')
        .select('is_pro,pro_expires_at')
        .eq('user_id', userId)
        .maybeSingle();
      const active =
        !!data?.is_pro &&
        (!data.pro_expires_at || new Date(data.pro_expires_at) > new Date());
      setIsPro(active);
    } catch (err) {
      console.error('Restore purchases failed:', err);
    }
  }, [userId, restorePurchases]);

  return {
    isPro,
    loading: dbLoading,
    subscribe,
    restore,
    product,
  };
}
