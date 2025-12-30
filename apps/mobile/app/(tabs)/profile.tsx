import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useAuthStore } from '@watchsphere/shared/stores';
import { useTheme } from '@/contexts/ThemeContext';
import { User, Settings, Edit2, Heart, ChevronRight } from '@/components/icons';
import { wp, hp, sp, fp } from '@/utils/responsive';

interface FavoriteWatch {
  id: string;
  name: string;
  reference: string;
  price: string;
  image?: string;
}

export default function ProfileScreen() {
  const user = useAuthStore((state) => state.user);
  const { colors, fonts } = useTheme();

  const favoriteWatches: FavoriteWatch[] = [
    {
      id: '1',
      name: 'Rolex Submariner Date',
      reference: '126610LN, New Unworn 41...',
      price: '€12,352',
      image: 'https://images.unsplash.com/photo-1523170335258-f5ed11844a49?w=400&h=300&fit=crop',
    },
    {
      id: '2',
      name: 'Patek Philippe Nautilus',
      reference: '5711/1A-010, Full Set 40mm',
      price: '€97,467',
      image: 'https://images.unsplash.com/photo-1587836374828-4dbafa94cf0e?w=400&h=300&fit=crop',
    },
  ];

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: wp(16),
      paddingVertical: hp(16),
    },
    headerTitle: {
      fontSize: fp(17),
      fontFamily: fonts.semiBold,
      color: colors.text,
    },
    headerButton: {
      padding: sp(4),
    },
    scrollView: {
      flex: 1,
    },
    profileSection: {
      alignItems: 'center',
      paddingVertical: hp(24),
      paddingHorizontal: wp(16),
    },
    profileImageContainer: {
      position: 'relative',
      marginBottom: hp(16),
    },
    profileImage: {
      width: sp(120),
      height: sp(120),
      borderRadius: sp(60),
      backgroundColor: colors.backgroundSecondary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    editButton: {
      position: 'absolute',
      bottom: 0,
      right: 0,
      width: sp(36),
      height: sp(36),
      borderRadius: sp(18),
      backgroundColor: colors.text,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 3,
      borderColor: colors.background,
    },
    userName: {
      fontSize: fp(24),
      fontFamily: fonts.semiBold,
      color: colors.text,
    },
    favoritesSection: {
      paddingHorizontal: wp(16),
      paddingVertical: hp(20),
    },
    favoritesHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: hp(16),
    },
    favoritesTitle: {
      fontSize: fp(20),
      fontFamily: fonts.semiBold,
      color: colors.text,
    },
    seeAllButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: wp(4),
    },
    seeAllText: {
      fontSize: fp(15),
      fontFamily: fonts.regular,
      color: colors.textSecondary,
    },
    favoritesList: {
      flexDirection: 'row',
      gap: wp(12),
    },
    favoriteCard: {
      width: wp(200),
      borderRadius: sp(12),
      overflow: 'hidden',
      backgroundColor: colors.backgroundSecondary,
    },
    favoriteImage: {
      width: '100%',
      height: hp(150),
      backgroundColor: colors.background,
      position: 'relative',
    },
    favoriteHeart: {
      position: 'absolute',
      top: hp(12),
      right: wp(12),
      width: sp(32),
      height: sp(32),
      borderRadius: sp(16),
      backgroundColor: colors.card,
      justifyContent: 'center',
      alignItems: 'center',
    },
    favoriteInfo: {
      padding: wp(12),
    },
    favoriteName: {
      fontSize: fp(15),
      fontFamily: fonts.semiBold,
      color: colors.text,
      marginBottom: hp(4),
    },
    favoriteReference: {
      fontSize: fp(13),
      fontFamily: fonts.regular,
      color: colors.textSecondary,
      marginBottom: hp(8),
    },
    favoritePrice: {
      fontSize: fp(16),
      fontFamily: fonts.semiBold,
      color: colors.text,
    },
  });

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Profile</Text>
        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => router.push('/settings' as any)}
        >
          <Settings size={24} color={colors.text} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Profile Section */}
        <View style={styles.profileSection}>
          <View style={styles.profileImageContainer}>
            <View style={styles.profileImage}>
              <User size={48} color={colors.textSecondary} />
            </View>
            <TouchableOpacity
              style={styles.editButton}
              onPress={() => router.push('/profile-settings' as any)}
            >
              <Edit2 size={18} color={colors.background} />
            </TouchableOpacity>
          </View>
          <Text style={styles.userName}>{user?.name || 'Fabian Wirtz'}</Text>
        </View>

        {/* Favorites Section */}
        <View style={styles.favoritesSection}>
          <View style={styles.favoritesHeader}>
            <Text style={styles.favoritesTitle}>Favorites</Text>
            <TouchableOpacity style={styles.seeAllButton}>
              <Text style={styles.seeAllText}>See All</Text>
              <ChevronRight size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.favoritesList}>
              {favoriteWatches.map((watch) => (
                <TouchableOpacity
                  key={watch.id}
                  style={styles.favoriteCard}
                  onPress={() => router.push(`/watch/${watch.id}` as any)}
                >
                  <View style={styles.favoriteImage}>
                    {watch.image ? (
                      <Image
                        source={{ uri: watch.image }}
                        style={{ width: '100%', height: '100%' }}
                        resizeMode="cover"
                      />
                    ) : null}
                    <View style={styles.favoriteHeart}>
                      <Heart size={20} color="#FF3B30" fill="#FF3B30" />
                    </View>
                  </View>
                  <View style={styles.favoriteInfo}>
                    <Text style={styles.favoriteName}>{watch.name}</Text>
                    <Text style={styles.favoriteReference}>{watch.reference}</Text>
                    <Text style={styles.favoritePrice}>{watch.price}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
