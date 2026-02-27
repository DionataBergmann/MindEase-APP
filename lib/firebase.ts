import { getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import {
  getAuth,
  setPersistence,
  browserLocalPersistence,
  onAuthStateChanged,
  type Auth,
  type User,
} from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { env } from './env';

const firebaseConfig = {
  apiKey: env.firebaseApiKey,
  authDomain: env.firebaseAuthDomain,
  projectId: env.firebaseProjectId,
  storageBucket: env.firebaseStorageBucket,
  messagingSenderId: env.firebaseMessagingSenderId,
  appId: env.firebaseAppId,
  measurementId: env.firebaseMeasurementId || undefined,
};

function getFirebaseApp(): FirebaseApp | null {
  const apps = getApps();
  if (apps.length > 0) return apps[0] as FirebaseApp;
  if (!firebaseConfig.apiKey) return null;
  return initializeApp(firebaseConfig);
}

export function getFirebaseAuth(): Auth | null {
  const app = getFirebaseApp();
  if (!app) return null;

  if (Platform.OS === 'web') {
    const auth = getAuth(app);
    setPersistence(auth, browserLocalPersistence).catch(() => {});
    return auth;
  }

  const authMod = require('firebase/auth') as {
    getAuth: (app: FirebaseApp) => Auth;
    initializeAuth: (app: FirebaseApp, opts: { persistence: unknown }) => Auth;
    getReactNativePersistence: (storage: unknown) => unknown;
  };
  try {
    return authMod.initializeAuth(app, {
      persistence: authMod.getReactNativePersistence(AsyncStorage),
    });
  } catch (e: unknown) {
    const err = e as { code?: string };
    if (err?.code === 'auth/already-initialized') return authMod.getAuth(app);
    throw e;
  }
}

export function getCurrentUserWhenReady(
  auth: Auth | null,
  timeoutMs = 3000
): Promise<User | null> {
  if (!auth) return Promise.resolve(null);
  const current = auth.currentUser;
  if (current) return Promise.resolve(current);
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      unsubscribe();
      resolve(auth.currentUser);
    }, timeoutMs);
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      clearTimeout(timeout);
      unsubscribe();
      resolve(user ?? null);
    });
  });
}

export function getFirestoreDb(): Firestore | null {
  const app = getFirebaseApp();
  return app ? getFirestore(app) : null;
}
