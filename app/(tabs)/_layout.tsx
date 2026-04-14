import { Tabs } from 'expo-router';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePathname, router } from 'expo-router';
import PhoneFrame from '../../components/PhoneFrame';
import Svg, { Circle, Rect, Line, Path } from 'react-native-svg';

type TabId = 'explore' | 'decide' | 'profile';

const TAB_BAR_HEIGHT = 72;

// ── SVG Icons ─────────────────────────────────────────────────────────────────

function ExploreIcon({ color }: { color: string }) {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      {/* Three stacked rows, left-aligned */}
      <Rect x={3} y={4}    width={13} height={3.5} rx={1.2} stroke={color} strokeWidth={1.4} />
      <Rect x={3} y={10.5} width={13} height={3.5} rx={1.2} stroke={color} strokeWidth={1.4} />
      <Rect x={3} y={17}   width={8}  height={3.5} rx={1.2} stroke={color} strokeWidth={1.4} />
      {/* Magnifying glass bottom-right */}
      <Circle cx={17.5} cy={17.5} r={3.2} stroke={color} strokeWidth={1.4} />
      <Line x1={19.8} y1={19.8} x2={22} y2={22} stroke={color} strokeWidth={1.4} strokeLinecap="round" />
    </Svg>
  );
}

function DecideIcon() {
  // Always white — sits on purple button
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={9} stroke="white" strokeWidth={1.4} />
      <Path d="M10 8.5 L16 12 L10 15.5 Z" fill="white" />
    </Svg>
  );
}

function ProfileIcon({ color, active }: { color: string; active: boolean }) {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      {/* Head */}
      <Circle
        cx={12} cy={8} r={3.5}
        stroke={color} strokeWidth={1.4}
        fill={active ? color : 'none'}
      />
      {/* Shoulders */}
      <Path
        d="M5 20 C5 15.5 8.5 13 12 13 C15.5 13 19 15.5 19 20"
        stroke={color} strokeWidth={1.4} strokeLinecap="round" fill="none"
      />
    </Svg>
  );
}

// ── Custom tab bar ─────────────────────────────────────────────────────────────

function CustomTabBar() {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();

  const active = (id: TabId): boolean => pathname.includes(id);

  return (
    <View style={[styles.bar, { paddingBottom: insets.bottom || 16 }]}>
      {/* Explore */}
      <TouchableOpacity
        style={styles.tab}
        onPress={() => router.replace('/(tabs)/explore')}
        activeOpacity={0.7}
      >
        <ExploreIcon color={active('explore') ? '#7C3AED' : '#C4B5FD'} />
        <Text style={[styles.tabLabel, active('explore') && styles.tabLabelActive]}>explore</Text>
      </TouchableOpacity>

      {/* Decide — elevated centre */}
      <View style={styles.centerWrap}>
        <TouchableOpacity
          style={[styles.centerBtn, Platform.OS === 'web' && { background: 'linear-gradient(135deg, #4C1D95, #7C3AED)' } as any]}
          onPress={() => router.replace('/(tabs)/decide')}
          activeOpacity={0.85}
        >
          <DecideIcon />
        </TouchableOpacity>
        <Text style={[styles.tabLabel, active('decide') && styles.tabLabelActive, { marginTop: 4 }]}>
          decide
        </Text>
      </View>

      {/* Profile */}
      <TouchableOpacity
        style={styles.tab}
        onPress={() => router.replace('/(tabs)/profile')}
        activeOpacity={0.7}
      >
        <ProfileIcon color={active('profile') ? '#7C3AED' : '#C4B5FD'} active={active('profile')} />
        <Text style={[styles.tabLabel, active('profile') && styles.tabLabelActive]}>profile</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function TabsLayout() {
  return (
    <PhoneFrame>
      <Tabs
        screenOptions={{ headerShown: false }}
        tabBar={() => <CustomTabBar />}
      >
        <Tabs.Screen name="explore" />
        <Tabs.Screen name="decide" />
        <Tabs.Screen name="browse" />
        <Tabs.Screen name="profile" />
      </Tabs>
    </PhoneFrame>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-around',
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#EDE9FE',
    minHeight: TAB_BAR_HEIGHT,
    paddingTop: 10,
    paddingHorizontal: 16,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingBottom: 4,
    gap: 2,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '300',
    color: '#C4B5FD',
    letterSpacing: 1,
    marginTop: 2,
  },
  tabLabelActive: {
    color: '#7C3AED',
    fontWeight: '400',
  },

  // ── Centre decide button ──────────────────────────────────────────────────────
  centerWrap: {
    flex: 1,
    alignItems: 'center',
    marginBottom: Platform.OS === 'ios' ? 4 : 0,
  },
  centerBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#6D28D9',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -20,
  },
});
