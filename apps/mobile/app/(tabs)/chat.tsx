import { View, Text, StyleSheet, TouchableOpacity, FlatList, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useTheme } from '@/contexts/ThemeContext';
import { MessageSquare, Users, AISparkle, Plus } from '@/components/icons';
import { SwipeableChatItem } from '@/components/SwipeableChatItem';
import { router } from 'expo-router';
import { wp, hp, sp, fp } from '@/utils/responsive';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
  lastMessage?: string;
  timestamp?: string;
  unread?: number;
  memberCount?: number;
}

export default function ChatScreen() {
  const { colors, fonts } = useTheme();
  const [activeTab, setActiveTab] = useState<TabType>('conversations');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [aiChats, setAiChats] = useState<AIChat[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(false);

  // Load data based on active tab
  useEffect(() => {
    loadTabData();
  }, [activeTab]);

  // Refresh data when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadTabData();
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
      }
    } catch (error) {
      console.log('Conversations not available yet');
      setConversations([]);
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
      }
    } catch (error) {
      console.log('Groups not available yet');
      setGroups([]);
    } finally {
      setLoading(false);
    }
  };

  const loadAiChats = async () => {
    try {
      setLoading(true);
      const savedChats = await AsyncStorage.getItem('ai_chats');
      if (savedChats) {
        const parsedChats = JSON.parse(savedChats);
        setAiChats(parsedChats);
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

  const renderGroupItem = ({ item }: { item: Group }) => (
    <SwipeableChatItem
      onMore={() => console.log('More:', item.id)}
      onPin={() => console.log('Pin:', item.id)}
      onDelete={() => console.log('Delete:', item.id)}
      isGroup={true}
    >
      <TouchableOpacity style={styles.conversationItem} onPress={() => router.push(`/chat/group/${item.id}` as any)}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{item.name.charAt(0)}</Text>
        </View>
        <View style={styles.conversationContent}>
          <Text style={styles.conversationName}>{item.name}</Text>
          <Text style={styles.lastMessage} numberOfLines={1}>
            {item.lastMessage || item.description || 'No messages yet'}
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
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#212121" />
            }
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
                <Plus size={18} color="#212121" />
                <Text style={styles.newAiChatButtonText}>New Chat</Text>
              </TouchableOpacity>
            }
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <View style={styles.emptyIcon}>
                  <AISparkle size={32} color="#9747FF" />
                </View>
                <Text style={styles.emptyText}>No conversations yet</Text>
                <Text style={styles.emptySubtext}>
                  Start a new chat to ask questions about watches
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
      borderRadius: sp(8),
      backgroundColor: '#F4F4F4',
      justifyContent: 'center',
      alignItems: 'center',
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
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}
