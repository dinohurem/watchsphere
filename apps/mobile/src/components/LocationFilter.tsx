import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';

export type Location = 'US' | 'EU' | 'UAE' | 'HK';

interface LocationFilterProps {
  selectedLocations: Location[];
  onToggleLocation: (location: Location) => void;
}

const locationData: Record<Location, { label: string; initials: string; emoji: string }> = {
  US: { label: 'United States', initials: 'US', emoji: '🇺🇸' },
  EU: { label: 'Europe', initials: 'EU', emoji: '🇪🇺' },
  UAE: { label: 'UAE', initials: 'UAE', emoji: '🇦🇪' },
  HK: { label: 'Hong Kong', initials: 'HK', emoji: '🇭🇰' },
};

export function LocationFilter({ selectedLocations, onToggleLocation }: LocationFilterProps) {
  const { colors, fonts } = useTheme();
  const locations: Location[] = ['US', 'EU', 'UAE', 'HK'];

  const styles = StyleSheet.create({
    container: {
      flexDirection: 'row',
      gap: 12,
      paddingVertical: 8,
    },
    locationButton: {
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
    },
    locationButtonActive: {
      // Active state handled by inner elements
    },
    iconContainer: {
      width: 56,
      height: 56,
      borderRadius: 12,
      backgroundColor: '#F5F5F5',
      borderWidth: 2,
      borderColor: '#E5E5EA',
      alignItems: 'center',
      justifyContent: 'center',
    },
    iconContainerActive: {
      backgroundColor: '#E3F2FF',
      borderColor: '#007AFF',
    },
    emoji: {
      fontSize: 28,
    },
    initials: {
      fontSize: 12,
      fontFamily: fonts.semiBold,
      color: '#8E8E93',
    },
    initialsActive: {
      color: '#007AFF',
    },
  });

  return (
    <View style={styles.container}>
      {locations.map((location) => {
        const isSelected = selectedLocations.includes(location);
        const { initials, emoji } = locationData[location];

        return (
          <TouchableOpacity
            key={location}
            style={[styles.locationButton, isSelected && styles.locationButtonActive]}
            onPress={() => onToggleLocation(location)}
          >
            <View style={[styles.iconContainer, isSelected && styles.iconContainerActive]}>
              <Text style={styles.emoji}>{emoji}</Text>
            </View>
            <Text style={[styles.initials, isSelected && styles.initialsActive]}>
              {initials}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
