import { supabase } from './supabase';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

/**
 * Error reporting to Supabase (own DB).
 *
 * Sentry is NOT imported here — @sentry/react-native requires native modules
 * that aren't available in Expo Go. If you need Sentry, add it in a
 * development client build (eas build --profile development).
 *
 * Table: error_reports (see scripts/migration_notifications.sql)
 */

const isExpoGo = Constants.appOwnership === 'expo';
const appVersion = Constants.expoConfig?.version ?? '1.0.0';

/** Report an error to Supabase error_reports table. Non-blocking. */
export function reportError(
  error: Error,
  context?: {
    componentStack?: string;
    screenName?: string;
    severity?: 'error' | 'warning' | 'fatal';
    extra?: Record<string, unknown>;
  },
) {
  if (__DEV__) {
    console.error('[ErrorReport]', error.message, context);
  }

  // Supabase — own DB (production builds only, skip in Expo Go)
  if (isExpoGo) return;

  Promise.resolve(
    supabase.from('error_reports').insert({
      error_message: error.message?.slice(0, 2000) ?? 'Unknown error',
      error_stack: error.stack?.slice(0, 4000) ?? null,
      component_stack: context?.componentStack?.slice(0, 4000) ?? null,
      screen_name: context?.screenName ?? null,
      app_version: appVersion,
      platform: Platform.OS,
      severity: context?.severity ?? 'error',
      extra: context?.extra ?? {},
    }),
  ).catch(() => {});
}

/** Initialize global error handlers */
export function initErrorReporting() {
  if (isExpoGo) return;

  const originalHandler = ErrorUtils.getGlobalHandler();
  ErrorUtils.setGlobalHandler((error, isFatal) => {
    reportError(error, { severity: isFatal ? 'fatal' : 'error' });
    originalHandler?.(error, isFatal);
  });
}

/** No-op — Sentry not available in Expo Go builds */
export const sentryRoutingInstrumentation: any = null;

/** No-op wrapper — pass component through unchanged */
export const withSentry = (c: any) => c;
