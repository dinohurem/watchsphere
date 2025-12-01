import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';

export type WareCondition = 'worn' | 'unworn';

interface WareConditionFilterProps {
  selectedConditions: WareCondition[];
  onToggleCondition: (condition: WareCondition) => void;
}

const conditionData: Record<WareCondition, { label: string; description: string }> = {
  unworn: { label: 'Unworn', description: 'Never worn or used' },
  worn: { label: 'Worn', description: 'Previously worn' },
};

export function WareConditionFilter({
  selectedConditions,
  onToggleCondition,
}: WareConditionFilterProps) {
  const { colors, fonts } = useTheme();
  const conditions: WareCondition[] = ['unworn', 'worn'];

  return (
    <View style={styles.container}>
      {conditions.map((condition) => {
        const isSelected = selectedConditions.includes(condition);
        const { label, description } = conditionData[condition];

        return (
          <TouchableOpacity
            key={condition}
            style={[styles.conditionButton, isSelected && styles.conditionButtonActive]}
            onPress={() => onToggleCondition(condition)}
          >
            <View style={styles.conditionContent}>
              <Text style={[styles.conditionLabel, isSelected && styles.conditionLabelActive, { fontFamily: fonts.semiBold }]}>
                {label}
              </Text>
              <Text style={[styles.conditionDescription, isSelected && styles.conditionDescriptionActive, { fontFamily: fonts.regular }]}>
                {description}
              </Text>
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 8,
  },
  conditionButton: {
    flex: 1,
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#F5F5F5',
    borderWidth: 2,
    borderColor: '#E5E5EA',
  },
  conditionButtonActive: {
    backgroundColor: '#E3F2FF',
    borderColor: '#007AFF',
  },
  conditionContent: {
    alignItems: 'center',
  },
  conditionLabel: {
    fontSize: 16,
    color: '#000000',
    marginBottom: 4,
  },
  conditionLabelActive: {
    color: '#007AFF',
  },
  conditionDescription: {
    fontSize: 12,
    color: '#8E8E93',
    textAlign: 'center',
  },
  conditionDescriptionActive: {
    color: '#007AFF',
  },
});
