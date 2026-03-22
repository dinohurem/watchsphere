import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { LoadingAnimation } from '@/components/LoadingAnimation';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useState, useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import Svg, { Path, Circle } from 'react-native-svg';
import { wp, hp, sp, fp } from '@/utils/responsive';
import { api } from '@/services/api';
import { useTranslation } from 'react-i18next';

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

// Plus Icon
function PlusIcon() {
  return (
    <Svg width={sp(24)} height={sp(24)} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 5v14M5 12h14"
        stroke="#1D1D1F"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

// Alert Circle Icon
function AlertCircleIcon() {
  return (
    <Svg width={sp(40)} height={sp(40)} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={10} stroke="rgba(33, 33, 33, 0.3)" strokeWidth={1.5} />
      <Path
        d="M12 8v4M12 16h.01"
        stroke="rgba(33, 33, 33, 0.3)"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

interface Dispute {
  id: string;
  watch_reference: string;
  watch_brand?: string;
  watch_model?: string;
  description: string;
  status: 'open' | 'in_progress' | 'closed';
  created_at: string;
}

function getStatusColor(status: string): { bg: string; text: string } {
  switch (status) {
    case 'open':
      return { bg: 'rgba(255, 149, 0, 0.1)', text: '#FF9500' };
    case 'in_progress':
      return { bg: 'rgba(0, 122, 255, 0.1)', text: '#007AFF' };
    case 'closed':
      return { bg: 'rgba(74, 160, 120, 0.1)', text: '#4AA078' };
    default:
      return { bg: 'rgba(0, 0, 0, 0.05)', text: '#666666' };
  }
}

function useFormatStatus() {
  const { t } = useTranslation();
  return (status: string): string => {
    switch (status) {
      case 'open':
        return t('support.open');
      case 'in_progress':
        return t('support.inProgress');
      case 'closed':
        return t('support.closed');
      default:
        return status;
    }
  };
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

interface DisputeItemProps {
  dispute: Dispute;
}

function DisputeItem({ dispute }: DisputeItemProps) {
  const { t } = useTranslation();
  const formatStatus = useFormatStatus();
  const statusColors = getStatusColor(dispute.status);
  const watchName = dispute.watch_brand && dispute.watch_model
    ? `${dispute.watch_brand} ${dispute.watch_model}`
    : dispute.watch_reference;

  return (
    <View style={styles.disputeItem}>
      <View style={styles.disputeItemHeader}>
        <View style={styles.disputeItemInfo}>
          <Text style={styles.disputeItemTitle} numberOfLines={1}>{watchName}</Text>
          <Text style={styles.disputeItemRef} numberOfLines={1}>{t('support.ref')}: {dispute.watch_reference}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: statusColors.bg }]}>
          <Text style={[styles.statusText, { color: statusColors.text }]}>
            {formatStatus(dispute.status)}
          </Text>
        </View>
      </View>
      <Text style={styles.disputeItemDescription} numberOfLines={2}>
        {dispute.description}
      </Text>
      <Text style={styles.disputeItemDate}>{formatDate(dispute.created_at)}</Text>
    </View>
  );
}

export default function DisputesScreen() {
  const { t } = useTranslation();
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadDisputes = async () => {
    try {
      const response = await api.get('/support/disputes');
      setDisputes(response.data);
    } catch (error) {
      console.error('Error loading disputes:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadDisputes();
    }, [])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadDisputes();
  };

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
        <Text style={styles.headerTitle}>{t('support.disputes')}</Text>
        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => router.push('/support/new-dispute' as any)}
          activeOpacity={0.7}
        >
          <PlusIcon />
        </TouchableOpacity>
      </View>

      {/* Content */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <LoadingAnimation />
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          {disputes.length > 0 ? (
            <View style={styles.disputeList}>
              {disputes.map((dispute) => (
                <DisputeItem key={dispute.id} dispute={dispute} />
              ))}
            </View>
          ) : (
            <View style={styles.emptyState}>
              <AlertCircleIcon />
              <Text style={styles.emptyStateTitle}>{t('support.noDisputes')}</Text>
              <Text style={styles.emptyStateText}>
                {t('support.noDisputesDesc')}
              </Text>
            </View>
          )}
        </ScrollView>
      )}
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
    justifyContent: 'space-between',
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
  headerTitle: {
    fontFamily: 'HankenGrotesk_600SemiBold',
    fontSize: fp(17),
    fontWeight: '600',
    color: '#1D1D1F',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: wp(16),
    paddingVertical: hp(20),
    paddingBottom: hp(40),
  },
  disputeList: {
    gap: hp(12),
  },
  disputeItem: {
    backgroundColor: '#FAFAFA',
    borderRadius: sp(16),
    padding: wp(16),
  },
  disputeItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: hp(8),
  },
  disputeItemInfo: {
    flex: 1,
    marginRight: wp(12),
  },
  disputeItemTitle: {
    fontFamily: 'HankenGrotesk_600SemiBold',
    fontSize: fp(15),
    fontWeight: '600',
    color: '#1D1D1F',
    lineHeight: fp(20),
  },
  disputeItemRef: {
    fontFamily: 'HankenGrotesk_400Regular',
    fontSize: fp(13),
    color: '#666666',
    lineHeight: fp(18),
    marginTop: hp(2),
  },
  statusBadge: {
    paddingHorizontal: wp(10),
    paddingVertical: hp(4),
    borderRadius: sp(8),
  },
  statusText: {
    fontFamily: 'HankenGrotesk_600SemiBold',
    fontSize: fp(12),
    fontWeight: '600',
  },
  disputeItemDescription: {
    fontFamily: 'HankenGrotesk_400Regular',
    fontSize: fp(14),
    color: '#666666',
    lineHeight: fp(20),
    marginBottom: hp(8),
  },
  disputeItemDate: {
    fontFamily: 'HankenGrotesk_400Regular',
    fontSize: fp(12),
    color: '#999999',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: wp(32),
    paddingTop: hp(80),
  },
  emptyStateTitle: {
    fontFamily: 'HankenGrotesk_600SemiBold',
    fontSize: fp(18),
    fontWeight: '600',
    color: '#1D1D1F',
    marginTop: hp(16),
    marginBottom: hp(8),
  },
  emptyStateText: {
    fontFamily: 'HankenGrotesk_400Regular',
    fontSize: fp(14),
    color: '#666666',
    lineHeight: fp(20),
    textAlign: 'center',
  },
});
