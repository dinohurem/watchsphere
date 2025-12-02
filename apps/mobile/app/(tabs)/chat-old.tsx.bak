import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState } from 'react';
import { ChatBubble } from '@/components/ChatBubble';
import { ChatInput } from '@/components/ChatInput';
import { ArrowLeft } from '@/components/icons';

export default function ChatScreen() {
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([
    { id: '1', text: "Hi, I'd like to buy it", isUser: true },
    { id: '2', text: 'Can you do better price if I pay today?', isUser: true },
    { id: '3', text: '€12,200 net, valid for 24 hours.', isUser: false },
    { id: '4', text: 'I can reserve it for you', isUser: false },
    { id: '5', text: 'Deal. How can I make the payment?', isUser: true },
  ]);

  const handleSend = () => {
    if (message.trim()) {
      setMessages([...messages, { id: Date.now().toString(), text: message, isUser: true }]);
      setMessage('');
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton}>
          <ArrowLeft size={24} color="#000000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Chat</Text>
        <View style={styles.headerRight} />
      </View>

      {/* Watch Info Header */}
      <View style={styles.watchInfoHeader}>
        <View style={styles.watchThumbnail} />
        <View style={styles.watchInfo}>
          <Text style={styles.watchTitle}>Rolex Submariner Date</Text>
          <Text style={styles.watchPrice}>€12,352</Text>
        </View>
      </View>

      {/* Messages */}
      <ScrollView
        style={styles.messagesContainer}
        contentContainerStyle={styles.messagesContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.dateLabel}>Today</Text>

        {messages.map((msg) => (
          <ChatBubble
            key={msg.id}
            message={msg.text}
            isUser={msg.isUser}
          />
        ))}
      </ScrollView>

      {/* Input */}
      <ChatInput
        value={message}
        onChangeText={setMessage}
        onSend={handleSend}
        onImagePress={() => console.log('Image picker')}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#000000',
  },
  headerRight: {
    width: 40,
  },
  watchInfoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  watchThumbnail: {
    width: 56,
    height: 56,
    borderRadius: 8,
    backgroundColor: '#F5F5F5',
    marginRight: 12,
  },
  watchInfo: {
    flex: 1,
  },
  watchTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 4,
  },
  watchPrice: {
    fontSize: 14,
    fontWeight: '400',
    color: '#8E8E93',
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    paddingTop: 16,
    paddingBottom: 16,
  },
  dateLabel: {
    fontSize: 13,
    fontWeight: '400',
    color: '#8E8E93',
    textAlign: 'center',
    marginBottom: 16,
  },
});
