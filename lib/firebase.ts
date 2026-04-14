import { initializeApp, getApps } from 'firebase/app';
import { initializeAuth, getAuth, browserLocalPersistence, type Persistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

// Prevent duplicate app initialisation (important for Expo fast refresh)
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

function buildAuth() {
  // If already initialised (fast refresh), return existing instance
  if (getApps().length > 1) return getAuth(app);

  if (Platform.OS === 'web') {
    return initializeAuth(app, { persistence: browserLocalPersistence });
  }

  // On native, Metro resolves 'firebase/auth' to the react-native bundle at runtime
  // which exports getReactNativePersistence. TypeScript sees the browser types, so we
  // use require() to bypass module resolution and cast explicitly.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { getReactNativePersistence } = require('firebase/auth') as {
    getReactNativePersistence: (storage: typeof AsyncStorage) => Persistence;
  };
  return initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) });
}

export const auth = buildAuth();
export const db = getFirestore(app);
export default app;
