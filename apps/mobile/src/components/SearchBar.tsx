import { View, TextInput, StyleSheet } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { Search } from './icons';

interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
}

export function SearchBar({ value, onChangeText, placeholder = 'Search watches...' }: SearchBarProps) {
  const { colors } = useTheme();

  const styles = StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.backgroundTertiary,
      borderRadius: 12,
      paddingHorizontal: 16,
      height: 48,
      gap: 8,
    },
    input: {
      flex: 1,
      fontSize: 15,
      color: colors.text,
      fontWeight: '400',
    },
  });

  return (
    <View style={styles.container}>
      <Search size={20} color={colors.textTertiary} />
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textTertiary}
        autoCapitalize="none"
        autoCorrect={false}
      />
    </View>
  );
}
