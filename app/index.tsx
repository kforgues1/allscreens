import { View, ActivityIndicator } from 'react-native';

/**
 * Root index — shown briefly while Firebase resolves auth state.
 * _layout.tsx will navigate away (to auth or tabs) once onAuthStateChanged fires.
 */
export default function Index() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F5F3FF' }}>
      <ActivityIndicator color="#7C3AED" size="large" />
    </View>
  );
}
