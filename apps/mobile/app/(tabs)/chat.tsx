import { View, Text, StyleSheet, ScrollView, TouchableOpacity, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useTheme } from '@/contexts/ThemeContext';
import { MessageSquare, Users, Zap } from '@/components/icons';
import { AIChatModal } from '@/components/AIChatModal';
import { SwipeableChatItem } from '@/components/SwipeableChatItem';
import { router } from 'expo-router';

type TabType = 'conversations' | 'groups' | 'ai';

interface Conversation {
  id: string;
  name: string;
  lastMessage: string;
  timestamp: string;
  unread: number;
  avatar?: string;
}

interface AIChat {
  id: string;
  title: string;
  preview: string;
  timestamp: string;
}

export default function ChatScreen() {
  const { colors } = useTheme();
  const [activeTab, setActiveTab] = useState<TabType>('conversations');
  const [showAIChat, setShowAIChat] = useState(false);

  // Mock conversations data
  const conversations: Conversation[] = [
    {
      id: '1',
      name: 'John Dealer',
      lastMessage: 'Deal. How can I make the payment?',
      timestamp: '10:30 AM',
      unread: 2,
    },
    {
      id: '2',
      name: 'Sarah Collector',
      lastMessage: 'Is the watch still available?',
      timestamp: 'Yesterday',
      unread: 0,
    },
    {
      id: '3',
      name: 'Mike\'s Watches',
      lastMessage: 'I can ship it tomorrow',
      timestamp: '2 days ago',
      unread: 1,
    },
  ];

  // Mock groups data
  const groups: Conversation[] = [
    {
      id: 'g1',
      name: 'Rolex Enthusiasts',
      lastMessage: 'Great discussion about the new releases!',
      timestamp: '11:45 AM',
      unread: 5,
    },
    {
      id: 'g2',
      name: 'Vintage Watch Collectors',
      lastMessage: 'Anyone interested in a 1960s Omega?',
      timestamp: 'Yesterday',
      unread: 0,
    },
  ];

  // Mock AI chat history
  const aiChats: AIChat[] = [
    {
      id: 'ai1',
      title: 'Rolex Submariner Market Analysis',
      preview: 'What\'s the current market price for...',
      timestamp: 'Today',
    },
    {
      id: 'ai2',
      title: 'Authentication Help',
      preview: 'How do I authenticate my Patek Philippe...',
      timestamp: 'Yesterday',
    },
    {
      id: 'ai3',
      title: 'Selling Tips',
      preview: 'What are the best practices for...',
      timestamp: '3 days ago',
    },
  ];

  const renderConversationItem = ({ item }: { item: Conversation }) => (
    <SwipeableChatItem
      onMore={() => console.log('More:', item.id)}
      onPin={() => console.log('Pin:', item.id)}
      onDelete={() => console.log('Delete:', item.id)}
      isGroup={false}
    >
      <TouchableOpacity style={styles.conversationItem} onPress={() => router.push(`/chat/${item.id}` as any)}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{item.name.charAt(0)}</Text>
        </View>
        <View style={styles.conversationContent}>
          <View style={styles.conversationHeader}>
            <Text style={styles.conversationName}>{item.name}</Text>
            <Text style={styles.timestamp}>{item.timestamp}</Text>
          </View>
          <View style={styles.conversationFooter}>
            <Text style={styles.lastMessage} numberOfLines={1}>
              {item.lastMessage}
            </Text>
            {item.unread > 0 && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadText}>{item.unread}</Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    </SwipeableChatItem>
  );

  const renderGroupItem = ({ item }: { item: Conversation }) => (
    <SwipeableChatItem
      onMore={() => console.log('More:', item.id)}
      onPin={() => console.log('Pin:', item.id)}
      onDelete={() => console.log('Delete:', item.id)}
      isGroup={true}
    >
      <TouchableOpacity style={styles.conversationItem} onPress={() => router.push(`/chat/${item.id}` as any)}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{item.name.charAt(0)}</Text>
        </View>
        <View style={styles.conversationContent}>
          <View style={styles.conversationHeader}>
            <Text style={styles.conversationName}>{item.name}</Text>
            <Text style={styles.timestamp}>{item.timestamp}</Text>
          </View>
          <View style={styles.conversationFooter}>
            <Text style={styles.lastMessage} numberOfLines={1}>
              {item.lastMessage}
            </Text>
            {item.unread > 0 && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadText}>{item.unread}</Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    </SwipeableChatItem>
  );

  const renderAIChatItem = ({ item }: { item: AIChat }) => (
    <TouchableOpacity style={styles.conversationItem} onPress={() => router.push(`/chat/${item.id}` as any)}>
      <View style={[styles.avatar, styles.aiAvatar]}>
        <Zap size={20} color={colors.primary} />
      </View>
      <View style={styles.conversationContent}>
        <View style={styles.conversationHeader}>
          <Text style={styles.conversationName}>{item.title}</Text>
          <Text style={styles.timestamp}>{item.timestamp}</Text>
        </View>
        <Text style={styles.lastMessage} numberOfLines={1}>
          {item.preview}
        </Text>
      </View>
    </TouchableOpacity>
  );

  const renderTabContent = () => {
    switch (activeTab) {
      case 'conversations':
        return (
          <FlatList
            data={conversations}
            renderItem={renderConversationItem}
            keyExtractor={(item) => item.id}
            style={styles.list}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <MessageSquare size={48} color={colors.border} />
                <Text style={styles.emptyText}>No conversations yet</Text>
                <Text style={styles.emptySubtext}>
                  Start chatting with other users about watches
                </Text>
              </View>
            }
          />
        );
      case 'groups':
        return (
          <FlatList
            data={groups}
            renderItem={renderGroupItem}
            keyExtractor={(item) => item.id}
            style={styles.list}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Users size={48} color={colors.border} />
                <Text style={styles.emptyText}>No groups yet</Text>
                <Text style={styles.emptySubtext}>
                  You'll see groups here when admin adds you
                </Text>
              </View>
            }
          />
        );
      case 'ai':
        return (
          <>
            <TouchableOpacity
              style={styles.newChatButton}
              onPress={() => setShowAIChat(true)}
            >
              <Text style={styles.newChatButtonText}>New Chat</Text>
            </TouchableOpacity>
            <FlatList
              data={aiChats}
              renderItem={renderAIChatItem}
              keyExtractor={(item) => item.id}
              style={styles.list}
              ListEmptyComponent={
                <View style={styles.emptyState}>
                  <Zap size={48} color={colors.border} />
                  <Text style={styles.emptyText}>No AI chat history</Text>
                  <Text style={styles.emptySubtext}>
                    Start a conversation with our AI assistant
                  </Text>
                </View>
              }
            />
          </>
        );
    }
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: 12,
    },
    headerTitle: {
      fontSize: 28,
      fontWeight: '700',
      color: colors.text,
      paddingBottom: 12,
    },
    tabBar: {
      flexDirection: 'row',
      gap: 8,
    },
    tab: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 10,
      borderRadius: 20,
      backgroundColor: colors.backgroundSecondary,
    },
    activeTab: {
      backgroundColor: colors.text,
    },
    tabText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
    },
    activeTabText: {
      color: colors.background,
    },
    list: {
      flex: 1,
    },
    newChatButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      margin: 16,
      paddingVertical: 16,
      backgroundColor: colors.text,
      borderRadius: 12,
    },
    newChatButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.background,
    },
    conversationItem: {
      flexDirection: 'row',
      padding: 16,
    },
    avatar: {
      width: 48,
      height: 48,
      borderRadius: 8,
      backgroundColor: colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 12,
    },
    aiAvatar: {
      backgroundColor: colors.primaryLight,
    },
    avatarText: {
      fontSize: 18,
      fontWeight: '600',
      color: '#FFFFFF',
    },
    conversationContent: {
      flex: 1,
    },
    conversationHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 2,
    },
    conversationName: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
    },
    timestamp: {
      fontSize: 13,
      fontWeight: '400',
      color: colors.textSecondary,
    },
    conversationFooter: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    lastMessage: {
      flex: 1,
      fontSize: 14,
      fontWeight: '400',
      color: colors.textSecondary,
    },
    unreadBadge: {
      minWidth: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 6,
      marginLeft: 8,
    },
    unreadText: {
      fontSize: 12,
      fontWeight: '600',
      color: '#FFFFFF',
    },
    emptyState: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingTop: 100,
      paddingHorizontal: 32,
    },
    emptyText: {
      fontSize: 20,
      fontWeight: '600',
      color: colors.text,
      marginTop: 16,
      marginBottom: 8,
    },
    emptySubtext: {
      fontSize: 15,
      fontWeight: '400',
      color: colors.textSecondary,
      textAlign: 'center',
    },
  });

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView style={styles.container} edges={['top']}>
        {/* Header with Tabs */}
        <View style={styles.header}>
          <View style={styles.tabBar}>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'conversations' && styles.activeTab]}
              onPress={() => setActiveTab('conversations')}
            >
              <Text
                style={[styles.tabText, activeTab === 'conversations' && styles.activeTabText]}
              >
                Conversations
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tab, activeTab === 'groups' && styles.activeTab]}
              onPress={() => setActiveTab('groups')}
            >
              <Text style={[styles.tabText, activeTab === 'groups' && styles.activeTabText]}>
                Groups
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tab, activeTab === 'ai' && styles.activeTab]}
              onPress={() => setActiveTab('ai')}
            >
              <Text style={[styles.tabText, activeTab === 'ai' && styles.activeTabText]}>AI</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Tab Content */}
        {renderTabContent()}

        {/* AI Chat Modal */}
        <AIChatModal visible={showAIChat} onClose={() => setShowAIChat(false)} />
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}
