import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { useEffect, useRef } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { Activity, Search, ShoppingCart, Tag, AISparkle, Package, ClipboardList, ShieldCheck, Grid, X } from './icons';

interface QuickAccessButtonProps {
  title: string;
  subtitle: string;
  icon: string;
  onPress: () => void;
  isReorganizing?: boolean;
  onRemove?: () => void;
  drag?: () => void;
}

const iconMap: Record<string, React.ComponentType<{ size: number; color: string }>> = {
  activity: Activity,
  search: Search,
  'shopping-cart': ShoppingCart,
  tag: Tag,
  bot: AISparkle,
  package: Package,
  'clipboard-list': ClipboardList,
  'shield-check': ShieldCheck,
  grid: Grid,
};

export function QuickAccessButton({
  title,
  subtitle,
  icon,
  onPress,
  isReorganizing = false,
  onRemove,
  drag,
}: QuickAccessButtonProps) {
  const { colors, fonts } = useTheme();
  const IconComponent = iconMap[icon] || Grid;

  // Wiggle animation
  const wiggleAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isReorganizing) {
      // Create iOS-style wiggle animation
      const wiggleAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(wiggleAnim, {
            toValue: 1,
            duration: 100,
            useNativeDriver: true,
          }),
          Animated.timing(wiggleAnim, {
            toValue: -1,
            duration: 100,
            useNativeDriver: true,
          }),
          Animated.timing(wiggleAnim, {
            toValue: 1,
            duration: 100,
            useNativeDriver: true,
          }),
          Animated.timing(wiggleAnim, {
            toValue: 0,
            duration: 100,
            useNativeDriver: true,
          }),
        ])
      );
      wiggleAnimation.start();

      return () => {
        wiggleAnimation.stop();
        wiggleAnim.setValue(0);
      };
    } else {
      wiggleAnim.setValue(0);
    }
  }, [isReorganizing]);

  const rotation = wiggleAnim.interpolate({
    inputRange: [-1, 1],
    outputRange: ['-1deg', '1deg'], // Reduced from -2deg to -1deg for less wiggle
  });

  const styles = StyleSheet.create({
    wrapper: {
      marginBottom: 4,
      paddingLeft: 8,
      paddingTop: 4,
    },
    container: {
      flexDirection: 'row',
      backgroundColor: 'transparent',
      padding: 8,
      paddingLeft: 0,
    },
    iconContainer: {
      width: 48,
      height: 48,
      borderRadius: 10,
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
      fontSize: 15,
      fontFamily: fonts.semiBold,
      color: colors.text,
      marginBottom: 2,
    },
    subtitle: {
      fontSize: 13,
      fontFamily: fonts.regular,
      color: colors.textSecondary,
      lineHeight: 19,
    },
    removeButton: {
      position: 'absolute',
      top: -8,
      left: -8,
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: '#FF3B30',
      justifyContent: 'center',
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.2,
      shadowRadius: 3,
      elevation: 3,
      zIndex: 10,
    },
  });

  return (
    <View style={styles.wrapper}>
      <Animated.View style={{ transform: [{ rotate: rotation }] }}>
        <TouchableOpacity
          style={styles.container}
          onPress={isReorganizing ? undefined : onPress}
          onLongPress={isReorganizing ? drag : undefined}
          delayLongPress={200}
          activeOpacity={isReorganizing ? 0.9 : 0.7}
        >
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

        {isReorganizing && onRemove && (
          <TouchableOpacity
            style={styles.removeButton}
            onPress={onRemove}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <X size={14} color="#FFFFFF" />
          </TouchableOpacity>
        )}
      </Animated.View>
    </View>
  );
}
