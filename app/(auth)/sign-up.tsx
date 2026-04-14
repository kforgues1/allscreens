import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import PhoneFrame from '../../components/PhoneFrame';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../../lib/firebase';
import { useTheme } from '../../context/ThemeContext';

function mapFirebaseError(code: string): string {
  switch (code) {
    case 'auth/email-already-in-use':
      return 'an account with this email already exists';
    case 'auth/invalid-email':
      return 'please enter a valid email';
    case 'auth/weak-password':
      return 'password must be at least 6 characters';
    case 'auth/network-request-failed':
      return 'network error — check your connection';
    default:
      return 'something went wrong, please try again';
  }
}

// Shared between both auth screens — defined at module level to avoid recreating
const wordmarkStyle =
  Platform.OS === 'web'
    ? ({
        background:
          'linear-gradient(135deg, #1E0A4E 0%, #4C1D95 25%, #7C3AED 50%, #A78BFA 75%, #C4B5FD 100%)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        backgroundClip: 'text',
      } as any)
    : { color: '#6D28D9' };

const gradientBtnStyle =
  Platform.OS === 'web'
    ? ({ background: 'linear-gradient(135deg, #4C1D95, #7C3AED)' } as any)
    : { backgroundColor: '#6D28D9' };

export default function SignUpScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { sessionCode } = useLocalSearchParams<{ sessionCode?: string }>();

  const [firstName, setFirstName]           = useState('');
  const [lastName, setLastName]             = useState('');
  const [email, setEmail]                   = useState('');
  const [password, setPassword]             = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError]                   = useState('');
  const [loading, setLoading]               = useState(false);

  const clearError = () => setError('');

  const handleSignUp = async () => {
    if (!firstName || !lastName || !email || !password || !confirmPassword) {
      setError('please fill in all fields'); return;
    }
    if (password !== confirmPassword) {
      setError('passwords do not match'); return;
    }
    if (password.length < 6) {
      setError('password must be at least 6 characters'); return;
    }
    clearError();
    setLoading(true);
    try {
      const { user } = await createUserWithEmailAndPassword(auth, email.trim(), password);
      const displayName = `${firstName} ${lastName}`.trim();
      await setDoc(doc(db, 'users', user.uid), {
        firstName,
        lastName,
        displayName,
        email: email.trim(),
        createdAt: serverTimestamp(),
        onboardingComplete: false,
      });
      const pendingCode =
        sessionCode || (await AsyncStorage.getItem('pendingSessionCode').catch(() => null));
      if (pendingCode) {
        await AsyncStorage.removeItem('pendingSessionCode').catch(() => {});
        router.replace({ pathname: '/join/[code]', params: { code: pendingCode } });
      } else {
        router.replace('/(auth)/welcome');
      }
    } catch (e: any) {
      setError(mapFirebaseError(e.code));
    } finally {
      setLoading(false);
    }
  };

  return (
    <PhoneFrame>
    <View style={[styles.screen, { backgroundColor: colors.background }]}>

      {/* ── Vertically centred form ── */}
      <ScrollView
        keyboardShouldPersistTaps="handled"
        style={{ flex: 1 }}
        contentContainerStyle={[styles.body, { paddingTop: insets.top || 24 }]}
      >

        <Text style={[styles.wordmark, wordmarkStyle]}>allscreens</Text>
        <View style={{ height: 10 }} />
        <Text style={styles.tagline}>create your account</Text>
        <View style={{ height: 48 }} />

        {/* First + last name stacked */}
        <TextInput
          style={styles.input}
          placeholder="first name"
          placeholderTextColor="#A78BFA"
          value={firstName}
          onChangeText={v => { setFirstName(v); clearError(); }}
          autoCapitalize="words"
          autoComplete="given-name"
          returnKeyType="next"
        />
        <View style={{ height: 10 }} />
        <TextInput
          style={styles.input}
          placeholder="last name"
          placeholderTextColor="#A78BFA"
          value={lastName}
          onChangeText={v => { setLastName(v); clearError(); }}
          autoCapitalize="words"
          autoComplete="family-name"
          returnKeyType="next"
        />

        <View style={{ height: 10 }} />

        <TextInput
          style={styles.input}
          placeholder="email"
          placeholderTextColor="#A78BFA"
          value={email}
          onChangeText={v => { setEmail(v); clearError(); }}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
          returnKeyType="next"
        />
        <View style={{ height: 10 }} />

        <TextInput
          style={styles.input}
          placeholder="password"
          placeholderTextColor="#A78BFA"
          value={password}
          onChangeText={v => { setPassword(v); clearError(); }}
          secureTextEntry
          autoComplete="new-password"
          returnKeyType="next"
        />
        <View style={{ height: 10 }} />

        <TextInput
          style={styles.input}
          placeholder="confirm password"
          placeholderTextColor="#A78BFA"
          value={confirmPassword}
          onChangeText={v => { setConfirmPassword(v); clearError(); }}
          secureTextEntry
          autoComplete="new-password"
          returnKeyType="done"
          onSubmitEditing={handleSignUp}
        />

        <View style={{ height: 28 }} />

        <TouchableOpacity
          style={[styles.primaryBtn, gradientBtnStyle]}
          activeOpacity={0.85}
          onPress={handleSignUp}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator color="#FFFFFF" />
            : <Text style={styles.primaryBtnText}>create account</Text>}
        </TouchableOpacity>

        {!!error && (
          <>
            <View style={{ height: 10 }} />
            <Text style={styles.errorMsg}>{error}</Text>
          </>
        )}

        <View style={{ height: 16 }} />

        {/* "already have an account?" inline link */}
        <View style={styles.loginRow}>
          <Text style={styles.loginPrompt}>already have an account? </Text>
          <TouchableOpacity onPress={() => router.replace('/(auth)/log-in')}>

            <Text style={styles.loginLink}>log in</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>

      {/* ── Fine print pinned above safe area ── */}
      <Text style={[styles.finePrint, { paddingBottom: (insets.bottom || 0) + 16 }]}>
        by continuing you agree to our terms and privacy policy
      </Text>

    </View>
    </PhoneFrame>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    overflow: 'hidden',
  },
  body: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingBottom: 24,
  },

  // ── Wordmark + tagline ───────────────────────────────────────────────────────
  wordmark: {
    fontSize: 46,
    fontWeight: '200',
    letterSpacing: 6,
    textAlign: 'center',
  },
  tagline: {
    fontSize: 13,
    fontWeight: '300',
    color: '#7C3AED',
    letterSpacing: 2,
    textAlign: 'center',
  },

  // ── Inputs ───────────────────────────────────────────────────────────────────
  input: {
    height: 52,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DDD6FE',
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 15,
    fontWeight: '300',
    color: '#4C1D95',
  },

  // ── Primary button ───────────────────────────────────────────────────────────
  primaryBtn: {
    height: 52,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '400',
    letterSpacing: 1,
  },

  // ── Inline feedback ──────────────────────────────────────────────────────────
  errorMsg: {
    fontSize: 12,
    color: '#E24B4A',
    textAlign: 'center',
  },

  // ── "already have an account?" row ──────────────────────────────────────────
  loginRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loginPrompt: {
    fontSize: 13,
    fontWeight: '300',
    color: '#7C3AED',
  },
  loginLink: {
    fontSize: 13,
    fontWeight: '400',
    color: '#4C1D95',
    textDecorationLine: 'underline',
  },

  // ── Fine print ───────────────────────────────────────────────────────────────
  finePrint: {
    fontSize: 11,
    fontWeight: '300',
    color: '#A78BFA',
    textAlign: 'center',
    paddingHorizontal: 32,
  },
});
