import { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Platform,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { doc, getDoc, updateDoc, arrayUnion } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { db } from '../../lib/firebase';
import { useAuth } from '../../context/AuthContext';
import PhoneFrame from '../../components/PhoneFrame';

const PENDING_KEY = 'pendingSessionCode';

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

export default function JoinSessionScreen() {
  const { code: codeParam } = useLocalSearchParams<{ code: string }>();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  const [hostName, setHostName] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [joining, setJoining] = useState(false);

  // Persist the session code to AsyncStorage so it survives the auth flow.
  // Do this as early as possible when the user is not yet logged in.
  useEffect(() => {
    if (!user && codeParam) {
      AsyncStorage.setItem(PENDING_KEY, codeParam).catch(() => {});
    }
  }, [user, codeParam]);

  // Fetch host name for the unauthenticated invite preview
  useEffect(() => {
    if (!codeParam) return;
    getDoc(doc(db, 'sessions', codeParam))
      .then(snap => {
        const name = snap.data()?.hostName as string | undefined;
        if (name) setHostName(name);
      })
      .catch(() => {});
  }, [codeParam]);

  // Logged-in: resolve code (param OR AsyncStorage), join, and navigate
  useEffect(() => {
    if (!user) return;
    joinAndNavigate();
  }, [user]);

  const joinAndNavigate = async () => {
    if (!user) return;

    // Resolve the session code — prefer URL param, fall back to AsyncStorage
    let code = codeParam;
    if (!code) {
      code = (await AsyncStorage.getItem(PENDING_KEY).catch(() => null)) ?? '';
    }
    // Always clear the pending key once we have it
    await AsyncStorage.removeItem(PENDING_KEY).catch(() => {});

    if (!code) {
      setError('no session code found');
      return;
    }

    setJoining(true);
    try {
      const snap = await getDoc(doc(db, 'sessions', code));
      if (!snap.exists() || snap.data()?.status === 'ended') {
        setError("this session has ended or doesn't exist");
        setJoining(false);
        return;
      }
      const members: string[] = snap.data()?.members ?? [];
      if (members.length >= 4 && !members.includes(user.uid)) {
        setError('this session is full');
        setJoining(false);
        return;
      }
      const userSnap = await getDoc(doc(db, 'users', user.uid));
      const d = userSnap.data();
      const nameFromParts = `${d?.firstName ?? ''} ${d?.lastName ?? ''}`.trim();
      const displayName =
        ((d?.displayName as string | undefined) ?? nameFromParts) || (user.email ?? user.uid);

      await updateDoc(doc(db, 'sessions', code), {
        members: arrayUnion(user.uid),
        [`memberNames.${user.uid}`]: displayName,
      });
      // Use replace throughout so the back stack stays clean (Part 6)
      router.replace({ pathname: '/(tabs)/decide', params: { joinCode: code } });
    } catch {
      setError('could not join session — try again');
      setJoining(false);
    }
  };

  // ── State A: not logged in ────────────────────────────────────────────────

  if (!user) {
    return (
      <PhoneFrame>
        <View
          style={[
            styles.screen,
            { paddingTop: (insets.top || 0) + 32, paddingBottom: (insets.bottom || 0) + 32 },
          ]}
        >
          <Text style={[styles.wordmark, wordmarkStyle]}>allscreens</Text>
          <View style={{ height: 8 }} />
          <Text style={styles.invitedLabel}>you've been invited to watch something</Text>
          {hostName ? (
            <Text style={styles.byLabel}>by {hostName}</Text>
          ) : null}

          {/* Movie reel decoration */}
          <View style={styles.reelWrap}>
            <View style={styles.reelFilm}>
              {[0, 1, 2, 3, 4].map(i => (
                <View key={i} style={styles.reelHole} />
              ))}
            </View>
            <View style={styles.reelFrameRow}>
              {[0, 1, 2].map(i => (
                <View key={i} style={styles.reelFrame} />
              ))}
            </View>
            <View style={styles.reelFilm}>
              {[0, 1, 2, 3, 4].map(i => (
                <View key={i} style={styles.reelHole} />
              ))}
            </View>
          </View>

          <View style={styles.btnGroup}>
            <TouchableOpacity
              style={[styles.primaryBtn, gradientBtnStyle]}
              onPress={() =>
                router.push({ pathname: '/(auth)/sign-up', params: { sessionCode: codeParam } })
              }
              activeOpacity={0.85}
            >
              <Text style={styles.primaryBtnText}>create an account</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryBtn}
              onPress={() =>
                router.push({ pathname: '/(auth)/log-in', params: { sessionCode: codeParam } })
              }
              activeOpacity={0.8}
            >
              <Text style={styles.secondaryBtnText}>log in</Text>
            </TouchableOpacity>
          </View>
        </View>
      </PhoneFrame>
    );
  }

  // ── State B: logged in — joining ─────────────────────────────────────────

  return (
    <PhoneFrame>
      <View style={[styles.screen, styles.centered, { paddingTop: insets.top }]}>
        {joining ? (
          <>
            <ActivityIndicator color="#6D28D9" />
            <Text style={styles.joiningText}>joining session…</Text>
          </>
        ) : error ? (
          <>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity
              style={styles.homeBtn}
              onPress={() => router.replace('/(tabs)/decide')}
            >
              <Text style={styles.homeBtnText}>go home</Text>
            </TouchableOpacity>
          </>
        ) : null}
      </View>
    </PhoneFrame>
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
    letterSpacing: 6,
    textAlign: 'center',
  },
  invitedLabel: {
    fontSize: 13,
    fontWeight: '300',
    color: '#4C1D95',
    textAlign: 'center',
    marginTop: 8,
  },
  byLabel: {
    fontSize: 11,
    fontWeight: '300',
    color: '#A78BFA',
    textAlign: 'center',
    marginTop: 4,
  },

  // ── Movie reel ─────────────────────────────────────────────────────────────
  reelWrap: {
    marginVertical: 36,
    alignItems: 'center',
    gap: 4,
  },
  reelFilm: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 8,
  },
  reelHole: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#DDD6FE',
  },
  reelFrameRow: {
    flexDirection: 'row',
    gap: 6,
  },
  reelFrame: {
    width: 60,
    height: 44,
    borderRadius: 6,
    backgroundColor: '#EDE9FE',
  },

  // ── Buttons ────────────────────────────────────────────────────────────────
  btnGroup: {
    alignSelf: 'stretch',
    gap: 12,
  },
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
    letterSpacing: 0.5,
  },
  secondaryBtn: {
    height: 52,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#DDD6FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtnText: {
    color: '#7C3AED',
    fontSize: 15,
    fontWeight: '300',
    letterSpacing: 0.5,
  },

  joiningText: { fontSize: 13, fontWeight: '300', color: '#7C3AED' },
  errorText: {
    fontSize: 13,
    fontWeight: '300',
    color: '#E24B4A',
    textAlign: 'center',
  },
  homeBtn: {
    marginTop: 8,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#DDD6FE',
  },
  homeBtnText: { fontSize: 13, color: '#7C3AED' },
});
