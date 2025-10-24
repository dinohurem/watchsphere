import { StyleSheet, ScrollView, View, Text, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Greeting } from '@/components/Greeting';
import { QuickAccessButton } from '@/components/QuickAccessButton';
import { NewsCard } from '@/components/NewsCard';

export default function HomeScreen() {
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

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Greeting */}
        <Greeting />

        {/* Quick Access Buttons */}
        <View style={styles.section}>
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  scrollView: {
    flex: 1,
  },
  section: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  customizeButton: {
    marginHorizontal: 16,
    marginTop: 24,
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderStyle: 'dashed',
  },
  customizeText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  customizeSubtext: {
    fontSize: 14,
    color: '#666',
  },
  newsSection: {
    marginTop: 32,
    marginBottom: 24,
    paddingHorizontal: 16,
  },
  newsTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 16,
  },
  viewAllButton: {
    marginTop: 12,
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  viewAllText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
  },
});
