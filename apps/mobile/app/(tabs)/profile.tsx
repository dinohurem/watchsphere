import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useAuthStore } from '@watchsphere/shared/stores';
import { useTheme } from '@/contexts/ThemeContext';
import { User, Settings, Edit2, Heart, ChevronRight } from '@/components/icons';

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
      paddingHorizontal: 16,
      paddingVertical: 16,
    },
    headerTitle: {
      fontSize: 17,
      fontFamily: fonts.semiBold,
      color: colors.text,
    },
    headerButton: {
      padding: 4,
    },
    scrollView: {
      flex: 1,
    },
    profileSection: {
      alignItems: 'center',
      paddingVertical: 24,
      paddingHorizontal: 16,
    },
    profileImageContainer: {
      position: 'relative',
      marginBottom: 16,
    },
    profileImage: {
      width: 120,
      height: 120,
      borderRadius: 60,
      backgroundColor: colors.backgroundSecondary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    editButton: {
      position: 'absolute',
      bottom: 0,
      right: 0,
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.text,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 3,
      borderColor: colors.background,
    },
    userName: {
      fontSize: 24,
      fontFamily: fonts.semiBold,
      color: colors.text,
      marginBottom: 4,
    },
    userCustomerId: {
      fontSize: 15,
      fontFamily: fonts.regular,
      color: colors.textSecondary,
    },
    favoritesSection: {
      paddingHorizontal: 16,
      paddingVertical: 20,
    },
    favoritesHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 16,
    },
    favoritesTitle: {
      fontSize: 20,
      fontFamily: fonts.semiBold,
      color: colors.text,
    },
    seeAllButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    seeAllText: {
      fontSize: 15,
      fontFamily: fonts.regular,
      color: colors.textSecondary,
    },
    favoritesList: {
      flexDirection: 'row',
      gap: 12,
    },
    favoriteCard: {
      width: 200,
      borderRadius: 12,
      overflow: 'hidden',
      backgroundColor: colors.backgroundSecondary,
    },
    favoriteImage: {
      width: '100%',
      height: 150,
      backgroundColor: colors.background,
      position: 'relative',
    },
    favoriteHeart: {
      position: 'absolute',
      top: 12,
      right: 12,
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.card,
      justifyContent: 'center',
      alignItems: 'center',
    },
    favoriteInfo: {
      padding: 12,
    },
    favoriteName: {
      fontSize: 15,
      fontFamily: fonts.semiBold,
      color: colors.text,
      marginBottom: 4,
    },
    favoriteReference: {
      fontSize: 13,
      fontFamily: fonts.regular,
      color: colors.textSecondary,
      marginBottom: 8,
    },
    favoritePrice: {
      fontSize: 16,
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
          <Text style={styles.userCustomerId}>Customer ID: 009 978 333</Text>
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
