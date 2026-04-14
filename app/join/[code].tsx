import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Platform } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../context/AuthContext';

const gradientStyle =
  Platform.OS === 'web'
    ? ({ background: 'linear-gradient(135deg, #4C1D95, #7C3AED)' } as any)
    : { backgroundColor: '#6D28D9' };

export default function JoinSessionScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user || !code) return;
    // Logged-in user lands here — immediately join and navigate to decide screen
    joinAndNavigate();
  }, [user, code]);

  const joinAndNavigate = async () => {
    if (!user || !code) return;
    setJoining(true);
    try {
      await updateDoc(doc(db, 'sessions', code), {
        members: arrayUnion(user.uid),
      });
      // Navigate to decide screen where they'll be in the group-waiting room
      // Pass the code so decide screen can pick it up
      router.replace('/(tabs)/decide');
    } catch (e: any) {
      setError('session not found or already started');
    } finally {
      setJoining(false);
    }
  };

  // Not logged in — show invite prompt
  if (!user) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top + 24 }]}>
        <Text style={styles.wordmark}>allscreens</Text>
        <View style={styles.body}>
          <Text style={styles.inviteText}>you've been invited to a watch session</Text>
          <Text style={styles.sessionCode}>{code}</Text>
          <TouchableOpacity
            style={[styles.primaryBtn, gradientStyle]}
            onPress={() => router.replace('/(auth)/log-in')}
            activeOpacity={0.85}
          >
            <Text style={styles.primaryBtnText}>join with your account</Text>
          </TouchableOpacity>
          <Text style={styles.finePrint}>
            you'll be taken back here after signing in
          </Text>
        </View>
      </View>
    );
  }

  // Logged in — show loading while joining
  return (
    <View style={[styles.screen, styles.centered, { paddingTop: insets.top }]}>
      {joining ? (
        <>
          <ActivityIndicator color="#6D28D9" />
          <Text style={styles.joiningText}>joining session {code}…</Text>
        </>
      ) : error ? (
        <>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={() => router.replace('/(tabs)/decide')} style={styles.backLink}>
            <Text style={styles.backLinkText}>go to decide</Text>
          </TouchableOpacity>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F3F0FF',
    paddingHorizontal: 32,
  },
  centered: { alignItems: 'center', justifyContent: 'center', gap: 12 },
  wordmark: {
    fontSize: 36,
    fontWeight: '200',
    color: '#4C1D95',
    letterSpacing: 6,
    textAlign: 'center',
    marginBottom: 48,
  },
  body: { alignItems: 'center', gap: 16 },
  inviteText: {
    fontSize: 14,
    fontWeight: '300',
    color: '#4C1D95',
    textAlign: 'center',
    lineHeight: 22,
  },
  sessionCode: {
    fontSize: 24,
    fontWeight: '200',
    color: '#6D28D9',
    letterSpacing: 6,
    textAlign: 'center',
  },
  primaryBtn: {
    height: 52,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    alignSelf: 'stretch',
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '400',
    letterSpacing: 0.5,
  },
  finePrint: {
    fontSize: 11,
    fontWeight: '300',
    color: '#A78BFA',
    textAlign: 'center',
  },
  joiningText: { fontSize: 13, fontWeight: '300', color: '#7C3AED' },
  errorText: { fontSize: 13, fontWeight: '300', color: '#E24B4A', textAlign: 'center' },
  backLink: { marginTop: 8 },
  backLinkText: { fontSize: 13, color: '#7C3AED', textDecorationLine: 'underline' },
});
