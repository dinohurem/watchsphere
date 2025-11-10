import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';

interface NewsCardProps {
  icon: string;
  text: string;
  source: string;
}

export function NewsCard({ icon, text, source }: NewsCardProps) {
  const { colors } = useTheme();

  const styles = StyleSheet.create({
    container: {
      flexDirection: 'row',
      backgroundColor: 'transparent',
      padding: 16,
      paddingLeft: 0,
      marginBottom: 12,
      alignItems: 'center',
    },
    icon: {
      fontSize: 24,
      marginRight: 12,
    },
    textContainer: {
      flex: 1,
    },
    text: {
      fontSize: 15,
      color: colors.text,
      fontWeight: '500',
      marginBottom: 2,
    },
    source: {
      fontSize: 13,
      color: colors.textSecondary,
    },
  });

  return (
    <TouchableOpacity style={styles.container}>
      <Text style={styles.icon}>{icon}</Text>
      <View style={styles.textContainer}>
        <Text style={styles.text}>{text}</Text>
        <Text style={styles.source}>— source: {source}</Text>
      </View>
    </TouchableOpacity>
  );
}
