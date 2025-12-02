import { TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Sparkles } from './icons';

interface FloatingAIButtonProps {
  onPress: () => void;
}

export function FloatingAIButton({ onPress }: FloatingAIButtonProps) {
  return (
    <TouchableOpacity
      style={styles.floatingButton}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <Sparkles size={24} color="#FFFFFF" />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  floatingButton: {
    position: 'absolute',
    right: 20,
    // Position above the tab bar (tab bar is typically ~50-80px high)
    // Adding extra space to ensure it's above the Profile tab
    bottom: Platform.OS === 'ios' ? 90 : 80,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
    elevation: 8,
    zIndex: 1000,
  },
});
