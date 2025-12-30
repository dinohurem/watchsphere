import { View, Text, StyleSheet, ScrollView, TouchableOpacity, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useTheme } from '@/contexts/ThemeContext';
import { MessageSquare, Users, AISparkle } from '@/components/icons';
import { AIChatModal } from '@/components/AIChatModal';
import { SwipeableChatItem } from '@/components/SwipeableChatItem';
import { router } from 'expo-router';
import { wp, hp, sp, fp } from '@/utils/responsive';

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
  const { colors, fonts } = useTheme();
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
          <Text style={styles.conversationName}>{item.name}</Text>
          <Text style={styles.lastMessage} numberOfLines={1}>
            {item.lastMessage}
          </Text>
        </View>
        <View style={styles.rightSection}>
          {item.unread > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadText}>{item.unread}</Text>
            </View>
          )}
          <Text style={styles.timestamp}>{item.timestamp}</Text>
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
          <Text style={styles.conversationName}>{item.name}</Text>
          <Text style={styles.lastMessage} numberOfLines={1}>
            {item.lastMessage}
          </Text>
        </View>
        <View style={styles.rightSection}>
          {item.unread > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadText}>{item.unread}</Text>
            </View>
          )}
          <Text style={styles.timestamp}>{item.timestamp}</Text>
        </View>
      </TouchableOpacity>
    </SwipeableChatItem>
  );

  const renderAIChatItem = ({ item }: { item: AIChat }) => (
    <TouchableOpacity style={styles.conversationItem} onPress={() => router.push(`/chat/${item.id}` as any)}>
      <View style={[styles.avatar, styles.aiAvatar]}>
        <AISparkle size={20} color={colors.primary} />
      </View>
      <View style={styles.conversationContent}>
        <Text style={styles.conversationName}>{item.title}</Text>
        <Text style={styles.lastMessage} numberOfLines={1}>
          {item.preview}
        </Text>
      </View>
      <View style={styles.rightSection}>
        <Text style={styles.timestamp}>{item.timestamp}</Text>
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
                  <AISparkle size={48} color={colors.primary} />
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
      backgroundColor: '#FFFFFF',
    },
    header: {
      paddingHorizontal: wp(16),
      paddingTop: hp(12),
      paddingBottom: hp(20),
    },
    headerTitle: {
      fontSize: fp(28),
      fontFamily: fonts.bold,
      color: colors.text,
      paddingBottom: hp(12),
    },
    tabBar: {
      flexDirection: 'row',
      gap: wp(8),
    },
    tab: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: wp(8),
      paddingVertical: hp(11),
      paddingHorizontal: wp(20),
      borderRadius: sp(99),
      backgroundColor: 'rgba(33, 33, 33, 0.05)',
    },
    activeTab: {
      backgroundColor: '#212121',
    },
    tabText: {
      fontSize: fp(16),
      fontFamily: fonts.regular,
      color: '#212121',
      letterSpacing: 0.08,
    },
    activeTabText: {
      color: '#FFFFFF',
    },
    list: {
      flex: 1,
      paddingHorizontal: wp(16),
    },
    newChatButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      margin: wp(16),
      paddingVertical: hp(16),
      backgroundColor: colors.text,
      borderRadius: sp(12),
    },
    newChatButtonText: {
      fontSize: fp(17),
      fontFamily: fonts.semiBold,
      color: colors.background,
    },
    conversationItem: {
      flexDirection: 'row',
      paddingVertical: hp(12),
      paddingHorizontal: 0,
    },
    avatar: {
      width: sp(44),
      height: sp(44),
      borderRadius: sp(8),
      backgroundColor: '#F4F4F4',
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: wp(10),
    },
    aiAvatar: {
      backgroundColor: colors.primaryLight,
    },
    avatarText: {
      fontSize: fp(19),
      fontFamily: fonts.semiBold,
      color: '#212121',
    },
    conversationContent: {
      flex: 1,
      paddingLeft: wp(10),
      justifyContent: 'center',
    },
    conversationName: {
      fontSize: fp(15),
      fontFamily: fonts.regular,
      color: '#212121',
      letterSpacing: 0.075,
      marginBottom: hp(4),
    },
    rightSection: {
      alignItems: 'center',
      justifyContent: 'center',
      gap: hp(4),
    },
    timestamp: {
      fontSize: fp(13),
      fontFamily: fonts.regular,
      color: '#212121',
      opacity: 0.5,
      letterSpacing: 0.065,
    },
    lastMessage: {
      flex: 1,
      fontSize: fp(15),
      fontFamily: fonts.regular,
      color: '#212121',
      opacity: 0.5,
      letterSpacing: 0.075,
    },
    unreadBadge: {
      minWidth: sp(20),
      height: sp(20),
      borderRadius: sp(10),
      backgroundColor: colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: wp(6),
      marginLeft: wp(8),
    },
    unreadText: {
      fontSize: fp(13),
      fontFamily: fonts.semiBold,
      color: '#FFFFFF',
    },
    emptyState: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingTop: hp(100),
      paddingHorizontal: wp(32),
    },
    emptyText: {
      fontSize: fp(21),
      fontFamily: fonts.semiBold,
      color: colors.text,
      marginTop: hp(16),
      marginBottom: hp(8),
    },
    emptySubtext: {
      fontSize: fp(16),
      fontFamily: fonts.regular,
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
