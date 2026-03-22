import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, RefreshControl } from 'react-native';
import { LoadingAnimation } from '@/components/LoadingAnimation';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useState, useEffect, useCallback } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { BackArrow, Newspaper } from '@/components/icons';
import { api } from '@/services/api';
import { wp, hp, sp, fp } from '@/utils/responsive';
import { useTranslation } from 'react-i18next';

interface NewsArticle {
  id: string;
  title: string;
  excerpt?: string;
  cover_image?: string;
  author_name: string;
  published_at?: string;
  created_at: string;
}

export default function NewsListScreen() {
  const { t } = useTranslation();
  const { colors, fonts } = useTheme();
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadNews();
  }, []);

  const loadNews = async () => {
    try {
      const response = await api.get('/news?limit=50');
      if (response.data && Array.isArray(response.data)) {
        setArticles(response.data);
      }
    } catch (error) {
      console.error('Failed to load news:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadNews();
    setRefreshing(false);
  }, []);

  const formatTimeAgo = (dateString?: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return t('common.justNow');
    if (diffMins < 60) return `${diffMins} ${t('common.minAgo')}`;
    if (diffHours < 24) return `${diffHours} ${diffHours > 1 ? t('common.hoursAgo') : t('common.hourAgo')}`;
    return `${diffDays} ${diffDays > 1 ? t('common.daysAgo') : t('common.dayAgo')}`;
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#FFFFFF',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: wp(8),
      paddingVertical: hp(12),
      borderBottomWidth: 1,
      borderBottomColor: 'rgba(33, 33, 33, 0.05)',
    },
    backButton: {
      width: sp(44),
      height: sp(44),
      justifyContent: 'center',
      alignItems: 'center',
    },
    headerTitle: {
      flex: 1,
      fontSize: fp(17),
      fontFamily: fonts.semiBold,
      color: '#212121',
      textAlign: 'center',
      marginRight: sp(44),
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      paddingHorizontal: wp(16),
      paddingVertical: hp(16),
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    emptyState: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: hp(60),
    },
    emptyIconContainer: {
      width: sp(64),
      height: sp(64),
      borderRadius: sp(32),
      backgroundColor: 'rgba(33, 33, 33, 0.05)',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: hp(16),
    },
    emptyTitle: {
      fontSize: fp(17),
      fontFamily: fonts.semiBold,
      color: '#212121',
      marginBottom: hp(8),
    },
    emptySubtitle: {
      fontSize: fp(14),
      fontFamily: fonts.regular,
      color: 'rgba(33, 33, 33, 0.6)',
      textAlign: 'center',
    },
    newsItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: wp(12),
      paddingVertical: hp(16),
      borderBottomWidth: 1,
      borderBottomColor: 'rgba(33, 33, 33, 0.05)',
    },
    newsImage: {
      width: sp(80),
      height: sp(80),
      borderRadius: sp(12),
      backgroundColor: '#F6F7F9',
    },
    newsImagePlaceholder: {
      width: sp(80),
      height: sp(80),
      borderRadius: sp(12),
      backgroundColor: '#F6F7F9',
      justifyContent: 'center',
      alignItems: 'center',
    },
    newsContent: {
      flex: 1,
      gap: hp(4),
    },
    newsTitle: {
      fontSize: fp(15),
      fontFamily: fonts.semiBold,
      color: '#212121',
      letterSpacing: 0.075,
      lineHeight: fp(20),
    },
    newsMetaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: wp(4),
    },
    newsSource: {
      fontSize: fp(13),
      fontFamily: fonts.medium,
      color: '#787789',
      letterSpacing: -0.13,
    },
    newsTime: {
      fontSize: fp(13),
      fontFamily: fonts.medium,
      color: '#787789',
      letterSpacing: -0.13,
    },
  });

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <BackArrow size={24} color="#212121" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('news.news')}</Text>
        </View>
        <View style={styles.loadingContainer}>
          <LoadingAnimation />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <BackArrow size={24} color="#212121" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('news.news')}</Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#212121" />
        }
      >
        {articles.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconContainer}>
              <Newspaper size={28} color="rgba(33, 33, 33, 0.4)" />
            </View>
            <Text style={styles.emptyTitle}>{t('news.noNewsAvailable')}</Text>
            <Text style={styles.emptySubtitle}>{t('news.checkBackLater')}</Text>
          </View>
        ) : (
          articles.map((article) => (
            <TouchableOpacity
              key={article.id}
              style={styles.newsItem}
              activeOpacity={0.7}
              onPress={() => router.push(`/news/${article.id}`)}
            >
              {article.cover_image ? (
                <Image source={{ uri: article.cover_image }} style={styles.newsImage} />
              ) : (
                <View style={styles.newsImagePlaceholder}>
                  <Newspaper size={24} color="rgba(33, 33, 33, 0.3)" />
                </View>
              )}
              <View style={styles.newsContent}>
                <Text style={styles.newsTitle} numberOfLines={2}>{article.title}</Text>
                <View style={styles.newsMetaRow}>
                  <Text style={styles.newsSource}>{article.author_name || 'WatchSphere'}</Text>
                  <Text style={styles.newsTime}> · </Text>
                  <Text style={styles.newsTime}>
                    {formatTimeAgo(article.published_at || article.created_at)}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
