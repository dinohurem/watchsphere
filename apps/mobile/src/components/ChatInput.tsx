import { View, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { Image, Send } from './icons';

interface ChatInputProps {
  value: string;
  onChangeText: (text: string) => void;
  onSend: () => void;
  onImagePress?: () => void;
}

export function ChatInput({ value, onChangeText, onSend, onImagePress }: ChatInputProps) {
  return (
    <View style={styles.container}>
      <View style={styles.inputContainer}>
        {onImagePress && (
          <TouchableOpacity onPress={onImagePress} style={styles.iconButton}>
            <Image size={24} color="#8E8E93" />
          </TouchableOpacity>
        )}
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          placeholder="Send message..."
          placeholderTextColor="#C7C7CC"
          multiline
        />
      </View>
      {value.trim().length > 0 && (
        <TouchableOpacity style={styles.sendButton} onPress={onSend}>
          <Send size={20} color="#FFFFFF" />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
    gap: 8,
  },
  inputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 24,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: 44,
  },
  iconButton: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 15,
    fontWeight: '400',
    color: '#000000',
    maxHeight: 100,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
