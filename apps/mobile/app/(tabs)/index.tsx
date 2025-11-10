import { StyleSheet, ScrollView, View, Text, TouchableOpacity, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useState, useCallback, useRef, Fragment } from 'react';
import DraggableFlatList, { RenderItemParams, ScaleDecorator } from 'react-native-draggable-flatlist';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Greeting } from '@/components/Greeting';
import { QuickAccessButton } from '@/components/QuickAccessButton';
import { NewsCard } from '@/components/NewsCard';
import { MyWatchlist } from '@/components/MyWatchlist';
import { WatchlistItemData } from '@/components/WatchlistCard';
import { AIChatModal } from '@/components/AIChatModal';
import { useTheme } from '@/contexts/ThemeContext';
import { ChevronRight, X, Bell } from '@/components/icons';

interface QuickAccessItem {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
}

// All available Quick Access items
const ALL_QUICK_ACCESS_ITEMS: QuickAccessItem[] = [
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

export default function HomeScreen() {
  const { colors } = useTheme();
  const [isReorganizing, setIsReorganizing] = useState(false);
  const [aiChatVisible, setAiChatVisible] = useState(false);
  const [showAddItemsModal, setShowAddItemsModal] = useState(false);
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

  const [quickAccessItems, setQuickAccessItems] = useState<QuickAccessItem[]>(ALL_QUICK_ACCESS_ITEMS);

  // Get items that have been removed
  const removedItems = ALL_QUICK_ACCESS_ITEMS.filter(
    (item) => !quickAccessItems.find((active) => active.id === item.id)
  );

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

  const handleReorganize = () => {
    setIsReorganizing(!isReorganizing);
  };

  const handleRemoveItem = (itemId: string) => {
    setQuickAccessItems((items) => items.filter((item) => item.id !== itemId));
  };

  const handleAddItem = (item: QuickAccessItem) => {
    setQuickAccessItems((items) => [...items, item]);
    setShowAddItemsModal(false);
  };

  const handleQuickAccessPress = (item: QuickAccessItem) => {
    if (item.title === 'Activity Center') {
      router.push('/(tabs)/dashboard' as any);
    } else if (item.title === 'Smart Search') {
      router.push('/(tabs)/market');
    } else if (item.title === 'Ask AI Assistant') {
      setAiChatVisible(true);
    } else {
      console.log('Pressed:', item.title);
    }
  };

  const renderQuickAccessItem = ({ item, drag, isActive }: RenderItemParams<QuickAccessItem>) => {
    return (
      <ScaleDecorator>
        <QuickAccessButton
          title={item.title}
          subtitle={item.subtitle}
          icon={item.icon}
          onPress={() => handleQuickAccessPress(item)}
          isReorganizing={isReorganizing}
          onRemove={() => handleRemoveItem(item.id)}
          drag={drag}
        />
      </ScaleDecorator>
    );
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#FFFFFF',
    },
    scrollView: {
      flex: 1,
    },
    quickAccessContainer: {
      paddingHorizontal: 16,
      paddingVertical: 20,
      backgroundColor: '#FFFFFF',
    },
    sectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 16,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: '#212121',
      lineHeight: 20,
      letterSpacing: 0.08,
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
    addItemsButton: {
      marginTop: 12,
      padding: 16,
      backgroundColor: 'transparent',
      borderRadius: 12,
      borderWidth: 2,
      borderColor: colors.border,
      borderStyle: 'dashed',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    addItemsIconContainer: {
      width: 48,
      height: 48,
      borderRadius: 12,
      backgroundColor: colors.primaryLight,
      justifyContent: 'center',
      alignItems: 'center',
    },
    addItemsIcon: {
      fontSize: 28,
      fontWeight: '300',
      color: colors.primary,
    },
    addItemsTextContainer: {
      flex: 1,
    },
    addItemsText: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 2,
    },
    addItemsSubtext: {
      fontSize: 13,
      color: colors.textSecondary,
    },
    modalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
    },
    modalCloseButton: {
      padding: 8,
    },
    modalContent: {
      flex: 1,
      padding: 16,
    },
    modalItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      padding: 16,
      backgroundColor: colors.card,
      borderRadius: 12,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    modalItemIconContainer: {
      width: 48,
      height: 48,
      borderRadius: 12,
      backgroundColor: colors.primaryLight,
      justifyContent: 'center',
      alignItems: 'center',
    },
    modalItemIcon: {
      fontSize: 28,
      fontWeight: '300',
      color: colors.primary,
    },
    modalItemTextContainer: {
      flex: 1,
    },
    modalItemTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 4,
    },
    modalItemSubtitle: {
      fontSize: 13,
      color: colors.textSecondary,
      lineHeight: 18,
    },
    newsSection: {
      marginTop: 32,
      marginBottom: 32,
      paddingHorizontal: 16,
    },
    newsTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: '#212121',
      lineHeight: 20,
      letterSpacing: 0.08,
      marginBottom: 16,
    },
    viewAllButton: {
      marginTop: 12,
      padding: 16,
      backgroundColor: 'transparent',
      alignItems: 'center',
    },
    viewAllText: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
    },
  });

  return (
    <>
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
              <TouchableOpacity style={styles.reorganizeButton} onPress={handleReorganize}>
                <Text style={styles.reorganizeText}>{isReorganizing ? 'Done' : 'Reorganize'}</Text>
                {!isReorganizing && <ChevronRight size={14} color={colors.primary} />}
              </TouchableOpacity>
            </View>
            <GestureHandlerRootView style={styles.quickAccessButtons}>
              <DraggableFlatList
                data={quickAccessItems}
                renderItem={renderQuickAccessItem}
                keyExtractor={(item) => item.id}
                onDragEnd={({ data }) => setQuickAccessItems(data)}
                scrollEnabled={false}
              />
            </GestureHandlerRootView>

            {/* Add Items Button - Only shown when reorganizing and items are removed */}
            {isReorganizing && removedItems.length > 0 && (
              <TouchableOpacity
                style={styles.addItemsButton}
                onPress={() => setShowAddItemsModal(true)}
              >
                <View style={styles.addItemsIconContainer}>
                  <Text style={styles.addItemsIcon}>+</Text>
                </View>
                <View style={styles.addItemsTextContainer}>
                  <Text style={styles.addItemsText}>Add Quick Access Items</Text>
                  <Text style={styles.addItemsSubtext}>
                    {removedItems.length} item{removedItems.length > 1 ? 's' : ''} available to add
                  </Text>
                </View>
              </TouchableOpacity>
            )}
          </View>

          {/* Market News */}
          <View style={styles.newsSection}>
            <Text style={styles.newsTitle}>Latest News</Text>
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

      {/* Add Items Modal */}
      <Modal
        visible={showAddItemsModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowAddItemsModal(false)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Add Quick Access Items</Text>
            <TouchableOpacity onPress={() => setShowAddItemsModal(false)} style={styles.modalCloseButton}>
              <X size={24} color={colors.text} />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.modalContent}>
            {removedItems.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={styles.modalItem}
                onPress={() => handleAddItem(item)}
              >
                <View style={styles.modalItemIconContainer}>
                  <Text style={styles.modalItemIcon}>+</Text>
                </View>
                <View style={styles.modalItemTextContainer}>
                  <Text style={styles.modalItemTitle}>{item.title}</Text>
                  <Text style={styles.modalItemSubtitle}>{item.subtitle}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      <AIChatModal visible={aiChatVisible} onClose={() => setAiChatVisible(false)} />
    </>
  );
}
