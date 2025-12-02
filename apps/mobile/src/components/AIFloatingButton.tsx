import React from 'react';
import { TouchableOpacity, StyleSheet, View } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { Zap } from './icons';

interface AIFloatingButtonProps {
  onPress: () => void;
}

export function AIFloatingButton({ onPress }: AIFloatingButtonProps) {
  const { colors } = useTheme();

  const styles = StyleSheet.create({
    container: {
      position: 'absolute',
      bottom: 80,
      right: 16,
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: colors.primary,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 8,
    },
    button: {
      width: '100%',
      height: '100%',
      alignItems: 'center',
      justifyContent: 'center',
    },
  });

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.button}
        onPress={onPress}
        activeOpacity={0.8}
      >
        <Zap size={24} color="#FFFFFF" />
      </TouchableOpacity>
    </View>
  );
}
