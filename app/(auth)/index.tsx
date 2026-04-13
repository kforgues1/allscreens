import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import PhoneFrame from '../../components/PhoneFrame';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../../lib/firebase';
import { useTheme } from '../../context/ThemeContext';

function mapFirebaseError(code: string): string {
  switch (code) {
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'invalid email or password';
    case 'auth/invalid-email':
      return 'please enter a valid email';
    case 'auth/too-many-requests':
      return 'too many attempts — try again later';
    case 'auth/network-request-failed':
      return 'network error — check your connection';
    default:
      return 'something went wrong, please try again';
  }
}

// 5-stop gradient wordmark on web; flat colour on native
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

// Gradient primary button on web; solid on native
const gradientBtnStyle =
  Platform.OS === 'web'
    ? ({ background: 'linear-gradient(135deg, #4C1D95, #7C3AED)' } as any)
    : { backgroundColor: '#6D28D9' };

export default function LoginScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const clearFeedback = () => { setError(''); setResetSent(false); };

  const handleLogin = async () => {
    if (!email || !password) { setError('please enter your email and password'); return; }
    clearFeedback();
    setLoading(true);
    try {
      const { user } = await signInWithEmailAndPassword(auth, email.trim(), password);
      const snap = await getDoc(doc(db, 'users', user.uid));
      const done = snap.data()?.onboardingComplete ?? false;
      router.replace(done ? '/(tabs)/browse' : '/(onboarding)/genres');
    } catch (e: any) {
      setError(mapFirebaseError(e.code));
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) { setError('enter your email above first'); return; }
    clearFeedback();
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setResetSent(true);
    } catch (e: any) {
      setError(mapFirebaseError(e.code));
    }
  };

  return (
    <PhoneFrame>
    <View style={[styles.screen, { backgroundColor: colors.background }]}>

      {/* ── Vertically centred form ── */}
      <View style={[styles.body, { paddingTop: insets.top }]}>

        <Text style={[styles.wordmark, wordmarkStyle]}>allscreens</Text>
        <View style={{ height: 10 }} />
        <Text style={styles.tagline}>decide what to watch. together.</Text>
        <View style={{ height: 52 }} />

        <TextInput
          style={styles.input}
          placeholder="email"
          placeholderTextColor="#A78BFA"
          value={email}
          onChangeText={v => { setEmail(v); clearFeedback(); }}
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
          onChangeText={v => { setPassword(v); clearFeedback(); }}
          secureTextEntry
          autoComplete="password"
          returnKeyType="done"
          onSubmitEditing={handleLogin}
        />
        <View style={{ height: 8 }} />

        <TouchableOpacity onPress={handleForgotPassword} style={styles.forgotRow}>
          <Text style={styles.forgotText}>forgot password?</Text>
        </TouchableOpacity>

        {!!error     && <Text style={styles.errorMsg}>{error}</Text>}
        {resetSent   && <Text style={styles.successMsg}>reset email sent — check your inbox</Text>}

        <View style={{ height: 28 }} />

        <TouchableOpacity
          style={[styles.primaryBtn, gradientBtnStyle]}
          activeOpacity={0.85}
          onPress={handleLogin}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator color="#FFFFFF" />
            : <Text style={styles.primaryBtnText}>log in</Text>}
        </TouchableOpacity>

        <View style={{ height: 10 }} />

        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerLabel}>or</Text>
          <View style={styles.dividerLine} />
        </View>

        <View style={{ height: 10 }} />

        <TouchableOpacity
          style={styles.secondaryBtn}
          activeOpacity={0.7}
          onPress={() => router.push('/(auth)/sign-up')}
        >
          <Text style={styles.secondaryBtnText}>create an account</Text>
        </TouchableOpacity>

      </View>

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
  },
  body: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 32,
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

  // ── Forgot password ──────────────────────────────────────────────────────────
  forgotRow: {
    alignSelf: 'flex-end',
  },
  forgotText: {
    fontSize: 12,
    fontWeight: '300',
    color: '#7C3AED',
  },

  // ── Inline feedback ──────────────────────────────────────────────────────────
  errorMsg: {
    fontSize: 12,
    color: '#E24B4A',
    marginTop: 10,
  },
  successMsg: {
    fontSize: 12,
    color: '#7C3AED',
    marginTop: 10,
  },

  // ── Buttons ──────────────────────────────────────────────────────────────────
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
  secondaryBtn: {
    height: 52,
    borderWidth: 1,
    borderColor: '#6D28D9',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtnText: {
    color: '#4C1D95',
    fontSize: 15,
    fontWeight: '400',
    letterSpacing: 1,
  },

  // ── Divider ──────────────────────────────────────────────────────────────────
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#DDD6FE',
  },
  dividerLabel: {
    fontSize: 12,
    color: '#A78BFA',
    fontWeight: '300',
    marginHorizontal: 12,
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
