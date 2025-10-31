import { StyleSheet, ScrollView, View, Text, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Greeting } from '@/components/Greeting';
import { QuickAccessButton } from '@/components/QuickAccessButton';
import { NewsCard } from '@/components/NewsCard';
import { MyWatchlist } from '@/components/MyWatchlist';
import { WatchlistItemData } from '@/components/WatchlistCard';
import { useTheme } from '@/contexts/ThemeContext';
import { ChevronRight } from '@/components/icons';

export default function HomeScreen() {
  const { colors } = useTheme();
  // Mock user watchlist - in production, this would come from API or state
  const userWatchlist: WatchlistItemData[] = [
    {
      id: '1',
      name: 'Rolex Submariner',
      code: '126610LN',
      price: 12352,
      priceChange: -0.7,
      priceHistory: [12500, 12450, 12400, 12380, 12370, 12352],
    },
    {
      id: '2',
      name: 'Patek Philippe Nautilus',
      code: '5712/1A',
      price: 97467,
      priceChange: 1.2,
      priceHistory: [96000, 96500, 97000, 96800, 97200, 97467],
    },
    {
      id: '3',
      name: 'Audemars Piguet Royal Oak',
      code: '15510ST',
      price: 57594,
      priceChange: 6.2,
      priceHistory: [54000, 54500, 55500, 56200, 57000, 57594],
    },
  ];

  // Default watches chosen by admin (fallback if user has no watchlist)
  const defaultWatches: WatchlistItemData[] = [
    {
      id: 'default-1',
      name: 'Rolex Explorer',
      code: '224270',
      price: 8149,
      priceChange: 3.9,
      priceHistory: [7800, 7900, 8000, 7950, 8100, 8149],
    },
    {
      id: 'default-2',
      name: 'Omega Speedmaster',
      code: '310.30.42',
      price: 5200,
      priceChange: 2.1,
      priceHistory: [5000, 5050, 5100, 5150, 5180, 5200],
    },
    {
      id: 'default-3',
      name: 'Cartier Santos',
      code: 'WSSA0018',
      price: 7244,
      priceChange: 5.9,
      priceHistory: [6800, 6900, 7000, 7100, 7200, 7244],
    },
  ];

  // Use user watchlist if they have watches, otherwise use defaults
  const displayWatchlist = userWatchlist.length > 0 ? userWatchlist : defaultWatches;

  const quickAccessItems = [
    {
      id: '1',
      title: 'Activity Center',
      subtitle: 'All your updates — matches, payments, shipping and alerts in one place.',
      icon: 'activity',
    },
    {
      id: '2',
      title: 'Smart Search',
      subtitle: 'Find watches worldwide with intelligent filters and live matches.',
      icon: 'search',
    },
    {
      id: '3',
      title: 'Buy',
      subtitle: 'Buy from verified dealers in your chosen market region.',
      icon: 'shopping-cart',
    },
    {
      id: '4',
      title: 'Sell',
      subtitle: 'List your watches for sale and connect with active buyers.',
      icon: 'tag',
    },
    {
      id: '5',
      title: 'Ask AI Assistant',
      subtitle: 'Your personal assistant, 24/7.',
      icon: 'bot',
    },
    {
      id: '6',
      title: 'My Inventory',
      subtitle: 'Manage, edit and track your full watch stock in real time.',
      icon: 'package',
    },
    {
      id: '7',
      title: 'My Orders',
      subtitle: 'View and manage all your active buy orders.',
      icon: 'clipboard-list',
    },
    {
      id: '8',
      title: 'Checks',
      subtitle: 'Avoid risk — check your serials and close deals confidently.',
      icon: 'shield-check',
    },
    {
      id: '9',
      title: 'All Tools',
      subtitle: 'Everything else you need — organized in one place.',
      icon: 'grid',
    },
  ];

  const newsItems = [
    {
      id: '1',
      icon: '📰',
      text: 'Patek increases Nautilus production by 5%',
      source: 'Bloomberg',
    },
    {
      id: '2',
      icon: '📈',
      text: 'Submariner prices stabilize after -2.1% dip',
      source: 'Market Watch',
    },
    {
      id: '3',
      icon: '🔧',
      text: 'Rolex service delays still affecting secondary market',
      source: 'WatchPro',
    },
  ];

  const handleViewAllWatchlist = () => {
    // Navigate to market with watchlist filter
    router.push('/market');
  };

  const handleWatchPress = (watchId: string) => {
    router.push(`/watch/${watchId}`);
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    scrollView: {
      flex: 1,
    },
    quickAccessContainer: {
      paddingHorizontal: 16,
      paddingVertical: 20,
      backgroundColor: colors.backgroundSecondary,
    },
    sectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 16,
    },
    sectionTitle: {
      fontSize: 20,
      fontWeight: '600',
      color: colors.text,
    },
    reorganizeButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
    },
    reorganizeText: {
      fontSize: 13,
      fontWeight: '500',
      color: colors.primary,
    },
    quickAccessButtons: {
      gap: 0,
    },
    customizeButton: {
      marginHorizontal: 16,
      marginTop: 24,
      padding: 16,
      backgroundColor: colors.backgroundSecondary,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      borderStyle: 'dashed',
    },
    customizeText: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 4,
    },
    customizeSubtext: {
      fontSize: 14,
      color: colors.textTertiary,
    },
    newsSection: {
      marginTop: 32,
      marginBottom: 32,
      paddingHorizontal: 16,
    },
    newsTitle: {
      fontSize: 20,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 16,
    },
    viewAllButton: {
      marginTop: 12,
      padding: 16,
      backgroundColor: colors.card,
      borderRadius: 12,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
    },
    viewAllText: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
    },
  });

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Greeting */}
        <Greeting />

        {/* My Watchlist Section */}
        <MyWatchlist
          watches={displayWatchlist}
          onViewAll={handleViewAllWatchlist}
          onWatchPress={handleWatchPress}
        />

        {/* Quick Access Section */}
        <View style={styles.quickAccessContainer}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Quick Access</Text>
            <TouchableOpacity style={styles.reorganizeButton} onPress={() => console.log('Reorganize')}>
              <Text style={styles.reorganizeText}>Reorganize</Text>
              <ChevronRight size={14} color={colors.primary} />
            </TouchableOpacity>
          </View>
          <View style={styles.quickAccessButtons}>
            {quickAccessItems.map((item) => (
              <QuickAccessButton
                key={item.id}
                title={item.title}
                subtitle={item.subtitle}
                icon={item.icon}
                onPress={() => console.log('Pressed:', item.title)}
              />
            ))}
          </View>
        </View>

        {/* Customize Section */}
        <TouchableOpacity style={styles.customizeButton}>
          <Text style={styles.customizeText}>Customize your Homescreen</Text>
          <Text style={styles.customizeSubtext}>
            Add, remove or rearrange your main tools.
          </Text>
        </TouchableOpacity>

        {/* Market News */}
        <View style={styles.newsSection}>
          <Text style={styles.newsTitle}>Latest from the Market</Text>
          {newsItems.map((item) => (
            <NewsCard
              key={item.id}
              icon={item.icon}
              text={item.text}
              source={item.source}
            />
          ))}
          <TouchableOpacity style={styles.viewAllButton}>
            <Text style={styles.viewAllText}>View all News</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
