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
  const { colors, fonts } = useTheme();
  const hasPositiveChange = watch.priceChange >= 0;
  const chartColor = hasPositiveChange ? colors.success : colors.error;
  const formattedPrice = `€${watch.price.toLocaleString()}`;

  const styles = StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: 'transparent',
      paddingVertical: 16,
      paddingHorizontal: 0,
    },
    leftSection: {
      flex: 1,
      marginRight: 12,
    },
    name: {
      fontSize: 15,
      fontFamily: fonts.semiBold,
      color: colors.text,
      marginBottom: 2,
    },
    code: {
      fontSize: 13,
      fontFamily: fonts.regular,
      color: colors.textTertiary,
    },
    chartContainer: {
      marginHorizontal: 12,
    },
    rightSection: {
      alignItems: 'flex-end',
    },
    priceRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      marginBottom: 2,
    },
    fromLabel: {
      fontSize: 13,
      fontFamily: fonts.regular,
      color: colors.textTertiary,
    },
    price: {
      fontSize: 15,
      fontFamily: fonts.semiBold,
      color: colors.text,
    },
    priceChange: {
      fontSize: 13,
      fontFamily: fonts.medium,
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
        <Text style={[styles.priceChange, hasPositiveChange ? styles.priceUp : styles.priceDown]}>
          {hasPositiveChange ? '▲' : '▼'} {Math.abs(watch.priceChange).toFixed(1)}%
        </Text>
      </View>
    </TouchableOpacity>
  );
}
