import { ScrollView, TouchableOpacity, Text, StyleSheet } from 'react-native';

interface TimeRangeSelectorProps {
  ranges: string[];
  activeRange: string;
  onRangeSelect: (range: string) => void;
}

export function TimeRangeSelector({ ranges, activeRange, onRangeSelect }: TimeRangeSelectorProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
    >
      {ranges.map((range) => (
        <TouchableOpacity
          key={range}
          style={[styles.button, range === activeRange && styles.buttonActive]}
          onPress={() => onRangeSelect(range)}
        >
          <Text style={[styles.text, range === activeRange && styles.textActive]}>
            {range}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 8,
  },
  button: {
    backgroundColor: '#F5F5F5',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
    height: 40,
    justifyContent: 'center',
  },
  buttonActive: {
    backgroundColor: '#000000',
  },
  text: {
    fontSize: 14,
    fontWeight: '500',
    color: '#000000',
  },
  textActive: {
    color: '#FFFFFF',
  },
});
