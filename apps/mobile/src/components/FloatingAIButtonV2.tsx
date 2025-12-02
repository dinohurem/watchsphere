import React from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { AISparkle } from './icons';

interface FloatingAIButtonV2Props {
  onPress: () => void;
  onHide: () => void;
}

const BUTTON_SIZE = 56;

export function FloatingAIButtonV2({ onPress }: FloatingAIButtonV2Props) {
  const { colors } = useTheme();

  const styles = StyleSheet.create({
    container: {
      position: 'absolute',
      right: 20,
      bottom: Platform.OS === 'ios' ? 100 : 90,
      width: BUTTON_SIZE,
      height: BUTTON_SIZE,
      borderRadius: BUTTON_SIZE / 2,
      backgroundColor: '#FFFFFF',
      borderWidth: 1,
      borderColor: colors.primary,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 8,
      elevation: 8,
      zIndex: 1000,
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
        <AISparkle size={24} color={colors.primary} />
      </TouchableOpacity>
    </View>
  );
}
