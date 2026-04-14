import { View, ActivityIndicator } from 'react-native';

// NavController in app/_layout.tsx handles all auth-based redirects.
// This screen shows briefly while the initial auth + Firestore check resolves.
export default function Index() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F5F3FF' }}>
      <ActivityIndicator color="#7C3AED" size="large" />
    </View>
  );
}
