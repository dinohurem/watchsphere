import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';

export interface YearMonthSelection {
  year: number;
  month?: number; // 1-12, optional for year-only selection
}

interface YearMonthFilterProps {
  selectedPeriods: YearMonthSelection[];
  onTogglePeriod: (period: YearMonthSelection) => void;
  minYear?: number;
  maxYear?: number;
}

const MONTHS = [
  { value: 1, label: 'Jan' },
  { value: 2, label: 'Feb' },
  { value: 3, label: 'Mar' },
  { value: 4, label: 'Apr' },
  { value: 5, label: 'May' },
  { value: 6, label: 'Jun' },
  { value: 7, label: 'Jul' },
  { value: 8, label: 'Aug' },
  { value: 9, label: 'Sep' },
  { value: 10, label: 'Oct' },
  { value: 11, label: 'Nov' },
  { value: 12, label: 'Dec' },
];

export function YearMonthFilter({
  selectedPeriods,
  onTogglePeriod,
  minYear = 1950,
  maxYear = new Date().getFullYear(),
}: YearMonthFilterProps) {
  const { colors, fonts } = useTheme();
  const years = Array.from({ length: maxYear - minYear + 1 }, (_, i) => maxYear - i);

  const isPeriodSelected = (year: number, month?: number) => {
    return selectedPeriods.some(
      (p) => p.year === year && p.month === month
    );
  };

  return (
    <View style={styles.container}>
      <Text style={[styles.label, { fontFamily: fonts.semiBold }]}>Year</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        {years.map((year) => {
          const isSelected = isPeriodSelected(year, undefined);
          return (
            <TouchableOpacity
              key={year}
              style={[styles.yearButton, isSelected && styles.buttonActive]}
              onPress={() => onTogglePeriod({ year })}
            >
              <Text style={[styles.yearText, isSelected && styles.textActive, { fontFamily: fonts.medium }]}>
                {year}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <Text style={[styles.label, styles.monthLabel, { fontFamily: fonts.semiBold }]}>Month (Optional)</Text>
      <View style={styles.monthGrid}>
        {MONTHS.map((month) => {
          // For month selection, we need a year context - using current year as default
          const currentYear = new Date().getFullYear();
          const isSelected = selectedPeriods.some(
            (p) => p.month === month.value
          );
          return (
            <TouchableOpacity
              key={month.value}
              style={[styles.monthButton, isSelected && styles.buttonActive]}
              onPress={() => onTogglePeriod({ year: currentYear, month: month.value })}
            >
              <Text style={[styles.monthText, isSelected && styles.textActive, { fontFamily: fonts.medium }]}>
                {month.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 8,
  },
  label: {
    fontSize: 14,
    color: '#000000',
    marginBottom: 8,
  },
  monthLabel: {
    marginTop: 16,
  },
  scrollView: {
    marginBottom: 8,
  },
  scrollContent: {
    gap: 8,
    paddingRight: 16,
  },
  yearButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  yearText: {
    fontSize: 14,
    color: '#000000',
  },
  monthGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  monthButton: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#E5E5EA',
    minWidth: 60,
    alignItems: 'center',
  },
  monthText: {
    fontSize: 13,
    color: '#000000',
  },
  buttonActive: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  textActive: {
    color: '#FFFFFF',
  },
});
