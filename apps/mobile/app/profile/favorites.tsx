import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useState, useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { wp, hp, sp, fp } from '@/utils/responsive';
import { LinearGradient } from 'expo-linear-gradient';
import { api } from '@/services/api';
import { LogoIcon } from '@/components/LogoIcon';

// Back Arrow Icon (Chevron Left)
function ChevronLeftIcon() {
  return (
    <Svg width={sp(24)} height={sp(24)} viewBox="0 0 24 24" fill="none">
      <Path
        d="M15 18L9 12L15 6"
        stroke="#1D1D1F"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

// Trend Up Icon
function TrendUpIcon() {
  return (
    <Svg width={sp(12)} height={sp(12)} viewBox="0 0 12 12" fill="none">
      <Path
        d="M1 8.5L4.5 5L7 7.5L11 3.5"
        stroke="#4AA078"
        strokeWidth={1.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M8 3.5H11V6.5"
        stroke="#4AA078"
        strokeWidth={1.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

// Trend Down Icon
function TrendDownIcon() {
  return (
    <Svg width={sp(12)} height={sp(12)} viewBox="0 0 12 12" fill="none">
      <Path
        d="M1 3.5L4.5 7L7 4.5L11 8.5"
        stroke="#C93927"
        strokeWidth={1.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M8 8.5H11V5.5"
        stroke="#C93927"
        strokeWidth={1.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

// Heart Icon for Empty State
function HeartIcon() {
  return (
    <Svg width={sp(28)} height={sp(28)} viewBox="0 0 24 24" fill="none">
      <Path
        d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"
        stroke="rgba(33, 33, 33, 0.4)"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

interface FavoriteWatch {
  id: string;
  brand: string;
  reference: string;
  price: string;
  change: string;
  isPositive: boolean;
  image: string;
}

export default function FavoritesScreen() {
  const [favorites, setFavorites] = useState<FavoriteWatch[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      loadFavorites();
    }, [])
  );

  const loadFavorites = async () => {
    try {
      setLoading(true);
      const response = await api.get('/profile/watchlist');
      if (response.data && Array.isArray(response.data)) {
        const formattedWatches: FavoriteWatch[] = response.data.map((item: any) => ({
          id: item.id || item._id,
          brand: `${item.brand} ${item.model}`.trim(),
          reference: item.reference || '',
          price: item.target_price ? `${item.target_price.toLocaleString('de-DE')}€` : '0€',
          change: item.price_change ? `${Math.abs(item.price_change).toFixed(1).replace('.', ',')}%` : '0%',
          isPositive: (item.price_change || 0) >= 0,
          image: item.image || item.cover_image || '',
        }));
        setFavorites(formattedWatches);
      }
    } catch (error) {
      console.error('Failed to load favorites:', error);
      setFavorites([]);
    } finally {
      setLoading(false);
    }
  };

  const renderWatchCard = (watch: FavoriteWatch, isSingleItem: boolean = false) => (
    <TouchableOpacity
      key={watch.id}
      style={[styles.watchCard, isSingleItem && styles.watchCardHalf]}
      onPress={() => router.push({
        pathname: '/market/[id]',
        params: {
          id: encodeURIComponent(watch.reference || watch.id),
          reference: watch.reference,
          brand: watch.brand,
        },
      } as any)}
      activeOpacity={0.8}
    >
      <View style={styles.watchImageContainer}>
        <LinearGradient
          colors={['#FFFFFF', '#F4F4F4']}
          style={styles.watchImageGradient}
        >
          {watch.image ? (
            <Image
              source={{ uri: watch.image }}
              style={styles.watchImage}
              resizeMode="contain"
            />
          ) : (
            <LogoIcon size={sp(48)} color="rgba(33, 33, 33, 0.15)" />
          )}
        </LinearGradient>
      </View>

      <View style={styles.watchInfo}>
        <View style={styles.watchNameContainer}>
          <Text style={styles.watchBrand} numberOfLines={1}>{watch.brand}</Text>
          <Text style={styles.watchReference} numberOfLines={1}>{watch.reference}</Text>
        </View>

        <View style={styles.watchPriceRow}>
          <Text style={styles.watchPrice}>{watch.price}</Text>
          <View style={[
            styles.changeBadge,
            { backgroundColor: watch.isPositive ? 'rgba(74, 160, 120, 0.05)' : 'rgba(201, 57, 39, 0.05)' }
          ]}>
            {watch.isPositive ? <TrendUpIcon /> : <TrendDownIcon />}
            <Text style={[
              styles.changeText,
              { color: watch.isPositive ? '#4AA078' : '#C93927' }
            ]}>{watch.change}</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderFavoritesGrid = () => {
    if (favorites.length === 0) return null;

    const rows = [];
    for (let i = 0; i < favorites.length; i += 2) {
      const isSingleInRow = i + 1 >= favorites.length;
      rows.push(
        <View key={i} style={styles.watchRow}>
          {renderWatchCard(favorites[i], isSingleInRow)}
          {favorites[i + 1] && renderWatchCard(favorites[i + 1], false)}
        </View>
      );
    }
    return rows;
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <ChevronLeftIcon />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Favorites</Text>
        <View style={styles.headerButton} />
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1D1D1F" />
        </View>
      ) : favorites.length > 0 ? (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.watchGrid}>
            {renderFavoritesGrid()}
          </View>
        </ScrollView>
      ) : (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconContainer}>
            <HeartIcon />
          </View>
          <Text style={styles.emptyTitle}>No favorites yet</Text>
          <Text style={styles.emptySubtitle}>
            Add watches to your watchlist to see them here
          </Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: hp(44),
    paddingHorizontal: wp(8),
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(33, 33, 33, 0.05)',
  },
  headerButton: {
    width: sp(44),
    height: sp(44),
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontFamily: 'HankenGrotesk_600SemiBold',
    fontSize: fp(17),
    fontWeight: '600',
    color: '#1D1D1F',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: wp(16),
    paddingBottom: hp(40),
  },
  watchGrid: {
    gap: hp(12),
  },
  watchRow: {
    flexDirection: 'row',
    gap: wp(12),
  },
  watchCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: sp(16),
    borderWidth: 1,
    borderColor: 'rgba(33, 33, 33, 0.05)',
    overflow: 'hidden',
  },
  watchCardHalf: {
    flex: 0,
    width: '48%',
  },
  watchImageContainer: {
    height: hp(140),
    borderTopLeftRadius: sp(12),
    borderTopRightRadius: sp(12),
    overflow: 'hidden',
  },
  watchImageGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  watchImage: {
    width: '66%',
    height: '86%',
  },
  watchInfo: {
    padding: wp(16),
    paddingTop: hp(12),
    gap: hp(12),
  },
  watchNameContainer: {
    gap: 0,
  },
  watchBrand: {
    fontFamily: 'HankenGrotesk_600SemiBold',
    fontSize: fp(13),
    fontWeight: '600',
    color: '#212121',
    lineHeight: fp(17),
  },
  watchReference: {
    fontFamily: 'HankenGrotesk_500Medium',
    fontSize: fp(13),
    fontWeight: '500',
    color: '#212121',
    opacity: 0.5,
    lineHeight: fp(17),
  },
  watchPriceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  watchPrice: {
    fontFamily: 'HankenGrotesk_600SemiBold',
    fontSize: fp(15),
    fontWeight: '600',
    color: '#212121',
    lineHeight: fp(20),
  },
  changeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: wp(7),
    paddingVertical: hp(3),
    borderRadius: sp(99),
    gap: wp(4),
  },
  changeText: {
    fontFamily: 'HankenGrotesk_600SemiBold',
    fontSize: fp(11),
    fontWeight: '600',
    lineHeight: fp(14),
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
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
    fontFamily: 'HankenGrotesk_600SemiBold',
    fontSize: fp(17),
    fontWeight: '600',
    color: '#212121',
    marginBottom: hp(8),
    textAlign: 'center',
  },
  emptySubtitle: {
    fontFamily: 'HankenGrotesk_400Regular',
    fontSize: fp(14),
    fontWeight: '400',
    color: 'rgba(33, 33, 33, 0.6)',
    textAlign: 'center',
    lineHeight: fp(20),
  },
});
