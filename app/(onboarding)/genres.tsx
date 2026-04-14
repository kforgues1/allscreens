import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { doc, getDoc } from 'firebase/firestore';
import { useAuth } from '../../context/AuthContext';
import { saveOnboardingData } from '../../lib/userProfile';
import { GENRES } from '../../constants/genres';
import { useTheme } from '../../context/ThemeContext';
import { db } from '../../lib/firebase';

const gradientBtnStyle =
  Platform.OS === 'web'
    ? ({ background: 'linear-gradient(135deg, #4C1D95, #7C3AED)' } as any)
    : { backgroundColor: '#6D28D9' };

export default function GenresScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { edit } = useLocalSearchParams<{ edit?: string }>();
  const isEdit = edit === '1';

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [initialising, setInitialising] = useState(isEdit);

  // In edit mode, pre-populate with the user's saved genres
  useEffect(() => {
    if (!isEdit || !user) { setInitialising(false); return; }
    getDoc(doc(db, 'users', user.uid))
      .then(snap => {
        const saved: string[] = snap.data()?.genres ?? [];
        setSelected(new Set(saved));
      })
      .catch(() => {})
      .finally(() => setInitialising(false));
  }, [isEdit, user?.uid]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleNext = async () => {
    if (!user || selected.size === 0) return;
    setLoading(true);
    try {
      await saveOnboardingData(user.uid, { genres: Array.from(selected) });
      router.push(
        isEdit
          ? { pathname: '/(onboarding)/streaming', params: { edit: '1' } }
          : '/(onboarding)/movies',
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = () => {
    // Skip without saving — go to streaming in edit mode (keep old selections)
    router.push({ pathname: '/(onboarding)/streaming', params: { edit: '1' } });
  };


  if (initialising) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator color="#6D28D9" />
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>

      <View style={[styles.header, { paddingTop: insets.top || 24 }]}>
        <View style={styles.progressRow}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.backArrow}>←</Text>
          </TouchableOpacity>
          <View style={styles.segmentBarRow}>
            {[1,2,3,4].map(i => (
              <View key={i} style={[styles.segmentBar, i <= 1 ? styles.segmentBarFilled : styles.segmentBarEmpty]} />
            ))}
          </View>
        </View>
        <Text style={styles.step}>{isEdit ? 'edit profile' : 'step 1 of 4'}</Text>
        <View style={{ height: 6 }} />
        <Text style={styles.heading}>what do you like to watch?</Text>
        <View style={{ height: 6 }} />
        <Text style={styles.sub}>pick as many as you want</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.pills}>
          {GENRES.map((g) => {
            const active = selected.has(g.id);
            return (
              <TouchableOpacity
                key={g.id}
                style={[styles.pill, active && styles.pillActive]}
                activeOpacity={0.75}
                onPress={() => toggle(g.id)}
              >
                <Text style={[styles.pillText, active && styles.pillTextActive]}>
                  {g.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <View style={{ height: 120 }} />
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: (insets.bottom || 0) + 24 }]}>
        {isEdit && (
          <TouchableOpacity style={styles.skipLink} onPress={handleSkip} activeOpacity={0.7}>
            <Text style={styles.skipText}>skip</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[
            styles.nextBtn,
            gradientBtnStyle,
            selected.size === 0 && styles.nextBtnDisabled,
          ]}
          activeOpacity={0.85}
          onPress={handleNext}
          disabled={loading || selected.size === 0}
        >
          {loading
            ? <ActivityIndicator color="#FFFFFF" />
            : <Text style={styles.nextBtnText}>next</Text>}
        </TouchableOpacity>
      </View>

    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    paddingHorizontal: 28,
    paddingBottom: 16,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 20,
  },
  backArrow: {
    fontSize: 16,
    fontWeight: '300',
    color: '#A78BFA',
    width: 24,
  },
  segmentBarRow: {
    flex: 1,
    flexDirection: 'row',
    gap: 4,
  },
  segmentBar: {
    flex: 1,
    height: 3,
    borderRadius: 6,
  },
  segmentBarFilled: { backgroundColor: '#6D28D9' },
  segmentBarEmpty: { backgroundColor: '#DDD6FE' },
  step: {
    fontSize: 11,
    fontWeight: '300',
    color: '#A78BFA',
    letterSpacing: 2,
  },
  heading: {
    fontSize: 22,
    fontWeight: '200',
    color: '#4C1D95',
    letterSpacing: 1,
  },
  sub: {
    fontSize: 13,
    fontWeight: '300',
    color: '#7C3AED',
    letterSpacing: 0.5,
  },
  scrollContent: {
    paddingTop: 8,
  },
  pills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignContent: 'flex-start',
    paddingHorizontal: 20,
  },
  pill: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#DDD6FE',
    backgroundColor: '#FFFFFF',
    margin: 5,
  },
  pillActive: {
    backgroundColor: '#7C3AED',
    borderColor: '#7C3AED',
  },
  pillText: {
    fontSize: 13,
    fontWeight: '300',
    color: '#4C1D95',
    letterSpacing: 0.5,
  },
  pillTextActive: {
    color: '#FFFFFF',
    fontWeight: '400',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 28,
    paddingTop: 16,
    backgroundColor: 'rgba(243,240,255,0.95)',
    gap: 10,
  },
  skipLink: {
    alignItems: 'center',
  },
  skipText: {
    fontSize: 13,
    fontWeight: '300',
    color: '#7C3AED',
    textDecorationLine: 'underline',
  },
  nextBtn: {
    height: 52,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextBtnDisabled: {
    opacity: 0.45,
  },
  nextBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '400',
    letterSpacing: 1,
  },
});
