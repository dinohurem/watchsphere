import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { FileText, TrendingUp, Settings } from './icons';

export interface NewsItem {
  id: string;
  icon: string;
  text: string;
  source: string;
  url: string;
  date?: string;
  fullText?: string;
  imageUrl?: string;
}

// Map emoji icons to icon components
const iconMap: Record<string, React.ComponentType<{ size: number; color: string }>> = {
  '📰': FileText,
  '📈': TrendingUp,
  '🔧': Settings,
};

interface NewsCardProps {
  item: NewsItem;
  onPress?: () => void;
}

export function NewsCard({ item, onPress }: NewsCardProps) {
  const { colors, fonts } = useTheme();

  const handlePress = () => {
    if (onPress) {
      onPress();
    } else {
      router.push({
        pathname: '/news/[id]',
        params: {
          id: item.id,
          title: item.text,
          source: item.source,
          url: item.url,
          date: item.date || new Date().toLocaleDateString(),
          fullText: item.fullText || item.text,
          imageUrl: item.imageUrl || '',
        },
      } as any);
    }
  };

  const styles = StyleSheet.create({
    container: {
      flexDirection: 'row',
      backgroundColor: 'transparent',
      paddingVertical: 8,
      paddingLeft: 0,
      alignItems: 'center',
    },
    iconContainer: {
      width: 40,
      height: 40,
      borderRadius: 10,
      backgroundColor: colors.primaryLight,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 12,
    },
    textContainer: {
      flex: 1,
    },
    text: {
      fontSize: 15,
      color: colors.text,
      fontFamily: fonts.semiBold,
      marginBottom: 2,
    },
    source: {
      fontSize: 13,
      fontFamily: fonts.regular,
      color: colors.textSecondary,
    },
  });

  const IconComponent = iconMap[item.icon] || FileText;

  return (
    <TouchableOpacity style={styles.container} onPress={handlePress} activeOpacity={0.7}>
      <View style={styles.iconContainer}>
        <IconComponent size={20} color={colors.primary} />
      </View>
      <View style={styles.textContainer}>
        <Text style={styles.text}>{item.text}</Text>
        <Text style={styles.source}>{item.source}</Text>
      </View>
    </TouchableOpacity>
  );
}
