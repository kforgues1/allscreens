import { Platform, View, StyleSheet } from 'react-native';

/**
 * On web: renders children inside a 390×844 iOS device frame
 * centred on an #E9E4FF lavender background.
 * On native: renders children directly with no wrapper.
 */
export default function PhoneFrame({ children }: { children: React.ReactNode }) {
  if (Platform.OS !== 'web') return <>{children}</>;

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
  },
  frame: {
    width: 390,
    height: 844,
    borderRadius: 44,
    borderWidth: 1,
    borderColor: '#DDD6FE',
    overflow: 'hidden',
  },
});
