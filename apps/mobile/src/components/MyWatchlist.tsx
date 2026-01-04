import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { WatchlistCard, WatchlistItemData } from './WatchlistCard';
import { ChevronRight, Heart } from './icons';
import { wp, hp, sp, fp } from '@/utils/responsive';

interface MyWatchlistProps {
  watches: WatchlistItemData[];
  onViewAll: () => void;
  onWatchPress?: (watchId: string) => void;
}

// Get 30% of screen height
const SCREEN_HEIGHT = Dimensions.get('window').height;
const WATCHLIST_HEIGHT = SCREEN_HEIGHT * 0.3;

export function MyWatchlist({ watches, onViewAll, onWatchPress }: MyWatchlistProps) {
  const { colors, fonts } = useTheme();
  // Show only first 3 watches
  const displayWatches = watches.slice(0, 3);

  const styles = StyleSheet.create({
    container: {
      paddingHorizontal: wp(16),
      paddingVertical: hp(20),
      backgroundColor: '#FFFFFF',
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: hp(16),
    },
    title: {
      fontSize: fp(16),
      fontFamily: fonts.semiBold,
      color: '#212121',
      lineHeight: fp(20),
      letterSpacing: 0.08,
    },
    viewAllButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: wp(2),
    },
    viewAllText: {
      fontSize: fp(13),
      fontFamily: fonts.medium,
      color: colors.primary,
    },
    watchlistColumn: {
      gap: hp(12),
    },
    emptyState: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: hp(32),
      paddingHorizontal: wp(24),
    },
    emptyIconContainer: {
      width: sp(64),
      height: sp(64),
      borderRadius: sp(32),
      backgroundColor: 'rgba(33, 33, 33, 0.05)',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: hp(16),
    },
    emptyTitle: {
      fontSize: fp(17),
      fontFamily: fonts.semiBold,
      color: '#212121',
      marginBottom: hp(8),
      textAlign: 'center',
    },
    emptySubtitle: {
      fontSize: fp(14),
      fontFamily: fonts.regular,
      color: 'rgba(33, 33, 33, 0.6)',
      textAlign: 'center',
      lineHeight: fp(20),
    },
  });

  return (
    <View style={[styles.container, { minHeight: WATCHLIST_HEIGHT }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Watchlist</Text>
        <TouchableOpacity style={styles.viewAllButton} onPress={onViewAll}>
          <Text style={styles.viewAllText}>View All</Text>
          <ChevronRight size={14} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Watchlist Items or Empty State */}
      {displayWatches.length > 0 ? (
        <View style={styles.watchlistColumn}>
          {displayWatches.map((watch) => (
            <WatchlistCard
              key={watch.id}
              watch={watch}
              onPress={() => onWatchPress?.(watch.id)}
            />
          ))}
        </View>
      ) : (
        <View style={styles.emptyState}>
          <View style={styles.emptyIconContainer}>
            <Heart size={28} color="rgba(33, 33, 33, 0.4)" />
          </View>
          <Text style={styles.emptyTitle}>Your watchlist is empty</Text>
          <Text style={styles.emptySubtitle}>
            Start tracking watches to monitor their prices and market trends
          </Text>
        </View>
      )}
    </View>
  );
}
