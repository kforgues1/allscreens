import { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { saveOnboardingData } from '../../lib/userProfile';
import { GENRES } from '../../constants/genres';
import ProgressBar from '../../components/ProgressBar';
import { useTheme } from '../../context/ThemeContext';

const gradientBtnStyle =
  Platform.OS === 'web'
    ? ({ background: 'linear-gradient(135deg, #4C1D95, #7C3AED)' } as any)
    : { backgroundColor: '#6D28D9' };

export default function GenresScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

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
      router.push('/(onboarding)/movies');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>

      <View style={[styles.header, { paddingTop: insets.top || 24 }]}>
        <ProgressBar step={1} />
        <View style={{ height: 24 }} />
        <Text style={styles.step}>step 1 of 4</Text>
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
