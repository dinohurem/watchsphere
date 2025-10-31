import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { MiniPriceChart } from './MiniPriceChart';

export interface WatchlistItemData {
  id: string;
  name: string; // e.g., "Rolex Submariner"
  code: string; // Reference number
  price: number;
  priceChange: number; // Percentage
  priceHistory: number[];
}

interface WatchlistCardProps {
  watch: WatchlistItemData;
  onPress?: () => void;
}

export function WatchlistCard({ watch, onPress }: WatchlistCardProps) {
  const { colors } = useTheme();
  const hasPositiveChange = watch.priceChange > 0;
  const chartColor = hasPositiveChange ? colors.success : colors.error;
  const formattedPrice = `€${watch.price.toLocaleString()}`;

  const styles = StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: 14,
      borderWidth: 1,
      borderColor: colors.border,
    },
    leftSection: {
      flex: 1,
      marginRight: 12,
    },
    name: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 2,
    },
    code: {
      fontSize: 12,
      fontWeight: '400',
      color: colors.textTertiary,
    },
    chartContainer: {
      marginHorizontal: 12,
    },
    rightSection: {
      alignItems: 'flex-end',
    },
    price: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 2,
    },
    priceChange: {
      fontSize: 12,
      fontWeight: '500',
    },
    priceUp: {
      color: colors.success,
    },
    priceDown: {
      color: colors.error,
    },
  });

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.leftSection}>
        <Text style={styles.name} numberOfLines={1}>
          {watch.name}
        </Text>
        <Text style={styles.code}>{watch.code}</Text>
      </View>

      <View style={styles.chartContainer}>
        <MiniPriceChart
          data={watch.priceHistory}
          width={80}
          height={30}
          color={chartColor}
        />
      </View>

      <View style={styles.rightSection}>
        <Text style={styles.price}>{formattedPrice}</Text>
        <Text style={[styles.priceChange, hasPositiveChange ? styles.priceUp : styles.priceDown]}>
          {hasPositiveChange ? '▲' : '▼'} {Math.abs(watch.priceChange).toFixed(1)}%
        </Text>
      </View>
    </TouchableOpacity>
  );
}
