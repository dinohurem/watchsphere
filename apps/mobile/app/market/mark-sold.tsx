import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import Svg, { Path, Circle } from 'react-native-svg';
import { api } from '@/services/api';
import { wp, hp, sp, fp } from '@/utils/responsive';

// Close/X Icon
function CloseIcon() {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Path
        d="M18 6L6 18M6 6L18 18"
        stroke="#1D1D1F"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

// Checkmark Circle Icon
function CheckCircleIcon() {
  return (
    <Svg width={80} height={80} viewBox="0 0 80 80" fill="none">
      <Circle cx="40" cy="40" r="38" stroke="#4AA078" strokeWidth="4" />
      <Path
        d="M25 40L35 50L55 30"
        stroke="#4AA078"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

// Grabber bar for sheet appearance
function GrabberBar() {
  return (
    <View style={styles.grabberContainer}>
      <View style={styles.grabber} />
    </View>
  );
}

interface MarkSoldParams {
  orderId: string;
  brand?: string;
  model?: string;
  reference?: string;
  price?: string;
}

export default function MarkSoldScreen() {
  const params = useLocalSearchParams<MarkSoldParams>();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const brand = params.brand || '';
  const model = params.model || '';
  const reference = params.reference || '';
  const price = params.price ? parseFloat(params.price) : 0;

  const formatPrice = (amount: number) => {
    return `€${amount.toLocaleString('de-DE')}`;
  };

  const handleMarkAsSold = async () => {
    if (!params.orderId) {
      Alert.alert('Error', 'Order ID is missing');
      return;
    }

    setLoading(true);
    try {
      await api.post(`/orders/${params.orderId}/mark-sold`);
      setSuccess(true);
    } catch (error: any) {
      console.error('Error marking as sold:', error);
      Alert.alert(
        'Error',
        error.response?.data?.detail || 'Failed to mark order as sold. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleDone = () => {
    // Navigate back to dashboard (inventory)
    router.dismissAll();
    router.replace('/(tabs)/dashboard');
  };

  if (success) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <GrabberBar />

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Mark as Sold</Text>
          <TouchableOpacity style={styles.closeButton} onPress={handleDone}>
            <CloseIcon />
          </TouchableOpacity>
        </View>

        {/* Success Content */}
        <View style={styles.successContent}>
          <CheckCircleIcon />
          <Text style={styles.successTitle}>Congratulations!</Text>
          <Text style={styles.successMessage}>
            Your {brand} {model} has been marked as sold and removed from your inventory.
          </Text>
        </View>

        {/* Done Button */}
        <View style={styles.bottomSection}>
          <TouchableOpacity style={styles.primaryButton} onPress={handleDone}>
            <Text style={styles.primaryButtonText}>Done</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <GrabberBar />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Mark as Sold</Text>
        <TouchableOpacity style={styles.closeButton} onPress={() => router.back()}>
          <CloseIcon />
        </TouchableOpacity>
      </View>

      {/* Watch Info */}
      <View style={styles.watchInfoSection}>
        <Text style={styles.watchName}>{brand} {model}</Text>
        <Text style={styles.watchReference}>{reference}</Text>
        <Text style={styles.watchPrice}>{formatPrice(price)}</Text>
      </View>

      {/* Confirmation Message */}
      <View style={styles.messageSection}>
        <Text style={styles.messageTitle}>Are you sure?</Text>
        <Text style={styles.messageText}>
          Marking this watch as sold will remove it from your inventory and the order book.
          This action cannot be undone.
        </Text>
      </View>

      {/* Action Buttons */}
      <View style={styles.bottomSection}>
        <TouchableOpacity
          style={[styles.primaryButton, loading && styles.buttonDisabled]}
          onPress={handleMarkAsSold}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.primaryButtonText}>Confirm Sale</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => router.back()}
          disabled={loading}
        >
          <Text style={styles.secondaryButtonText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  grabberContainer: {
    alignItems: 'center',
    paddingTop: hp(12),
    paddingBottom: hp(8),
  },
  grabber: {
    width: wp(36),
    height: hp(5),
    backgroundColor: 'rgba(60, 60, 67, 0.3)',
    borderRadius: sp(2.5),
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: wp(16),
    paddingVertical: hp(12),
    position: 'relative',
  },
  headerTitle: {
    fontFamily: 'HankenGrotesk_700Bold',
    fontSize: fp(20),
    color: '#212121',
    letterSpacing: 0.1,
  },
  closeButton: {
    position: 'absolute',
    right: wp(16),
    width: sp(40),
    height: sp(40),
    borderRadius: sp(20),
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  watchInfoSection: {
    alignItems: 'center',
    paddingVertical: hp(32),
    paddingHorizontal: wp(24),
  },
  watchName: {
    fontFamily: 'HankenGrotesk_700Bold',
    fontSize: fp(22),
    color: '#212121',
    textAlign: 'center',
    marginBottom: hp(8),
  },
  watchReference: {
    fontFamily: 'HankenGrotesk_500Medium',
    fontSize: fp(15),
    color: '#999999',
    marginBottom: hp(16),
  },
  watchPrice: {
    fontFamily: 'HankenGrotesk_700Bold',
    fontSize: fp(28),
    color: '#212121',
  },
  messageSection: {
    flex: 1,
    paddingHorizontal: wp(24),
    paddingTop: hp(16),
  },
  messageTitle: {
    fontFamily: 'HankenGrotesk_700Bold',
    fontSize: fp(18),
    color: '#212121',
    marginBottom: hp(12),
    textAlign: 'center',
  },
  messageText: {
    fontFamily: 'HankenGrotesk_400Regular',
    fontSize: fp(15),
    color: '#666666',
    textAlign: 'center',
    lineHeight: fp(22),
  },
  bottomSection: {
    paddingHorizontal: wp(24),
    paddingBottom: hp(24),
    gap: hp(12),
  },
  primaryButton: {
    backgroundColor: '#212121',
    borderRadius: sp(12),
    paddingVertical: hp(16),
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    fontFamily: 'HankenGrotesk_600SemiBold',
    fontSize: fp(16),
    color: '#FFFFFF',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderRadius: sp(12),
    paddingVertical: hp(16),
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  secondaryButtonText: {
    fontFamily: 'HankenGrotesk_600SemiBold',
    fontSize: fp(16),
    color: '#212121',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  successContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: wp(24),
  },
  successTitle: {
    fontFamily: 'HankenGrotesk_700Bold',
    fontSize: fp(24),
    color: '#212121',
    marginTop: hp(24),
    marginBottom: hp(12),
  },
  successMessage: {
    fontFamily: 'HankenGrotesk_400Regular',
    fontSize: fp(15),
    color: '#666666',
    textAlign: 'center',
    lineHeight: fp(22),
  },
});
