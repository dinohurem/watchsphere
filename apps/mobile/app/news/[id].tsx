import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { useState, useEffect } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { BackArrow } from '@/components/icons';
import { api } from '@/services/api';

interface NewsArticle {
  id: string;
  title: string;
  content: string;
  excerpt?: string;
  cover_image?: string;
  author_name: string;
  published_at?: string;
  created_at: string;
  source_url?: string;
}

export default function NewsArticleScreen() {
  const { colors, fonts } = useTheme();
  const params = useLocalSearchParams();
  const id = typeof params.id === 'string' ? params.id : '';

  const [article, setArticle] = useState<NewsArticle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadArticle();
  }, [id]);

  const loadArticle = async () => {
    if (!id) {
      setError('Article not found');
      setLoading(false);
      return;
    }

    try {
      const response = await api.get(`/news/${id}`);
      setArticle(response.data);
    } catch (err) {
      setError('Failed to load article');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const title = article?.title || '';
  const source = article?.author_name || 'WatchSphere';
  const date = formatDate(article?.published_at || article?.created_at);
  const fullText = article?.content || '';
  const imageUrl = article?.cover_image || '';

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    backButton: {
      padding: 4,
      marginRight: 12,
    },
    headerTitle: {
      flex: 1,
      fontSize: 17,
      fontFamily: fonts.semiBold,
      color: colors.text,
    },
    scrollView: {
      flex: 1,
    },
    imageContainer: {
      width: '100%',
      height: 220,
      backgroundColor: colors.backgroundSecondary,
    },
    image: {
      width: '100%',
      height: '100%',
    },
    content: {
      padding: 20,
    },
    meta: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 16,
    },
    date: {
      fontSize: 14,
      fontFamily: fonts.regular,
      color: colors.textSecondary,
    },
    separator: {
      width: 4,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.textSecondary,
      marginHorizontal: 10,
    },
    source: {
      fontSize: 14,
      fontFamily: fonts.medium,
      color: colors.primary,
    },
    title: {
      fontSize: 24,
      fontFamily: fonts.semiBold,
      color: colors.text,
      lineHeight: 32,
      marginBottom: 20,
    },
    body: {
      fontSize: 16,
      fontFamily: fonts.regular,
      color: colors.text,
      lineHeight: 26,
      marginBottom: 24,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    errorContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 32,
    },
    errorText: {
      fontSize: 16,
      fontFamily: fonts.medium,
      color: colors.textSecondary,
      textAlign: 'center',
      marginBottom: 16,
    },
    retryButton: {
      paddingVertical: 12,
      paddingHorizontal: 24,
      backgroundColor: colors.text,
      borderRadius: 8,
    },
    retryButtonText: {
      fontSize: 15,
      fontFamily: fonts.semiBold,
      color: colors.background,
    },
  });

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <BackArrow size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>Article</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.text} />
        </View>
      </SafeAreaView>
    );
  }

  if (error || !article) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <BackArrow size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>Article</Text>
        </View>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error || 'Article not found'}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadArticle}>
            <Text style={styles.retryButtonText}>Try again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <BackArrow size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>Article</Text>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Article Image */}
        {imageUrl ? (
          <View style={styles.imageContainer}>
            <Image source={{ uri: imageUrl }} style={styles.image} resizeMode="cover" />
          </View>
        ) : null}

        {/* Article Content */}
        <View style={styles.content}>
          {/* Meta Info */}
          <View style={styles.meta}>
            <Text style={styles.date}>{date}</Text>
            <View style={styles.separator} />
            <Text style={styles.source}>{source}</Text>
          </View>

          {/* Title */}
          <Text style={styles.title}>{title}</Text>

          {/* Body */}
          <Text style={styles.body}>{fullText}</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
