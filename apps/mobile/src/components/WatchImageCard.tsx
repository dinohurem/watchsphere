import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { Heart } from './icons';
import { useTheme } from '@/contexts/ThemeContext';

interface WatchImageCardProps {
  imageUrl?: string;
  title: string;
  subtitle: string;
  price: string;
  isFavorite?: boolean;
  onPress: () => void;
  onFavoritePress?: () => void;
}

export function WatchImageCard({
  imageUrl,
  title,
  subtitle,
  price,
  isFavorite = false,
  onPress,
  onFavoritePress,
}: WatchImageCardProps) {
  const { colors, fonts } = useTheme();

  return (
    <TouchableOpacity style={styles.container} onPress={onPress}>
      <View style={styles.imageContainer}>
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} style={styles.image} />
        ) : (
          <View style={styles.imagePlaceholder} />
        )}
        {onFavoritePress && (
          <TouchableOpacity style={styles.favoriteButton} onPress={onFavoritePress}>
            <Heart size={20} color={isFavorite ? '#FF3B30' : '#000000'} fill={isFavorite ? '#FF3B30' : 'none'} />
          </TouchableOpacity>
        )}
      </View>
      <Text style={[styles.title, { fontFamily: fonts.regular }]} numberOfLines={1}>{title}</Text>
      <Text style={[styles.subtitle, { fontFamily: fonts.regular }]} numberOfLines={1}>{subtitle}</Text>
      <Text style={[styles.price, { fontFamily: fonts.semiBold }]}>{price}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '48%',
    marginBottom: 16,
  },
  imageContainer: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
    marginBottom: 8,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imagePlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#E5E5EA',
  },
  favoriteButton: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 15,
    color: '#000000',
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 13,
    color: '#8E8E93',
    marginBottom: 4,
  },
  price: {
    fontSize: 16,
    color: '#000000',
  },
});
