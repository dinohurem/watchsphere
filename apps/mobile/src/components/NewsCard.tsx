import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';

interface NewsCardProps {
  icon: string;
  text: string;
  source: string;
  onPress?: () => void;
}

export function NewsCard({ icon, text, source, onPress }: NewsCardProps) {
  const { colors, fonts } = useTheme();

  const styles = StyleSheet.create({
    container: {
      flexDirection: 'row',
      backgroundColor: 'transparent',
      paddingVertical: 8,
      paddingLeft: 0,
      alignItems: 'center',
    },
    icon: {
      fontSize: 20,
      marginRight: 12,
    },
    textContainer: {
      flex: 1,
    },
    text: {
      fontSize: 13,
      color: colors.text,
      fontFamily: fonts.semiBold,
      marginBottom: 2,
    },
    source: {
      fontSize: 11,
      fontFamily: fonts.regular,
      color: colors.textSecondary,
    },
  });

  return (
    <TouchableOpacity style={styles.container} onPress={onPress} activeOpacity={0.7}>
      <Text style={styles.icon}>{icon}</Text>
      <View style={styles.textContainer}>
        <Text style={styles.text}>{text}</Text>
        <Text style={styles.source}>— source: {source}</Text>
      </View>
    </TouchableOpacity>
  );
}
