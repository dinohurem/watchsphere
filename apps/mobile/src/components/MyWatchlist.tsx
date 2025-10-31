import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { WatchlistCard, WatchlistItemData } from './WatchlistCard';
import { ChevronRight } from './icons';

interface MyWatchlistProps {
  watches: WatchlistItemData[];
  onViewAll: () => void;
  onWatchPress?: (watchId: string) => void;
}

// Get 30% of screen height
const SCREEN_HEIGHT = Dimensions.get('window').height;
const WATCHLIST_HEIGHT = SCREEN_HEIGHT * 0.3;

export function MyWatchlist({ watches, onViewAll, onWatchPress }: MyWatchlistProps) {
  const { colors } = useTheme();
  // Show only first 3 watches
  const displayWatches = watches.slice(0, 3);

  const styles = StyleSheet.create({
    container: {
      paddingHorizontal: 16,
      paddingVertical: 20,
      backgroundColor: colors.backgroundSecondary,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 16,
    },
    title: {
      fontSize: 20,
      fontWeight: '600',
      color: colors.text,
    },
    viewAllButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
    },
    viewAllText: {
      fontSize: 13,
      fontWeight: '500',
      color: colors.primary,
    },
    watchlistColumn: {
      gap: 12,
    },
  });

  return (
    <View style={[styles.container, { minHeight: WATCHLIST_HEIGHT }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>My Watchlist</Text>
        <TouchableOpacity style={styles.viewAllButton} onPress={onViewAll}>
          <Text style={styles.viewAllText}>View All</Text>
          <ChevronRight size={14} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Watchlist Items - Column layout */}
      <View style={styles.watchlistColumn}>
        {displayWatches.map((watch) => (
          <WatchlistCard
            key={watch.id}
            watch={watch}
            onPress={() => onWatchPress?.(watch.id)}
          />
        ))}
      </View>
    </View>
  );
}
