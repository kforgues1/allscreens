import { View, StyleSheet } from 'react-native';

interface Props {
  step: 1 | 2 | 3 | 4;
}

export default function ProgressBar({ step }: Props) {
  return (
    <View style={styles.row}>
      {[1, 2, 3, 4].map((s) => (
        <View
          key={s}
          style={[
            styles.segment,
            s <= step ? styles.active : styles.inactive,
            s < 4 && styles.gap,
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    height: 3,
  },
  segment: {
    flex: 1,
    borderRadius: 2,
  },
  gap: {
    marginRight: 6,
  },
  active: {
    backgroundColor: '#7C3AED',
  },
  inactive: {
    backgroundColor: '#DDD6FE',
  },
});
