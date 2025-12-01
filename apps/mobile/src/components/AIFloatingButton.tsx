import React, { useEffect, useRef } from 'react';
import { TouchableOpacity, Text, StyleSheet, Animated } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { Zap } from './icons';

interface AIFloatingButtonProps {
  onPress: () => void;
}

export function AIFloatingButton({ onPress }: AIFloatingButtonProps) {
  const { colors, fonts } = useTheme();
  const widthAnim = useRef(new Animated.Value(120)).current;
  const textOpacity = useRef(new Animated.Value(1)).current;

  const styles = StyleSheet.create({
    container: {
      position: 'absolute',
      bottom: 80,
      right: 16,
      height: 56,
      borderRadius: 28,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 8,
      overflow: 'hidden',
    },
    button: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 16,
      gap: 8,
    },
    text: {
      fontSize: 16,
      fontFamily: fonts.semiBold,
      color: '#FFFFFF',
    },
  });

  useEffect(() => {
    // Start expanded, then collapse after 3 seconds
    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(widthAnim, {
          toValue: 56,
          duration: 300,
          useNativeDriver: false,
        }),
        Animated.timing(textOpacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }, 3000);

    return () => clearTimeout(timer);
  }, []);

  return (
    <Animated.View
      style={[
        styles.container,
        {
          width: widthAnim,
          backgroundColor: colors.primary,
        },
      ]}
    >
      <TouchableOpacity
        style={styles.button}
        onPress={onPress}
        activeOpacity={0.8}
      >
        <Zap size={24} color="#FFFFFF" />
        <Animated.Text
          style={[
            styles.text,
            {
              opacity: textOpacity,
            },
          ]}
        >
          Ask AI
        </Animated.Text>
      </TouchableOpacity>
    </Animated.View>
  );
}
