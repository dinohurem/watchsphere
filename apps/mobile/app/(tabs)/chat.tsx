import { View, Text, StyleSheet, TouchableOpacity, FlatList, RefreshControl, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect, useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useTheme } from '@/contexts/ThemeContext';
import { useTranslation } from 'react-i18next';
import { useChat } from '@/contexts/ChatContext';
import { MessageSquare, Users, AISparkle, Plus } from '@/components/icons';
import { SwipeableChatItem } from '@/components/SwipeableChatItem';
import { ImagePlaceholder } from '@/components/ImagePlaceholder';
import { router } from 'expo-router';
import { wp, hp, sp, fp } from '@/utils/responsive';
import Svg, { Path } from 'react-native-svg';
import { api } from '@/services/api';

// Sparkle icon for AI chat items (matches Figma design exactly)
function SparkleIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 18 18" fill="none">
      <Path
        d="M9 1.5L10.5 6L15 7.5L10.5 9L9 13.5L7.5 9L3 7.5L7.5 6L9 1.5Z"
        fill="#9747FF"
      />
      <Path
        d="M14.25 12L15 13.5L16.5 14.25L15 15L14.25 16.5L13.5 15L12 14.25L13.5 13.5L14.25 12Z"
        fill="#9747FF"
      />
      <Path
        d="M4.5 11.25L5.0625 12.375L6.1875 12.9375L5.0625 13.5L4.5 14.625L3.9375 13.5L2.8125 12.9375L3.9375 12.375L4.5 11.25Z"
        fill="#9747FF"
      />
    </Svg>
  );
}

type TabType = 'conversations' | 'groups' | 'ai';

interface Conversation {
  id: string;
  name: string;
  lastMessage: string;
  timestamp: string;
  unread: number;
  avatar?: string;
  participant_id?: string;  // The other participant's user ID
}

interface AIChat {
  id: string;
  title: string;
  createdAt?: string;
}

interface Group {
  id: string;
  name: string;
  description?: string;
  avatar?: string;
  lastMessage?: string;
  timestamp?: string;
  unread?: number;
  memberCount?: number;
}

