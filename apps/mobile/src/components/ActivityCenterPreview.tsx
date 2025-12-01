import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { ChevronRight, Bell, Tag, TrendingUp } from './icons';

interface ActivityItem {
  id: string;
  icon: 'bell' | 'tag' | 'trending';
  text: string;
  time: string;
}

interface ActivityCenterPreviewProps {
  onViewAll: () => void;
}

const MOCK_ACTIVITIES: ActivityItem[] = [
  {
    id: '1',
    icon: 'tag',
    text: 'New offer on 126610LN listing',
    time: '2m ago',
  },
  {
    id: '2',
    icon: 'bell',
    text: 'Order #4521 has been shipped',
    time: '15m ago',
  },
  {
    id: '3',
    icon: 'trending',
    text: '26240OR price alert triggered',
    time: '1h ago',
  },
];

const iconMap = {
  bell: Bell,
  tag: Tag,
  trending: TrendingUp,
};

export function ActivityCenterPreview({ onViewAll }: ActivityCenterPreviewProps) {
  const { colors, fonts } = useTheme();

  const styles = StyleSheet.create({
    container: {
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: '#FFFFFF',
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    title: {
      fontSize: 16,
      fontFamily: fonts.semiBold,
      color: '#212121',
      lineHeight: 20,
      letterSpacing: 0.08,
    },
    viewAllButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
    },
    viewAllText: {
      fontSize: 13,
      fontFamily: fonts.medium,
      color: colors.primary,
    },
    activityList: {
      gap: 4,
    },
    activityItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 8,
      gap: 12,
    },
    iconContainer: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.primaryLight,
      justifyContent: 'center',
      alignItems: 'center',
    },
    textContainer: {
      flex: 1,
    },
    activityText: {
      fontSize: 13,
      fontFamily: fonts.medium,
      color: colors.text,
    },
    timeText: {
      fontSize: 11,
      fontFamily: fonts.regular,
      color: colors.textSecondary,
      marginTop: 2,
    },
  });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Activity</Text>
        <TouchableOpacity style={styles.viewAllButton} onPress={onViewAll}>
          <Text style={styles.viewAllText}>View all</Text>
          <ChevronRight size={14} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <View style={styles.activityList}>
        {MOCK_ACTIVITIES.map((activity) => {
          const IconComponent = iconMap[activity.icon];
          return (
            <View key={activity.id} style={styles.activityItem}>
              <View style={styles.iconContainer}>
                <IconComponent size={16} color={colors.primary} />
              </View>
              <View style={styles.textContainer}>
                <Text style={styles.activityText} numberOfLines={1}>
                  {activity.text}
                </Text>
                <Text style={styles.timeText}>{activity.time}</Text>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}
