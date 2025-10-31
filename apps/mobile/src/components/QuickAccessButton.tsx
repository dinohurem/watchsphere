import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { Activity, Search, ShoppingCart, Tag, Bot, Package, ClipboardList, ShieldCheck, Grid } from './icons';

interface QuickAccessButtonProps {
  title: string;
  subtitle: string;
  icon: string;
  onPress: () => void;
}

const iconMap: Record<string, React.ComponentType<{ size: number; color: string }>> = {
  activity: Activity,
  search: Search,
  'shopping-cart': ShoppingCart,
  tag: Tag,
  bot: Bot,
  package: Package,
  'clipboard-list': ClipboardList,
  'shield-check': ShieldCheck,
  grid: Grid,
};

export function QuickAccessButton({ title, subtitle, icon, onPress }: QuickAccessButtonProps) {
  const { colors } = useTheme();
  const IconComponent = iconMap[icon] || Grid;

  const styles = StyleSheet.create({
    container: {
      flexDirection: 'row',
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 2,
    },
    iconContainer: {
      width: 48,
      height: 48,
      borderRadius: 12,
      backgroundColor: colors.primaryLight,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 12,
    },
    textContainer: {
      flex: 1,
      justifyContent: 'center',
    },
    title: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 4,
    },
    subtitle: {
      fontSize: 14,
      color: colors.textSecondary,
      lineHeight: 20,
    },
  });

  return (
    <TouchableOpacity style={styles.container} onPress={onPress}>
      <View style={styles.iconContainer}>
        <IconComponent size={24} color={colors.primary} />
      </View>
      <View style={styles.textContainer}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle} numberOfLines={2}>
          {subtitle}
        </Text>
      </View>
    </TouchableOpacity>
  );
}