export default function ChatScreen() {
  const { colors, fonts } = useTheme();
  const { t } = useTranslation();
  const {
    updateConversationsFromApi,
    updateGroupsFromApi,
    conversations: contextConversations,
    groups: contextGroups,
  } = useChat();
  const [activeTab, setActiveTab] = useState<TabType>('conversations');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [aiChats, setAiChats] = useState<AIChat[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(false);

  // Helper function to safely format timestamp
  const formatTimestamp = (date: Date | string | undefined): string | undefined => {
    if (!date) return undefined;
    try {
      const dateObj = date instanceof Date ? date : new Date(date);
      if (isNaN(dateObj.getTime())) return undefined;
      return dateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return undefined;
    }
  };

  // Sync with ChatContext for real-time updates (unread counts, last messages)
  // This ensures the list updates in real-time when new messages arrive
  useEffect(() => {
    if (contextConversations.length > 0) {
      setConversations(prev => {
        // Merge real-time updates from context with existing data
        return prev.map(conv => {
          const contextConv = contextConversations.find(c => c.id === conv.id);
          if (contextConv) {
            const formattedTimestamp = formatTimestamp(contextConv.updatedAt);
            return {
              ...conv,
              unread: contextConv.unreadCount,
              lastMessage: contextConv.lastMessage?.content || conv.lastMessage,
              timestamp: formattedTimestamp || conv.timestamp,
            };
          }
          return conv;
        });
      });
    }
  }, [contextConversations]);

  useEffect(() => {
    if (contextGroups.length > 0) {
      setGroups(prev => {
        // Merge real-time updates from context with existing data
        return prev.map(group => {
          const contextGroup = contextGroups.find(g => g.id === group.id);
          if (contextGroup) {
            const formattedTimestamp = formatTimestamp(contextGroup.updatedAt);
            return {
              ...group,
              unread: contextGroup.unreadCount,
              lastMessage: contextGroup.lastMessage?.content || group.lastMessage,
              timestamp: formattedTimestamp || group.timestamp,
            };
          }
          return group;
        });
      });
    }
  }, [contextGroups]);

  // Refresh data when screen comes into focus (also fires on initial mount)
  // Also load both conversations and groups to keep the badge accurate
  useFocusEffect(
    useCallback(() => {
      loadTabData();
      // Always load both to keep the unread badge accurate
      if (activeTab !== 'conversations') loadConversations();
      if (activeTab !== 'groups') loadGroups();
    }, [activeTab])
  );

  const loadTabData = async () => {
    switch (activeTab) {
      case 'conversations':
        await loadConversations();
        break;
      case 'groups':
        await loadGroups();
        break;
      case 'ai':
        await loadAiChats();
        break;
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadTabData();
    setRefreshing(false);
  }, [activeTab]);

  const loadConversations = async () => {
    try {
      setLoading(true);
      const response = await api.get('/chat/conversations');
      if (response.data) {
        setConversations(response.data);
        // Sync to ChatContext so tab bar badge is accurate
        updateConversationsFromApi(response.data);
      }
    } catch (error) {
      console.log('Conversations not available yet');
      setConversations([]);
      // Clear ChatContext conversations to reset the badge
      updateConversationsFromApi([]);
    } finally {
      setLoading(false);
    }
  };

  const loadGroups = async () => {
    try {
      setLoading(true);
      const response = await api.get('/chat/groups');
      if (response.data) {
        setGroups(response.data);
        // Sync to ChatContext so tab bar badge includes group unreads
        updateGroupsFromApi(response.data);
      }
    } catch (error) {
      console.log('Groups not available yet');
      setGroups([]);
      // Clear groups in ChatContext
      updateGroupsFromApi([]);
    } finally {
      setLoading(false);
    }
  };

  const loadAiChats = async () => {
    try {
      setLoading(true);
      // Load from backend API to match Ask AI screen
      const response = await api.get('/ai-chats');
      if (response.data) {
        setAiChats(response.data);
      } else {
        setAiChats([]);
      }
    } catch (error) {
      console.error('Error loading AI chats:', error);
      setAiChats([]);
    } finally {
      setLoading(false);
    }
  };


  const handleMarkAsRead = async (chatId: string, isGroup: boolean) => {
    try {
      const endpoint = isGroup
        ? `/chat/groups/${chatId}/read`
        : `/chat/conversations/${chatId}/read`;
      await api.post(endpoint);
      // Update local state and ChatContext
      if (isGroup) {
        const updatedGroups = groups.map(g => g.id === chatId ? { ...g, unread: 0 } : g);
        setGroups(updatedGroups);
        updateGroupsFromApi(updatedGroups);
      } else {
        const updatedConversations = conversations.map(c => c.id === chatId ? { ...c, unread: 0 } : c);
        setConversations(updatedConversations);
        updateConversationsFromApi(updatedConversations);
      }
    } catch (error) {
      console.error('Failed to mark as read:', error);
    }
  };

  const handleDeleteChat = async (chatId: string, isGroup: boolean) => {
    try {
      const endpoint = isGroup
        ? `/chat/groups/${chatId}`
        : `/chat/conversations/${chatId}`;
      await api.delete(endpoint);
      // Update local state and ChatContext
      if (isGroup) {
        const updatedGroups = groups.filter(g => g.id !== chatId);
        setGroups(updatedGroups);
        updateGroupsFromApi(updatedGroups);
      } else {
        const updatedConversations = conversations.filter(c => c.id !== chatId);
        setConversations(updatedConversations);
        updateConversationsFromApi(updatedConversations);
      }
    } catch (error) {
      console.error('Failed to delete chat:', error);
    }
  };

  const renderConversationItem = ({ item }: { item: Conversation }) => (
    <SwipeableChatItem
      onMore={() => handleMarkAsRead(item.id, false)}
      onDelete={() => handleDeleteChat(item.id, false)}
      isGroup={false}
      chatId={item.id}
      chatName={item.name}
    >
      <TouchableOpacity style={styles.conversationItem} onPress={() => router.push(`/chat/${item.id}` as any)}>
        {item.avatar ? (
          <Image source={{ uri: item.avatar }} style={styles.conversationAvatar} />
        ) : (
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{item.name.charAt(0)}</Text>
          </View>
        )}
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

  const renderGroupItem = ({ item }: { item: Group }) => (
    <SwipeableChatItem
      onMore={() => handleMarkAsRead(item.id, true)}
      onDelete={() => handleDeleteChat(item.id, true)}
      isGroup={true}
      chatId={item.id}
      chatName={item.name}
    >
      <TouchableOpacity style={styles.conversationItem} onPress={() => router.push({ pathname: '/chat/group/[id]', params: { id: item.id } } as any)}>
        {item.avatar ? (
          <Image source={{ uri: item.avatar }} style={styles.groupAvatar} />
        ) : (
          <ImagePlaceholder size={sp(44)} borderRadius={sp(8)} />
        )}
        <View style={styles.conversationContent}>
          <Text style={styles.conversationName}>{item.name}</Text>
          <Text style={styles.lastMessage} numberOfLines={1}>
            {item.lastMessage || item.description || t('chat.noMessagesYet')}
          </Text>
        </View>
        <View style={styles.rightSection}>
          {(item.unread ?? 0) > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadText}>{item.unread}</Text>
            </View>
          )}
          <Text style={styles.timestamp}>{item.timestamp || ''}</Text>
        </View>
      </TouchableOpacity>
    </SwipeableChatItem>
  );

  // Render AI chat item matching Figma design (same as Ask AI page)
  const renderAIChatItem = ({ item }: { item: AIChat }) => (
    <TouchableOpacity
      style={styles.aiChatItem}
      onPress={() => router.push({
        pathname: '/chat/ai/[id]',
        params: { id: item.id, title: item.title },
      } as any)}
      activeOpacity={0.7}
    >
      <View style={styles.aiChatIconContainer}>
        <SparkleIcon />
      </View>
      <View style={styles.aiChatTextContainer}>
        <Text style={styles.aiChatTitle} numberOfLines={2}>
          {item.title}
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
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#212121" />
            }
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <MessageSquare size={48} color={colors.textTertiary} />
                <Text style={styles.emptyText}>{t('chat.noConversations')}</Text>
                <Text style={styles.emptySubtext}>
                  {t('chat.startChatting')}
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
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#212121" />
            }
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Users size={48} color={colors.textTertiary} />
                <Text style={styles.emptyText}>{t('chat.noGroups')}</Text>
                <Text style={styles.emptySubtext}>
                  {t('chat.groupsAppearHere')}
                </Text>
              </View>
            }
          />
        );
      case 'ai':
        return (
          <FlatList
            data={aiChats}
            renderItem={renderAIChatItem}
            keyExtractor={(item) => item.id}
            style={styles.list}
            contentContainerStyle={styles.aiListContent}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#212121" />
            }
            ListHeaderComponent={
              <TouchableOpacity
                style={styles.newAiChatButton}
                onPress={() => router.push('/chat/ai/new')}
              >
                <Plus size={20} color="#212121" />
                <Text style={styles.newAiChatButtonText}>{t('common.newChat')}</Text>
              </TouchableOpacity>
            }
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <View style={styles.emptyIcon}>
                  <AISparkle size={32} color="#9747FF" />
                </View>
                <Text style={styles.emptyText}>{t('chat.noAIConversations')}</Text>
                <Text style={styles.emptySubtext}>
                  {t('chat.startAIChat')}
                </Text>
              </View>
            }
          />
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
    conversationItem: {
      flexDirection: 'row',
      paddingVertical: hp(12),
      paddingHorizontal: 0,
    },
    avatar: {
      width: sp(44),
      height: sp(44),
      borderRadius: sp(22),
      backgroundColor: '#F4F4F4',
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: wp(10),
    },
    conversationAvatar: {
      width: sp(44),
      height: sp(44),
      borderRadius: sp(22),
      marginRight: wp(10),
    },
    groupAvatar: {
      width: sp(44),
      height: sp(44),
      borderRadius: sp(8),
      marginRight: wp(10),
    },
    aiAvatar: {
      backgroundColor: colors.primaryLight,
    },
    // AI Chat List styles (matching Figma design)
    aiListContent: {
      paddingTop: hp(8),
    },
    newAiChatButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: wp(8),
      marginBottom: hp(16),
      paddingVertical: hp(14),
      backgroundColor: 'rgba(33, 33, 33, 0.04)',
      borderRadius: sp(12),
    },
    newAiChatButtonText: {
      fontSize: fp(15),
      fontFamily: fonts.semiBold,
      color: '#212121',
      letterSpacing: 0.075,
    },
    aiChatItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: hp(12),
    },
    aiChatIconContainer: {
      width: sp(44),
      height: sp(44),
      borderRadius: sp(8),
      backgroundColor: '#F4F4F4',
      justifyContent: 'center',
      alignItems: 'center',
    },
    aiChatTextContainer: {
      flex: 1,
      paddingLeft: wp(10),
    },
    aiChatTitle: {
      fontSize: fp(15),
      fontFamily: fonts.regular,
      color: '#212121',
      lineHeight: fp(20),
      letterSpacing: 0.075,
    },
    emptyIcon: {
      width: sp(64),
      height: sp(64),
      borderRadius: sp(32),
      backgroundColor: 'rgba(151, 71, 255, 0.1)',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: hp(16),
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
      backgroundColor: colors.error,
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
      color: '#666666',
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
                {t('chat.conversations')}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tab, activeTab === 'groups' && styles.activeTab]}
              onPress={() => setActiveTab('groups')}
            >
              <Text style={[styles.tabText, activeTab === 'groups' && styles.activeTabText]}>
                {t('chat.groups')}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tab, activeTab === 'ai' && styles.activeTab]}
              onPress={() => setActiveTab('ai')}
            >
              <Text style={[styles.tabText, activeTab === 'ai' && styles.activeTabText]}>{t('chat.ai')}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Tab Content */}
        {renderTabContent()}
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}
