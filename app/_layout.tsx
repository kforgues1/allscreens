import { useEffect } from 'react';
import { Stack, router, useSegments } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from '../context/ThemeContext';
import { AuthProvider, useAuth } from '../context/AuthContext';

// Rendered inside AuthProvider so it can read context.
// useSegments prevents redirect loops when the user is already on the right segment.
function NavController() {
  const { user, loading, onboardingComplete } = useAuth();
  const segments = useSegments();

  useEffect(() => {
    if (loading) return;

    const currentSegment = segments[0] as string | undefined;

    if (!user) {
      if (currentSegment !== '(auth)') router.replace('/(auth)');
    } else if (!onboardingComplete) {
      if (currentSegment !== '(onboarding)') router.replace('/(onboarding)/genres');
    } else {
      if (currentSegment !== '(tabs)') router.replace('/(tabs)/explore');
    }
  }, [user, loading, onboardingComplete]);

  return null;
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <NavController />
          <Stack screenOptions={{ headerShown: false }} />
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
