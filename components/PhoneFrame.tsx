import { Platform, View, StyleSheet, useWindowDimensions } from 'react-native';

/**
 * On native: renders children directly with no wrapper.
 * On real mobile web (width ≤ 480): renders children directly, filling the screen.
 * On desktop web: renders children inside a 390×844 iOS device frame
 * centred on an #E9E4FF lavender background.
 */
export default function PhoneFrame({ children }: { children: React.ReactNode }) {
  const { width } = useWindowDimensions();
  const isRealMobile = Platform.OS === 'web' && width <= 480;

  if (Platform.OS !== 'web' || isRealMobile) return <>{children}</>;

  return (
    <View style={styles.webBg}>
      <View style={styles.frame}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  webBg: {
    flex: 1,
    backgroundColor: '#E9E4FF',
    alignItems: 'center',
    justifyContent: 'center',
    ...(Platform.OS === 'web' ? { overscrollBehavior: 'none' } : {}),
  } as any,
  frame: {
    width: 390,
    height: 844,
    borderRadius: 44,
    borderWidth: 1,
    borderColor: '#DDD6FE',
    overflow: 'hidden',
  },
});
