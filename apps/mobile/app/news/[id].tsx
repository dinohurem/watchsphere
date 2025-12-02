import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { ArrowLeft, ExternalLink } from '@/components/icons';

export default function NewsArticleScreen() {
  const { colors, fonts } = useTheme();
  const params = useLocalSearchParams();

  const title = typeof params.title === 'string' ? params.title : '';
  const source = typeof params.source === 'string' ? params.source : '';
  const url = typeof params.url === 'string' ? params.url : '';
  const date = typeof params.date === 'string' ? params.date : '';
  const fullText = typeof params.fullText === 'string' ? params.fullText : '';
  const imageUrl = typeof params.imageUrl === 'string' ? params.imageUrl : '';

  const handleOpenSource = () => {
    if (url) {
      Linking.openURL(url);
    }
  };

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
    sourceButton: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      paddingVertical: 12,
      paddingHorizontal: 16,
      backgroundColor: colors.backgroundSecondary,
      borderRadius: 10,
      gap: 8,
    },
    sourceButtonText: {
      fontSize: 15,
      fontFamily: fonts.medium,
      color: colors.text,
    },
  });

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color={colors.text} />
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

          {/* Source Link */}
          <TouchableOpacity style={styles.sourceButton} onPress={handleOpenSource}>
            <ExternalLink size={18} color={colors.text} />
            <Text style={styles.sourceButtonText}>Read original article</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
