import { Tabs } from 'expo-router';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePathname, router } from 'expo-router';
import PhoneFrame from '../../components/PhoneFrame';

type TabId = 'explore' | 'decide' | 'profile';

const TAB_BAR_HEIGHT = 72;

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
        <Text style={[styles.tabIcon, active('explore') && styles.tabIconActive]}>⚡</Text>
        <Text style={[styles.tabLabel, active('explore') && styles.tabLabelActive]}>explore</Text>
      </TouchableOpacity>

      {/* Decide — elevated centre */}
      <View style={styles.centerWrap}>
        <TouchableOpacity
          style={styles.centerBtn}
          onPress={() => router.replace('/(tabs)/decide')}
          activeOpacity={0.85}
        >
          <Text style={styles.centerIcon}>▶</Text>
        </TouchableOpacity>
        <Text style={[styles.tabLabel, active('decide') && styles.tabLabelActive, { marginTop: 4 }]}>
          browse
        </Text>
      </View>

      {/* Profile */}
      <TouchableOpacity
        style={styles.tab}
        onPress={() => router.replace('/(tabs)/profile')}
        activeOpacity={0.7}
      >
        <Text style={[styles.tabIcon, active('profile') && styles.tabIconActive]}>◎</Text>
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
  },
  tabIcon: {
    fontSize: 20,
    color: '#DDD6FE',
  },
  tabIconActive: {
    color: '#7C3AED',
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

  // ── Centre browse button ─────────────────────────────────────────────────────
  centerWrap: {
    flex: 1,
    alignItems: 'center',
    marginBottom: Platform.OS === 'ios' ? 4 : 0,
  },
  centerBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#7C3AED',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 0,
    // lifted above bar
    marginTop: -20,
  },
  centerIcon: {
    fontSize: 18,
    color: '#FFFFFF',
    marginLeft: 2, // optical centering for play icon
  },
});
