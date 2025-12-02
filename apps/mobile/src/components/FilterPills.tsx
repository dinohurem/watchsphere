import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Filter } from './icons';
import { useTheme } from '@/contexts/ThemeContext';

interface FilterPillsProps {
  filters: string[];
  activeFilter: string;
  onFilterPress: (filter: string) => void;
  onFilterIconPress?: () => void;
}

export function FilterPills({ filters, activeFilter, onFilterPress, onFilterIconPress }: FilterPillsProps) {
  const { colors, fonts } = useTheme();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
    >
      {onFilterIconPress && (
        <TouchableOpacity style={styles.filterIcon} onPress={onFilterIconPress}>
          <Filter size={20} color="#000000" />
        </TouchableOpacity>
      )}
      {filters.map((filter) => (
        <TouchableOpacity
          key={filter}
          style={[styles.pill, filter === activeFilter && styles.pillActive]}
          onPress={() => onFilterPress(filter)}
        >
          <Text style={[styles.pillText, filter === activeFilter && styles.pillTextActive, { fontFamily: fonts.medium }]}>
            {filter}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    gap: 8,
  },
  filterIcon: {
    width: 48,
    height: 48,
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pill: {
    backgroundColor: '#F5F5F5',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    height: 48,
  },
  pillActive: {
    backgroundColor: '#000000',
  },
  pillText: {
    fontSize: 15,
    color: '#000000',
  },
  pillTextActive: {
    color: '#FFFFFF',
  },
});
