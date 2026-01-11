import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, TextInput, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams, Stack } from 'expo-router';
import { useState, useEffect, useCallback } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuthStore } from '@watchsphere/shared/stores';
import { api } from '@/services/api';
import { wp, hp, sp, fp } from '@/utils/responsive';
import Svg, { Path } from 'react-native-svg';
import { Image } from 'react-native';

interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: string;
  profile_image_url?: string;
  average_rating: number;
  review_count: number;
  created_at: string;
}

interface Review {
  id: string;
  reviewer_id: string;
  reviewer_name: string;
  reviewer_profile_image?: string;
  reviewed_user_id: string;
  reviewed_user_name: string;
  rating: number;
  comment?: string;
  created_at: string;
}

interface UserReviewStats {
  user_id: string;
  user_name: string;
  average_rating: number;
  review_count: number;
  reviews: Review[];
}

// Icons
function BackArrowIcon({ color = '#1D1D1F' }: { color?: string }) {
  return (
    <Svg width={sp(24)} height={sp(24)} viewBox="0 0 24 24" fill="none">
      <Path d="M15 18L9 12L15 6" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function StarIcon({ filled, size = 20 }: { filled: boolean; size?: number }) {
  return (
    <Svg width={sp(size)} height={sp(size)} viewBox="0 0 24 24" fill={filled ? '#FBBF24' : 'none'}>
      <Path
        d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"
        stroke="#FBBF24"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function MessageIcon({ color = '#FFFFFF' }: { color?: string }) {
  return (
    <Svg width={sp(20)} height={sp(20)} viewBox="0 0 24 24" fill="none">
      <Path
        d="M21 15C21 15.5304 20.7893 16.0391 20.4142 16.4142C20.0391 16.7893 19.5304 17 19 17H7L3 21V5C3 4.46957 3.21071 3.96086 3.58579 3.58579C3.96086 3.21071 4.46957 3 5 3H19C19.5304 3 20.0391 3.21071 20.4142 3.58579C20.7893 3.96086 21 4.46957 21 5V15Z"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function UserIcon({ size = 40, color = 'rgba(33, 33, 33, 0.4)' }: { size?: number; color?: string }) {
  return (
    <Svg width={sp(size)} height={sp(size)} viewBox="0 0 24 24" fill="none">
      <Path
        d="M20 21V19C20 17.9391 19.5786 16.9217 18.8284 16.1716C18.0783 15.4214 17.0609 15 16 15H8C6.93913 15 5.92172 15.4214 5.17157 16.1716C4.42143 16.9217 4 17.9391 4 19V21"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M12 11C14.2091 11 16 9.20914 16 7C16 4.79086 14.2091 3 12 3C9.79086 3 8 4.79086 8 7C8 9.20914 9.79086 11 12 11Z"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export default function UserProfileScreen() {
  const { id: userId } = useLocalSearchParams<{ id: string }>();
  const { colors, fonts } = useTheme();
  const currentUser = useAuthStore((state) => state.user);

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [reviewStats, setReviewStats] = useState<UserReviewStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Review form state
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [existingReview, setExistingReview] = useState<Review | null>(null);

  const loadData = useCallback(async () => {
    if (!userId) return;

    try {
      setLoading(true);
      setError(null);

      // Load user profile
      const profileResponse = await api.get(`/profile/user/${userId}`);
      setProfile(profileResponse.data);

      // Load reviews
      const reviewsResponse = await api.get(`/reviews/user/${userId}`);
      setReviewStats(reviewsResponse.data);

      // Check if current user has already reviewed
      if (currentUser) {
        const existingReviewInList = reviewsResponse.data.reviews.find(
          (r: Review) => r.reviewer_id === currentUser.id
        );
        if (existingReviewInList) {
          setExistingReview(existingReviewInList);
          setReviewRating(existingReviewInList.rating);
          setReviewComment(existingReviewInList.comment || '');
        }
      }
    } catch (err: any) {
      console.error('Failed to load user profile:', err);
      setError(err.response?.data?.detail || 'Failed to load user profile');
    } finally {
      setLoading(false);
    }
  }, [userId, currentUser]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSubmitReview = async () => {
    if (!userId) return;

    setSubmittingReview(true);
    try {
      if (existingReview) {
        await api.patch(`/reviews/${existingReview.id}`, {
          rating: reviewRating,
          comment: reviewComment || null,
        }, {
          headers: { 'X-Platform': 'mobile' }
        });
      } else {
        await api.post('/reviews', {
          reviewed_user_id: userId,
          rating: reviewRating,
          comment: reviewComment || null,
        }, {
          headers: { 'X-Platform': 'mobile' }
        });
      }

      setShowReviewModal(false);
      loadData();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to submit review');
    } finally {
      setSubmittingReview(false);
    }
  };

  const handleStartChat = async () => {
    if (!userId) return;

    try {
      const response = await api.post('/chat/direct', {
        participant_id: userId,
      });
      router.push(`/chat/${response.data.id}` as any);
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to start conversation');
    }
  };

  const isOwnProfile = currentUser?.id === userId;

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: wp(16),
      height: hp(56),
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerButton: {
      width: sp(44),
      height: sp(44),
      justifyContent: 'center',
      alignItems: 'center',
    },
    headerTitle: {
      fontFamily: fonts.semiBold,
      fontSize: fp(18),
      color: colors.text,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    scrollContent: {
      padding: wp(16),
      paddingBottom: hp(40),
    },
    profileCard: {
      backgroundColor: colors.card,
      borderRadius: sp(16),
      padding: wp(16),
      marginBottom: hp(16),
      borderWidth: 1,
      borderColor: colors.border,
    },
    profileHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
    },
    avatar: {
      width: sp(80),
      height: sp(80),
      borderRadius: sp(40),
      backgroundColor: colors.inputBackground,
      justifyContent: 'center',
      alignItems: 'center',
      overflow: 'hidden',
    },
    avatarImage: {
      width: '100%',
      height: '100%',
    },
    profileInfo: {
      flex: 1,
      marginLeft: wp(16),
    },
    profileName: {
      fontFamily: fonts.bold,
      fontSize: fp(22),
      color: colors.text,
    },
    profileRole: {
      fontFamily: fonts.medium,
      fontSize: fp(14),
      color: colors.textSecondary,
      textTransform: 'capitalize',
      marginTop: hp(2),
    },
    ratingContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: hp(8),
    },
    ratingStars: {
      flexDirection: 'row',
      marginRight: wp(8),
    },
    ratingText: {
      fontFamily: fonts.semiBold,
      fontSize: fp(14),
      color: colors.text,
    },
    reviewCount: {
      fontFamily: fonts.regular,
      fontSize: fp(14),
      color: colors.textSecondary,
      marginLeft: wp(4),
    },
    memberSince: {
      fontFamily: fonts.regular,
      fontSize: fp(12),
      color: colors.textTertiary,
      marginTop: hp(8),
    },
    actionsContainer: {
      flexDirection: 'row',
      marginTop: hp(16),
      gap: wp(12),
    },
    actionButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: hp(12),
      borderRadius: sp(12),
      gap: wp(8),
    },
    messageButton: {
      backgroundColor: colors.text,
    },
    reviewButton: {
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: colors.border,
    },
    messageButtonText: {
      fontFamily: fonts.semiBold,
      fontSize: fp(14),
      color: colors.background,
    },
    reviewButtonText: {
      fontFamily: fonts.semiBold,
      fontSize: fp(14),
      color: colors.text,
    },
    sectionTitle: {
      fontFamily: fonts.semiBold,
      fontSize: fp(18),
      color: colors.text,
      marginBottom: hp(16),
    },
    reviewCard: {
      backgroundColor: colors.inputBackground,
      borderRadius: sp(12),
      padding: wp(16),
      marginBottom: hp(12),
    },
    reviewHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
    },
    reviewerInfo: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    reviewerAvatar: {
      width: sp(40),
      height: sp(40),
      borderRadius: sp(20),
      backgroundColor: colors.border,
      justifyContent: 'center',
      alignItems: 'center',
      overflow: 'hidden',
    },
    reviewerInitial: {
      fontFamily: fonts.semiBold,
      fontSize: fp(14),
      color: colors.textSecondary,
    },
    reviewerDetails: {
      marginLeft: wp(12),
    },
    reviewerName: {
      fontFamily: fonts.semiBold,
      fontSize: fp(14),
      color: colors.text,
    },
    reviewStars: {
      flexDirection: 'row',
      marginTop: hp(4),
    },
    reviewDate: {
      fontFamily: fonts.regular,
      fontSize: fp(12),
      color: colors.textTertiary,
    },
    reviewComment: {
      fontFamily: fonts.regular,
      fontSize: fp(14),
      color: colors.text,
      marginTop: hp(12),
      lineHeight: fp(20),
    },
    emptyContainer: {
      alignItems: 'center',
      paddingVertical: hp(40),
    },
    emptyText: {
      fontFamily: fonts.regular,
      fontSize: fp(14),
      color: colors.textSecondary,
      marginTop: hp(12),
    },
    emptyButton: {
      marginTop: hp(16),
    },
    emptyButtonText: {
      fontFamily: fonts.semiBold,
      fontSize: fp(14),
      color: colors.text,
    },
    errorText: {
      fontFamily: fonts.regular,
      fontSize: fp(14),
      color: colors.textSecondary,
      textAlign: 'center',
    },
    // Modal styles
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: wp(16),
    },
    modalContent: {
      backgroundColor: colors.background,
      borderRadius: sp(16),
      width: '100%',
      maxWidth: wp(400),
    },
    modalHeader: {
      padding: wp(16),
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    modalTitle: {
      fontFamily: fonts.semiBold,
      fontSize: fp(18),
      color: colors.text,
    },
    modalSubtitle: {
      fontFamily: fonts.regular,
      fontSize: fp(14),
      color: colors.textSecondary,
      marginTop: hp(4),
    },
    modalBody: {
      padding: wp(16),
    },
    inputLabel: {
      fontFamily: fonts.medium,
      fontSize: fp(14),
      color: colors.text,
      marginBottom: hp(8),
    },
    starSelectContainer: {
      flexDirection: 'row',
      gap: wp(8),
      marginBottom: hp(20),
    },
    starButton: {
      padding: wp(4),
    },
    commentInput: {
      backgroundColor: colors.inputBackground,
      borderRadius: sp(12),
      padding: wp(12),
      fontFamily: fonts.regular,
      fontSize: fp(14),
      color: colors.text,
      minHeight: hp(100),
      textAlignVertical: 'top',
    },
    modalFooter: {
      flexDirection: 'row',
      padding: wp(16),
      borderTopWidth: 1,
      borderTopColor: colors.border,
      gap: wp(12),
    },
    cancelButton: {
      flex: 1,
      paddingVertical: hp(12),
      alignItems: 'center',
      borderRadius: sp(12),
      borderWidth: 1,
      borderColor: colors.border,
    },
    cancelButtonText: {
      fontFamily: fonts.semiBold,
      fontSize: fp(14),
      color: colors.text,
    },
    submitButton: {
      flex: 1,
      paddingVertical: hp(12),
      alignItems: 'center',
      borderRadius: sp(12),
      backgroundColor: colors.text,
    },
    submitButtonText: {
      fontFamily: fonts.semiBold,
      fontSize: fp(14),
      color: colors.background,
    },
    disabledButton: {
      opacity: 0.5,
    },
  });

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.header}>
          <TouchableOpacity style={styles.headerButton} onPress={() => router.back()}>
            <BackArrowIcon color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Profile</Text>
          <View style={styles.headerButton} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.text} />
        </View>
      </SafeAreaView>
    );
  }

  if (error || !profile) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.header}>
          <TouchableOpacity style={styles.headerButton} onPress={() => router.back()}>
            <BackArrowIcon color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Profile</Text>
          <View style={styles.headerButton} />
        </View>
        <View style={styles.loadingContainer}>
          <Text style={styles.errorText}>{error || 'User not found'}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerButton} onPress={() => router.back()}>
          <BackArrowIcon color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Profile</Text>
        <View style={styles.headerButton} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.profileHeader}>
            <View style={styles.avatar}>
              {profile.profile_image_url ? (
                <Image source={{ uri: profile.profile_image_url }} style={styles.avatarImage} />
              ) : (
                <UserIcon size={40} color={colors.textSecondary} />
              )}
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>{profile.name}</Text>
              <Text style={styles.profileRole}>{profile.role}</Text>
              <View style={styles.ratingContainer}>
                <View style={styles.ratingStars}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <StarIcon
                      key={star}
                      filled={star <= Math.round(reviewStats?.average_rating || 0)}
                      size={16}
                    />
                  ))}
                </View>
                <Text style={styles.ratingText}>
                  {reviewStats?.average_rating.toFixed(1) || '0.0'}
                </Text>
                <Text style={styles.reviewCount}>
                  ({reviewStats?.review_count || 0})
                </Text>
              </View>
              <Text style={styles.memberSince}>
                Member since {new Date(profile.created_at).toLocaleDateString()}
              </Text>
            </View>
          </View>

          {!isOwnProfile && (
            <View style={styles.actionsContainer}>
              <TouchableOpacity
                style={[styles.actionButton, styles.messageButton]}
                onPress={handleStartChat}
              >
                <MessageIcon />
                <Text style={styles.messageButtonText}>Message</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, styles.reviewButton]}
                onPress={() => setShowReviewModal(true)}
              >
                <StarIcon filled={false} size={18} />
                <Text style={styles.reviewButtonText}>
                  {existingReview ? 'Edit Review' : 'Write Review'}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Reviews Section */}
        <Text style={styles.sectionTitle}>
          Reviews ({reviewStats?.review_count || 0})
        </Text>

        {reviewStats?.reviews.length === 0 ? (
          <View style={styles.emptyContainer}>
            <StarIcon filled={false} size={48} />
            <Text style={styles.emptyText}>No reviews yet</Text>
            {!isOwnProfile && (
              <TouchableOpacity
                style={styles.emptyButton}
                onPress={() => setShowReviewModal(true)}
              >
                <Text style={styles.emptyButtonText}>Be the first to review</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          reviewStats?.reviews.map((review) => (
            <View key={review.id} style={styles.reviewCard}>
              <View style={styles.reviewHeader}>
                <View style={styles.reviewerInfo}>
                  <View style={styles.reviewerAvatar}>
                    {review.reviewer_profile_image ? (
                      <Image
                        source={{ uri: review.reviewer_profile_image }}
                        style={styles.avatarImage}
                      />
                    ) : (
                      <Text style={styles.reviewerInitial}>
                        {review.reviewer_name.charAt(0).toUpperCase()}
                      </Text>
                    )}
                  </View>
                  <View style={styles.reviewerDetails}>
                    <Text style={styles.reviewerName}>{review.reviewer_name}</Text>
                    <View style={styles.reviewStars}>
                      {[1, 2, 3, 4, 5].map((star) => (
                        <StarIcon
                          key={star}
                          filled={star <= review.rating}
                          size={14}
                        />
                      ))}
                    </View>
                  </View>
                </View>
                <Text style={styles.reviewDate}>
                  {new Date(review.created_at).toLocaleDateString()}
                </Text>
              </View>
              {review.comment && (
                <Text style={styles.reviewComment}>{review.comment}</Text>
              )}
            </View>
          ))
        )}
      </ScrollView>

      {/* Review Modal */}
      <Modal
        visible={showReviewModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowReviewModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {existingReview ? 'Edit Your Review' : 'Write a Review'}
              </Text>
              <Text style={styles.modalSubtitle}>for {profile.name}</Text>
            </View>

            <View style={styles.modalBody}>
              <Text style={styles.inputLabel}>Rating</Text>
              <View style={styles.starSelectContainer}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <TouchableOpacity
                    key={star}
                    style={styles.starButton}
                    onPress={() => setReviewRating(star)}
                  >
                    <StarIcon filled={star <= reviewRating} size={32} />
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.inputLabel}>Comment (optional)</Text>
              <TextInput
                style={styles.commentInput}
                value={reviewComment}
                onChangeText={setReviewComment}
                placeholder="Share your experience..."
                placeholderTextColor={colors.textTertiary}
                multiline
                numberOfLines={4}
              />
            </View>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowReviewModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.submitButton, submittingReview && styles.disabledButton]}
                onPress={handleSubmitReview}
                disabled={submittingReview}
              >
                <Text style={styles.submitButtonText}>
                  {submittingReview ? 'Submitting...' : existingReview ? 'Update' : 'Submit'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
