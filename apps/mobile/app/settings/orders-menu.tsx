import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { wp, hp, sp, fp } from '@/utils/responsive';
import { LockedSection } from '@/components/SubscriptionOverlay';
import { useSubscription } from '@/contexts/SubscriptionContext';

// Back Arrow Icon (Chevron Left)
function ChevronLeftIcon() {
  return (
    <Svg width={sp(24)} height={sp(24)} viewBox="0 0 24 24" fill="none">
      <Path
        d="M15 18L9 12L15 6"
        stroke="#1D1D1F"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

// Chevron Right Icon
function ChevronRightIcon() {
  return (
    <Svg width={sp(8)} height={sp(14)} viewBox="0 0 8 14" fill="none">
      <Path
        d="M1 1L7 7L1 13"
        stroke="rgba(60,60,67,0.3)"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

interface MenuItemProps {
  title: string;
  onPress: () => void;
}

function MenuItem({ title, onPress }: MenuItemProps) {
  return (
    <TouchableOpacity
      style={styles.menuItem}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={styles.menuItemText}>{title}</Text>
      <ChevronRightIcon />
    </TouchableOpacity>
  );
}

export default function OrdersMenuScreen() {
  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <ChevronLeftIcon />
        </TouchableOpacity>
      </View>

      {/* Content */}
      <View style={styles.content}>
        {/* Title */}
        <View style={styles.titleSection}>
          <Text style={styles.title}>Orders</Text>
        </View>

        {/* Menu Items */}
        <LockedSection message="Premium feature">
          <View style={styles.menuList}>
            <MenuItem
              title="Buy Orders"
              onPress={() => router.push({ pathname: '/settings/orders', params: { type: 'buy' } } as any)}
            />
            <MenuItem
              title="Sell Orders"
              onPress={() => router.push({ pathname: '/settings/orders', params: { type: 'sell' } } as any)}
            />
          </View>
        </LockedSection>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    height: hp(44),
    paddingHorizontal: wp(8),
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(33, 33, 33, 0.05)',
  },
  headerButton: {
    width: sp(44),
    height: sp(44),
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: wp(16),
    paddingVertical: hp(20),
  },
  titleSection: {
    marginBottom: hp(20),
  },
  title: {
    fontFamily: 'HankenGrotesk_600SemiBold',
    fontSize: fp(24),
    fontWeight: '600',
    color: '#1D1D1F',
    lineHeight: fp(31),
  },
  menuList: {
    gap: hp(8),
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FAFAFA',
    borderRadius: sp(16),
    paddingHorizontal: wp(16),
    paddingVertical: hp(16),
  },
  menuItemText: {
    fontFamily: 'HankenGrotesk_600SemiBold',
    fontSize: fp(15),
    fontWeight: '600',
    color: '#1D1D1F',
    lineHeight: fp(20),
  },
});
