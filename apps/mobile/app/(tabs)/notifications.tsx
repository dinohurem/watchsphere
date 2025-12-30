import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { ChevronLeft, TagPlus, PriceAlertUp, PriceAlertDown } from '@/components/icons';
import { wp, hp, sp, fp } from '@/utils/responsive';

type NotificationType = 'new_offer' | 'price_alert_up' | 'price_alert_down';

interface NotificationItem {
  id: string;
  type: NotificationType;
  title: string;
  reference: string;
  price: string;
  time: string;
  isUnread: boolean;
}

export default function NotificationsScreen() {
  const { colors, fonts } = useTheme();

  const newNotifications: NotificationItem[] = [
    {
      id: '1',
      type: 'new_offer',
      title: 'New offer',
      reference: '126610LN',
      price: '€12,000',
      time: '1 min ago',
      isUnread: true,
    },
    {
      id: '2',
      type: 'new_offer',
      title: 'New offer',
      reference: '126610LN',
      price: '€12,000',
      time: '1 min ago',
      isUnread: true,
    },
    {
      id: '3',
      type: 'price_alert_down',
      title: 'Price alert triggered',
      reference: '126710BLRO',
      price: '€11,000',
      time: '1 min ago',
      isUnread: true,
    },
    {
      id: '4',
      type: 'price_alert_up',
      title: 'New offer',
      reference: '126610LN',
      price: '€12,000',
      time: '15 minutes ago',
      isUnread: false,
    },
  ];

  const earlierNotifications: NotificationItem[] = [
    {
      id: '5',
      type: 'price_alert_down',
      title: 'New offer',
      reference: '126610LN',
      price: '€12,000',
      time: '10 hours ago',
      isUnread: false,
    },
    {
      id: '6',
      type: 'price_alert_up',
      title: 'New offer',
      reference: '126610LN',
      price: '€12,000',
      time: '12 hours ago',
      isUnread: false,
    },
    {
      id: '7',
      type: 'price_alert_up',
      title: 'New offer',
      reference: '126610LN',
      price: '€12,000',
      time: '12 hours ago',
      isUnread: false,
    },
    {
      id: '8',
      type: 'price_alert_down',
      title: 'New offer',
      reference: '126610LN',
      price: '€12,000',
      time: '10 hours ago',
      isUnread: false,
    },
  ];

  const getIconConfig = (type: NotificationType) => {
    switch (type) {
      case 'new_offer':
        return {
          Icon: TagPlus,
          color: '#0088FF',
          bgColor: 'rgba(0, 136, 255, 0.05)',
        };
      case 'price_alert_up':
        return {
          Icon: PriceAlertUp,
          color: '#4AA078',
          bgColor: 'rgba(74, 160, 120, 0.05)',
        };
      case 'price_alert_down':
        return {
          Icon: PriceAlertDown,
          color: '#D90429',
          bgColor: 'rgba(217, 4, 41, 0.05)',
        };
    }
  };

  const renderNotificationItem = (item: NotificationItem, isLast: boolean) => {
    const iconConfig = getIconConfig(item.type);
    const IconComponent = iconConfig.Icon;

    return (
      <View key={item.id} style={styles.notificationItemWrapper}>
        <TouchableOpacity
          style={styles.notificationItem}
          onPress={() => router.push('/watch/1' as any)}
          activeOpacity={0.7}
        >
          <View style={[styles.iconContainer, { backgroundColor: iconConfig.bgColor }]}>
            <IconComponent size={18} color={iconConfig.color} />
          </View>
          <View style={styles.notificationContentWrapper}>
            <View style={styles.notificationContent}>
              <View style={styles.titleRow}>
                <Text style={styles.notificationTitle}>
                  <Text style={styles.titleRegular}>{item.title} </Text>
                  <Text style={styles.titleBold}>{item.reference}</Text>
                </Text>
              </View>
              <Text style={styles.notificationPrice}>{item.price}</Text>
              <Text style={styles.notificationTime}>{item.time}</Text>
            </View>
            {item.isUnread && <View style={styles.unreadDot} />}
          </View>
        </TouchableOpacity>
        {!isLast && (
          <View style={styles.separatorRow}>
            <View style={styles.separatorSpacer} />
            <View style={styles.separator} />
          </View>
        )}
      </View>
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
      paddingHorizontal: wp(8),
      height: sp(44),
      position: 'relative',
    },
    backButton: {
      position: 'absolute',
      left: wp(8),
      width: sp(44),
      height: sp(44),
      justifyContent: 'center',
      alignItems: 'center',
    },
    headerTitle: {
      fontSize: fp(18),
      fontFamily: fonts.semiBold,
      color: '#212121',
      letterSpacing: 0.09,
    },
    scrollView: {
      flex: 1,
    },
    contentContainer: {
      paddingHorizontal: wp(16),
      paddingTop: hp(16),
    },
    section: {
      marginBottom: hp(24),
    },
    sectionTitle: {
      fontSize: fp(15),
      fontFamily: fonts.medium,
      color: '#626262',
      letterSpacing: 0.075,
      marginBottom: hp(12),
    },
    notificationItemWrapper: {
      marginBottom: 0,
    },
    notificationItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: wp(10),
      paddingVertical: hp(8),
    },
    iconContainer: {
      width: sp(40),
      height: sp(40),
      borderRadius: sp(540),
      justifyContent: 'center',
      alignItems: 'center',
    },
    notificationContentWrapper: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
    },
    notificationContent: {
      flex: 1,
      gap: hp(2),
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    notificationTitle: {
      fontSize: fp(15),
      lineHeight: fp(19),
      letterSpacing: 0.075,
      color: '#212121',
    },
    titleRegular: {
      fontFamily: fonts.regular,
    },
    titleBold: {
      fontFamily: fonts.semiBold,
    },
    notificationPrice: {
      fontSize: fp(15),
      fontFamily: fonts.regular,
      color: '#626262',
      lineHeight: fp(19),
      letterSpacing: 0.075,
    },
    notificationTime: {
      fontSize: fp(11),
      fontFamily: fonts.regular,
      color: '#747474',
      lineHeight: fp(14),
      letterSpacing: 0.055,
    },
    unreadDot: {
      width: sp(8),
      height: sp(8),
      borderRadius: sp(540),
      backgroundColor: '#C93927',
      marginLeft: wp(10),
    },
    separatorRow: {
      flexDirection: 'row',
      marginTop: hp(16),
    },
    separatorSpacer: {
      width: wp(50),
    },
    separator: {
      flex: 1,
      height: 1,
      backgroundColor: '#E5E5EA',
    },
  });

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <ChevronLeft size={24} color="#212121" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.contentContainer}>
          {/* NEW Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>NEW</Text>
            {newNotifications.map((item, index) =>
              renderNotificationItem(item, index === newNotifications.length - 1)
            )}
          </View>

          {/* EARLIER Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>EARLIER</Text>
            {earlierNotifications.map((item, index) =>
              renderNotificationItem(item, index === earlierNotifications.length - 1)
            )}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
