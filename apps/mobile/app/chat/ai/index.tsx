import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, Stack } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { AISparkle, Plus, ChevronLeft } from '@/components/icons';
import { wp, hp, sp, fp } from '@/utils/responsive';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Svg, { Path } from 'react-native-svg';

// Sparkle icon for chat items (smaller, matches Figma)
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

interface AIChat {
  id: string;
  title: string;
  lastMessage?: string;
  createdAt: string;
}

export default function AskAIScreen() {
  const { fonts } = useTheme();
  const [chats, setChats] = useState<AIChat[]>([]);

  // Load chats from storage
  useEffect(() => {
    loadChats();
  }, []);

  const loadChats = async () => {
    try {
      const savedChats = await AsyncStorage.getItem('ai_chats');
      if (savedChats) {
        const parsedChats = JSON.parse(savedChats);
        setChats(parsedChats);
      } else {
        setChats([]);
      }
    } catch (error) {
      console.error('Error loading AI chats:', error);
      setChats([]);
    }
  };

  const handleNewChat = () => {
    router.push('/chat/ai/new');
  };

  const handleChatPress = (chat: AIChat) => {
    router.push({
      pathname: '/chat/ai/[id]',
      params: { id: chat.id, title: chat.title },
    });
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#FFFFFF',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: wp(8),
      height: hp(44),
      borderBottomWidth: 1,
      borderBottomColor: 'rgba(33, 33, 33, 0.05)',
      backgroundColor: '#FFFFFF',
    },
    headerCenter: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: wp(8),
    },
    headerTitle: {
      fontSize: fp(18),
      fontFamily: fonts.semiBold,
      color: '#212121',
      letterSpacing: 0.09,
      lineHeight: fp(20),
    },
    backButton: {
      position: 'absolute',
      left: wp(8),
      width: sp(44),
      height: sp(44),
      justifyContent: 'center',
      alignItems: 'center',
    },
    addButton: {
      position: 'absolute',
      right: wp(8),
      width: sp(44),
      height: sp(44),
      justifyContent: 'center',
      alignItems: 'center',
    },
    content: {
      flex: 1,
    },
    chatList: {
      paddingHorizontal: wp(20),
      paddingTop: hp(24),
    },
    chatItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: hp(12),
    },
    chatIconContainer: {
      width: sp(44),
      height: sp(44),
      borderRadius: sp(8),
      backgroundColor: '#F4F4F4',
      justifyContent: 'center',
      alignItems: 'center',
    },
    chatTextContainer: {
      flex: 1,
      paddingLeft: wp(10),
    },
    chatTitle: {
      fontSize: fp(15),
      fontFamily: fonts.regular,
      color: '#212121',
      lineHeight: fp(20),
      letterSpacing: 0.075,
    },
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: wp(40),
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
    emptyTitle: {
      fontSize: fp(20),
      fontFamily: fonts.semiBold,
      color: '#212121',
      marginBottom: hp(8),
      textAlign: 'center',
    },
    emptySubtitle: {
      fontSize: fp(15),
      fontFamily: fonts.regular,
      color: 'rgba(33, 33, 33, 0.6)',
      textAlign: 'center',
      lineHeight: fp(22),
    },
  });

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <ChevronLeft size={24} color="#212121" />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <AISparkle size={20} color="#9747FF" />
            <Text style={styles.headerTitle}>Ask AI</Text>
          </View>
          <TouchableOpacity style={styles.addButton} onPress={handleNewChat}>
            <Plus size={18} color="#212121" />
          </TouchableOpacity>
        </View>

        {/* Chat List */}
        <ScrollView
          style={styles.content}
          contentContainerStyle={chats.length === 0 ? { flex: 1 } : styles.chatList}
          showsVerticalScrollIndicator={false}
        >
          {chats.length === 0 ? (
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIcon}>
                <AISparkle size={32} color="#9747FF" />
              </View>
              <Text style={styles.emptyTitle}>No conversations yet</Text>
              <Text style={styles.emptySubtitle}>
                Start a new chat to ask questions about watches, market trends, and more.
              </Text>
            </View>
          ) : (
            chats.map((chat) => (
              <TouchableOpacity
                key={chat.id}
                style={styles.chatItem}
                onPress={() => handleChatPress(chat)}
                activeOpacity={0.7}
              >
                <View style={styles.chatIconContainer}>
                  <SparkleIcon />
                </View>
                <View style={styles.chatTextContainer}>
                  <Text style={styles.chatTitle} numberOfLines={2}>
                    {chat.title}
                  </Text>
                </View>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      </SafeAreaView>
    </>
  );
}
