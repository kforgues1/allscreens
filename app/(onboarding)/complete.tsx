import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { completeOnboarding } from '../../lib/userProfile';
import { useTheme } from '../../context/ThemeContext';

const gradientBtnStyle =
  Platform.OS === 'web'
    ? ({ background: 'linear-gradient(135deg, #4C1D95, #7C3AED)' } as any)
    : { backgroundColor: '#6D28D9' };

export default function CompleteScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);

  const handleFinish = async () => {
    if (!user) return;
    setLoading(true);
    try {
      await completeOnboarding(user.uid);
      router.replace('/(tabs)/browse');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>

      <View style={[styles.topBar, { paddingTop: insets.top || 24 }]}>
        <View style={styles.progressRow}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.backArrow}>←</Text>
          </TouchableOpacity>
          <View style={styles.segmentBarRow}>
            {[1,2,3,4].map(i => (
              <View key={i} style={[styles.segmentBar, styles.segmentBarFilled]} />
            ))}
          </View>
        </View>
      </View>

      <View style={styles.body}>
        <View style={styles.circleWrap}>
          <View style={styles.circle}>
            <Text style={styles.icon}>🎬</Text>
          </View>
        </View>

        <View style={{ height: 36 }} />

        <Text style={styles.heading}>all set.</Text>
        <View style={{ height: 10 }} />
        <Text style={styles.sub}>
          your taste profile is ready. time to find something to watch.
        </Text>
      </View>

      <View style={[styles.footer, { paddingBottom: (insets.bottom || 0) + 24 }]}>
        <TouchableOpacity
          style={[styles.nextBtn, gradientBtnStyle]}
          activeOpacity={0.85}
          onPress={handleFinish}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator color="#FFFFFF" />
            : <Text style={styles.nextBtnText}>let's go</Text>}
        </TouchableOpacity>
      </View>

    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  topBar: {
    paddingHorizontal: 28,
    paddingBottom: 0,
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
  body: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  circleWrap: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#EDE9FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  circle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#7C3AED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    fontSize: 32,
  },
  heading: {
    fontSize: 36,
    fontWeight: '200',
    color: '#4C1D95',
    letterSpacing: 4,
    textAlign: 'center',
  },
  sub: {
    fontSize: 14,
    fontWeight: '300',
    color: '#7C3AED',
    textAlign: 'center',
    lineHeight: 22,
    letterSpacing: 0.3,
  },
  footer: {
    paddingHorizontal: 28,
    paddingTop: 16,
  },
  nextBtn: {
    height: 52,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '400',
    letterSpacing: 1,
  },
});
