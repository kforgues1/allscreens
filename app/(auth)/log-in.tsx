import { View } from 'react-native';
import { useTheme } from '../../context/ThemeContext';

// Placeholder — will be built next
export default function LogInScreen() {
  const { colors } = useTheme();
  return <View style={{ flex: 1, backgroundColor: colors.background }} />;
}
