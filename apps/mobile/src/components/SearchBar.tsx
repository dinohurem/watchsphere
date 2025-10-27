import { View, TextInput, StyleSheet } from 'react-native';
import { Search } from './icons';

interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
}

export function SearchBar({ value, onChangeText, placeholder = 'Search watches...' }: SearchBarProps) {
  return (
    <View style={styles.container}>
      <Search size={20} color="#8E8E93" />
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#8E8E93"
        autoCapitalize="none"
        autoCorrect={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 48,
    gap: 8,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: '#000000',
    fontWeight: '400',
  },
});
