import { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';

export default function Index() {
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
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F5F3FF' }}>
      <ActivityIndicator color="#7C3AED" size="large" />
    </View>
  );
}
