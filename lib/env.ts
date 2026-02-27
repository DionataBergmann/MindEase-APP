/**
 * Env vars (EXPO_PUBLIC_*) – inlined at build time.
 * Optional validation in __DEV__ to warn about missing config.
 */

const env = {
  get firebaseApiKey() {
    return process.env.EXPO_PUBLIC_FIREBASE_API_KEY ?? '';
  },
  get firebaseAuthDomain() {
    return process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN ?? '';
  },
  get firebaseProjectId() {
    return process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID ?? '';
  },
  get firebaseStorageBucket() {
    return process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET ?? '';
  },
  get firebaseMessagingSenderId() {
    return process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? '';
  },
  get firebaseAppId() {
    return process.env.EXPO_PUBLIC_FIREBASE_APP_ID ?? '';
  },
  get firebaseMeasurementId() {
    return process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID ?? '';
  },
  get apiBaseUrl() {
    const url = process.env.EXPO_PUBLIC_API_BASE_URL ?? '';
    return url.replace(/\/$/, '');
  },
};

/** Log missing env in dev. Call once at app start if desired. */
export function warnMissingEnv(): void {
  if (typeof __DEV__ === 'boolean' && !__DEV__) return;
  const missing: string[] = [];
  if (!env.firebaseApiKey) missing.push('EXPO_PUBLIC_FIREBASE_API_KEY');
  if (!env.firebaseProjectId) missing.push('EXPO_PUBLIC_FIREBASE_PROJECT_ID');
  if (!env.apiBaseUrl) missing.push('EXPO_PUBLIC_API_BASE_URL');
  if (missing.length > 0) {
    console.warn('[MindEase] Missing .env:', missing.join(', '));
  }
}

export { env };
