import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { ArrowLeft } from '@/components/icons';

interface NotificationItem {
  id: string;
  title: string;
  price: string;
  time: string;
  image?: string;
}

export default function NotificationsScreen() {
  const { colors } = useTheme();

  const todayNotifications: NotificationItem[] = [
    {
      id: '1',
      title: 'New offer for Rolex Submariner Date',
      price: '€12,000',
      time: '2h',
    },
    {
      id: '2',
      title: 'New offer for Rolex Submariner Date',
      price: '€11,000',
      time: '10h',
    },
  ];

  const last7DaysNotifications: NotificationItem[] = [
    {
      id: '3',
      title: 'New offer for Rolex Submariner Date',
      price: '€12,500',
      time: '1d',
    },
    {
      id: '4',
      title: 'New offer for Rolex Submariner Date',
      price: '€8,000',
      time: '5d',
    },
  ];

  const renderNotificationItem = (item: NotificationItem) => (
    <TouchableOpacity
      key={item.id}
      style={styles.notificationItem}
      onPress={() => router.push('/watch/1' as any)}
    >
      <View style={styles.watchImage}>
        {/* Placeholder for watch image */}
      </View>
      <View style={styles.notificationContent}>
        <Text style={styles.notificationTitle}>{item.title}</Text>
        <View style={styles.notificationFooter}>
          <Text style={styles.notificationPrice}>{item.price}</Text>
          <Text style={styles.notificationTime}>{item.time}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 16,
      paddingVertical: 16,
      position: 'relative',
    },
    backButton: {
      position: 'absolute',
      left: 16,
      padding: 4,
    },
    headerTitle: {
      fontSize: 17,
      fontWeight: '600',
      color: colors.text,
    },
    scrollView: {
      flex: 1,
    },
    section: {
      paddingHorizontal: 16,
      paddingTop: 20,
    },
    sectionTitle: {
      fontSize: 15,
      fontWeight: '400',
      color: colors.textSecondary,
      marginBottom: 16,
    },
    notificationItem: {
      flexDirection: 'row',
      paddingVertical: 12,
      gap: 12,
    },
    watchImage: {
      width: 80,
      height: 80,
      borderRadius: 8,
      backgroundColor: colors.backgroundSecondary,
    },
    notificationContent: {
      flex: 1,
      justifyContent: 'center',
    },
    notificationTitle: {
      fontSize: 16,
      fontWeight: '400',
      color: colors.text,
      marginBottom: 8,
    },
    notificationFooter: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    notificationPrice: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
    },
    notificationTime: {
      fontSize: 15,
      fontWeight: '400',
      color: colors.textSecondary,
    },
  });

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <ArrowLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Today Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Today</Text>
          {todayNotifications.map(renderNotificationItem)}
        </View>

        {/* Last 7 days Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Last 7 days</Text>
          {last7DaysNotifications.map(renderNotificationItem)}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
