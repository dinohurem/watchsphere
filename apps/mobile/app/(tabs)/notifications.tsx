import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { ArrowLeft, Bell, Tag, TrendingUp } from '@/components/icons';

interface NotificationItem {
  id: string;
  type: 'offer' | 'alert' | 'update';
  title: string;
  reference: string;
  price: string;
  time: string;
}

const iconMap = {
  offer: Tag,
  alert: Bell,
  update: TrendingUp,
};

export default function NotificationsScreen() {
  const { colors, fonts } = useTheme();

  const todayNotifications: NotificationItem[] = [
    {
      id: '1',
      type: 'offer',
      title: 'New offer',
      reference: '126610LN',
      price: '€12,000',
      time: '2h',
    },
    {
      id: '2',
      type: 'alert',
      title: 'Price alert triggered',
      reference: '126710BLRO',
      price: '€11,000',
      time: '10h',
    },
  ];

  const last7DaysNotifications: NotificationItem[] = [
    {
      id: '3',
      type: 'update',
      title: 'Market update',
      reference: '5711/1A-014',
      price: '€12,500',
      time: '1d',
    },
    {
      id: '4',
      type: 'offer',
      title: 'New offer',
      reference: '228238A',
      price: '€8,000',
      time: '5d',
    },
  ];

  const renderNotificationItem = (item: NotificationItem) => {
    const IconComponent = iconMap[item.type];
    return (
      <TouchableOpacity
        key={item.id}
        style={styles.notificationItem}
        onPress={() => router.push('/watch/1' as any)}
      >
        <View style={styles.iconContainer}>
          <IconComponent size={16} color={colors.primary} />
        </View>
        <View style={styles.notificationContent}>
          <Text style={styles.notificationTitle}>
            {item.title} <Text style={styles.referenceText}>{item.reference}</Text>
          </Text>
          <View style={styles.notificationFooter}>
            <Text style={styles.notificationPrice}>{item.price}</Text>
            <Text style={styles.notificationTime}>{item.time}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

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
      fontFamily: fonts.semiBold,
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
      fontSize: 13,
      fontFamily: fonts.regular,
      color: colors.textSecondary,
      marginBottom: 12,
    },
    notificationItem: {
      flexDirection: 'row',
      paddingVertical: 10,
      gap: 12,
      alignItems: 'center',
    },
    iconContainer: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.primaryLight,
      justifyContent: 'center',
      alignItems: 'center',
    },
    notificationContent: {
      flex: 1,
      justifyContent: 'center',
    },
    notificationTitle: {
      fontSize: 13,
      fontFamily: fonts.medium,
      color: colors.text,
      marginBottom: 4,
    },
    referenceText: {
      fontFamily: fonts.semiBold,
    },
    notificationFooter: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    notificationPrice: {
      fontSize: 13,
      fontFamily: fonts.semiBold,
      color: colors.text,
    },
    notificationTime: {
      fontSize: 12,
      fontFamily: fonts.regular,
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
