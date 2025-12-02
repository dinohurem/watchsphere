import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';

interface StatItem {
  label: string;
  value: string;
}

interface StatsCardProps {
  stats: StatItem[];
}

export function StatsCard({ stats }: StatsCardProps) {
  const { colors, fonts } = useTheme();

  return (
    <View style={styles.container}>
      {stats.map((stat, index) => (
        <View key={stat.label}>
          {index > 0 && <View style={styles.divider} />}
          <View style={styles.statItem}>
            <Text style={[styles.label, { fontFamily: fonts.regular }]}>{stat.label}</Text>
            <Text style={[styles.value, { fontFamily: fonts.semiBold }]}>{stat.value}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  divider: {
    width: 1,
    backgroundColor: '#E5E5EA',
    marginHorizontal: 12,
  },
  label: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 4,
  },
  value: {
    fontSize: 16,
    color: '#000000',
  },
});
