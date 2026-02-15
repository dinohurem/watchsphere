import { View, Text, StyleSheet, TouchableOpacity, Image, Dimensions } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { ChevronRight, TriangleUp, TriangleDown } from './icons';

export interface WatchlistGridItem {
  id: string;
  brand: string;
  model: string;
  reference: string;
  ws_code?: string;
  price: number;
  priceChange: number;
  image: any; // require() image
}

interface WatchlistGridProps {
  watches: WatchlistGridItem[];
  onViewAll: () => void;
  onWatchPress?: (watchId: string) => void;
}

const SCREEN_WIDTH = Dimensions.get('window').width;
const CARD_GAP = 8;
const HORIZONTAL_PADDING = 16;
const CARD_WIDTH = (SCREEN_WIDTH - (HORIZONTAL_PADDING * 2) - CARD_GAP) / 2;

export function WatchlistGrid({ watches, onViewAll, onWatchPress }: WatchlistGridProps) {
  const { colors, fonts } = useTheme();
  // Show only first 4 watches for 2x2 grid
  const displayWatches = watches.slice(0, 4);

  const styles = StyleSheet.create({
    container: {
      paddingHorizontal: HORIZONTAL_PADDING,
      paddingVertical: 20,
      backgroundColor: '#FFFFFF',
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 16,
    },
    title: {
      fontSize: 17,
      fontFamily: fonts.semiBold,
      color: '#212121',
      lineHeight: 21,
      letterSpacing: 0.085,
    },
    viewAllButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
    },
    viewAllText: {
      fontSize: 15,
      fontFamily: fonts.medium,
      color: colors.primary,
    },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: CARD_GAP,
    },
    card: {
      width: CARD_WIDTH,
      backgroundColor: '#F8F8F8',
      borderRadius: 12,
      overflow: 'hidden',
    },
    imageContainer: {
      width: '100%',
      height: CARD_WIDTH * 0.9,
      backgroundColor: '#F8F8F8',
      justifyContent: 'center',
      alignItems: 'center',
    },
    watchImage: {
      width: '80%',
      height: '80%',
      resizeMode: 'contain',
    },
    cardContent: {
      padding: 10,
    },
    brandModel: {
      fontSize: 15,
      fontFamily: fonts.semiBold,
      color: colors.text,
      marginBottom: 2,
    },
    reference: {
      fontSize: 13,
      fontFamily: fonts.regular,
      color: colors.textSecondary,
      marginBottom: 6,
    },
    priceRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    price: {
      fontSize: 15,
      fontFamily: fonts.semiBold,
      color: colors.text,
    },
    changeContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
    },
    changeText: {
      fontSize: 13,
      fontFamily: fonts.medium,
    },
    changeUp: {
      color: '#4AA078',
    },
    changeDown: {
      color: '#CC6045',
    },
  });

  const formatPrice = (price: number) => {
    return `€${price.toLocaleString()}`;
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Watchlist</Text>
        <TouchableOpacity style={styles.viewAllButton} onPress={onViewAll}>
          <Text style={styles.viewAllText}>View all</Text>
          <ChevronRight size={14} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {/* 2x2 Grid */}
      <View style={styles.grid}>
        {displayWatches.map((watch) => {
          const isPositive = watch.priceChange > 0;
          return (
            <TouchableOpacity
              key={watch.id}
              style={styles.card}
              onPress={() => onWatchPress?.(watch.id)}
              activeOpacity={0.7}
            >
              <View style={styles.imageContainer}>
                <Image source={watch.image} style={styles.watchImage} />
              </View>
              <View style={styles.cardContent}>
                <Text style={styles.brandModel} numberOfLines={1}>
                  {watch.brand} {watch.model}
                </Text>
                <Text style={styles.reference} numberOfLines={1}>
                  {watch.ws_code || watch.reference}
                </Text>
                <View style={styles.priceRow}>
                  <Text style={styles.price}>{formatPrice(watch.price)}</Text>
                  <View style={styles.changeContainer}>
                    {isPositive ? (
                      <TriangleUp size={8} color="#4AA078" />
                    ) : (
                      <TriangleDown size={8} color="#CC6045" />
                    )}
                    <Text style={[styles.changeText, isPositive ? styles.changeUp : styles.changeDown]}>
                      {Math.abs(watch.priceChange).toFixed(1)}%
                    </Text>
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}
