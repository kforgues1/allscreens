import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import PhoneFrame from '../../components/PhoneFrame';
import { useTheme } from '../../context/ThemeContext';

const gradientBtnStyle =
  Platform.OS === 'web'
    ? ({ background: 'linear-gradient(135deg, #4C1D95, #7C3AED)' } as any)
    : { backgroundColor: '#6D28D9' };

export default function WelcomeScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <PhoneFrame>
      <View style={[styles.screen, { backgroundColor: colors.background }]}>

        <View style={[styles.body, { paddingTop: insets.top || 48 }]}>

          {/* Check circle */}
          <View style={styles.circleWrap}>
            <View style={styles.circle}>
              <Text style={styles.checkmark}>✓</Text>
            </View>
          </View>

          <View style={{ height: 36 }} />

          <Text style={styles.heading}>you're in.</Text>
          <View style={{ height: 10 }} />
          <Text style={styles.sub}>
            let's personalise your experience so we can find the perfect watch for your next movie night.
          </Text>

          <View style={{ height: 48 }} />

          <TouchableOpacity
            style={[styles.primaryBtn, gradientBtnStyle]}
            activeOpacity={0.85}
            onPress={() => router.replace('/(onboarding)/genres')}
          >
            <Text style={styles.primaryBtnText}>get started</Text>
          </TouchableOpacity>

          <View style={{ height: 14 }} />

          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => router.replace('/(tabs)/browse')}
          >
            <Text style={styles.skipText}>skip for now</Text>
          </TouchableOpacity>

        </View>

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
  checkmark: {
    fontSize: 32,
    color: '#FFFFFF',
    lineHeight: 38,
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
  primaryBtn: {
    height: 52,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '400',
    letterSpacing: 1,
  },
  skipText: {
    fontSize: 13,
    fontWeight: '300',
    color: '#A78BFA',
    letterSpacing: 1,
    textDecorationLine: 'underline',
  },
});
