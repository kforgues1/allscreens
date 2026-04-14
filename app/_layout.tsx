import { useEffect } from 'react';
import { Stack, router } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { ThemeProvider } from '../context/ThemeContext';
import { AuthProvider } from '../context/AuthContext';
import { auth, db } from '../lib/firebase';

export default function RootLayout() {
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.replace('/(auth)/log-in');
        return;
      }
      try {
        const snap = await getDoc(doc(db, 'users', user.uid));
        const complete = snap.data()?.onboardingComplete === true;
        router.replace(complete ? '/(tabs)/browse' : '/(onboarding)/genres');
      } catch {
        router.replace('/(auth)/log-in');
      }
    });
    return unsub;
  }, []);

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <Stack screenOptions={{ headerShown: false }} />
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
