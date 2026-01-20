import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ChevronLeft, Star, User, MessageSquare, Send } from 'lucide-react'
import { api } from '@/services/api'
import { useAuthStore } from '@watchsphere/shared/stores'

interface UserProfile {
  id: string
  name: string
  email: string
  role: string
  profile_image_url?: string
  average_rating: number
  review_count: number
  created_at: string
}

interface Review {
  id: string
  reviewer_id: string
  reviewer_name: string
  reviewer_profile_image?: string
  reviewed_user_id: string
  reviewed_user_name: string
  rating: number
  comment?: string
  created_at: string
  updated_at?: string
}

interface UserReviewStats {
  user_id: string
  user_name: string
  average_rating: number
  review_count: number
  reviews: Review[]
}

export function UserProfilePage() {
  const { userId } = useParams<{ userId: string }>()
  const navigate = useNavigate()
  const currentUser = useAuthStore((state) => state.user)

  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [reviewStats, setReviewStats] = useState<UserReviewStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [showReviewForm, setShowReviewForm] = useState(false)
  const [reviewRating, setReviewRating] = useState(5)
  const [reviewComment, setReviewComment] = useState('')
  const [submittingReview, setSubmittingReview] = useState(false)
  const [existingReview, setExistingReview] = useState<Review | null>(null)
  const [error, setError] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    if (!userId) return

    try {
      setLoading(true)
      setError(null)

      // Load user profile
      const profileResponse = await api.get(`/profile/user/${userId}`)
      setProfile(profileResponse.data)

      // Load reviews
      const reviewsResponse = await api.get(`/reviews/user/${userId}`)
      setReviewStats(reviewsResponse.data)

      // Check if current user has already reviewed
      if (currentUser) {
        const existingReviewInList = reviewsResponse.data.reviews.find(
          (r: Review) => r.reviewer_id === currentUser.id
        )
        if (existingReviewInList) {
          setExistingReview(existingReviewInList)
          setReviewRating(existingReviewInList.rating)
          setReviewComment(existingReviewInList.comment || '')
        }
      }
    } catch (err: any) {
      console.error('Failed to load user profile:', err)
      setError(err.response?.data?.detail || 'Failed to load user profile')
    } finally {
      setLoading(false)
    }
  }, [userId, currentUser])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!userId) return

    setSubmittingReview(true)
    try {
      if (existingReview) {
        // Update existing review
        await api.patch(`/reviews/${existingReview.id}`, {
          rating: reviewRating,
          comment: reviewComment || null,
        }, {
          headers: { 'X-Platform': 'web' }
        })
      } else {
        // Create new review
        await api.post('/reviews', {
          reviewed_user_id: userId,
          rating: reviewRating,
          comment: reviewComment || null,
        }, {
          headers: { 'X-Platform': 'web' }
        })
      }

      setShowReviewForm(false)
      loadData()
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to submit review')
    } finally {
      setSubmittingReview(false)
    }
  }

  const handleStartChat = async () => {
    if (!userId) return

    try {
      const response = await api.post('/chat/conversations/direct', {
        recipient_id: userId,
      })
      navigate(`/app/chat?conversation=${response.data.id}`)
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to start conversation')
    }
  }

  if (loading) {
    return (
      <div className="p-6 lg:p-8 bg-gray-50 min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    )
  }

  if (error || !profile) {
    return (
      <div className="p-6 lg:p-8 bg-gray-50 min-h-screen">
        <div className="max-w-7xl mx-auto">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6"
          >
            <ChevronLeft className="w-5 h-5" />
            Back
          </button>
          <div className="text-center py-12 text-gray-500">
            {error || 'User not found'}
          </div>
        </div>
      </div>
    )
  }

  const isOwnProfile = currentUser?.id === userId

  return (
    <div className="p-6 lg:p-8 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto pt-4">
        {/* Header with Back Button */}
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6"
        >
          <ChevronLeft className="w-5 h-5" />
          Back
        </button>

        {/* Profile Card */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-6">
          <div className="flex items-start gap-4">
            {/* Avatar */}
            <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden flex-shrink-0">
              {profile.profile_image_url ? (
                <img
                  src={profile.profile_image_url}
                  alt={profile.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <User className="w-10 h-10 text-gray-400" />
              )}
            </div>

            <div className="flex-1">
              <h1 className="text-2xl font-bold text-gray-900">{profile.name}</h1>
              <p className="text-gray-500 capitalize">{profile.role}</p>

              {/* Rating */}
              <div className="flex items-center gap-2 mt-2">
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      className={`w-5 h-5 ${
                        star <= Math.round(reviewStats?.average_rating || 0)
                          ? 'text-yellow-400 fill-yellow-400'
                          : 'text-gray-300'
                      }`}
                    />
                  ))}
                </div>
                <span className="font-semibold">
                  {reviewStats?.average_rating.toFixed(1) || '0.0'}
                </span>
                <span className="text-gray-500">
                  ({reviewStats?.review_count || 0} reviews)
                </span>
              </div>

              <p className="text-sm text-gray-400 mt-2">
                Member since {new Date(profile.created_at).toLocaleDateString()}
              </p>
            </div>

            {/* Actions */}
            {!isOwnProfile && (
              <div className="flex flex-col gap-2">
                <button
                  onClick={handleStartChat}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors"
                >
                  <MessageSquare className="w-4 h-4" />
                  Message
                </button>
                <button
                  onClick={() => setShowReviewForm(true)}
                  className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <Star className="w-4 h-4" />
                  {existingReview ? 'Edit Review' : 'Write Review'}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Review Form Modal */}
        {showReviewForm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
              <div className="p-6 border-b">
                <h2 className="text-xl font-semibold text-gray-900">
                  {existingReview ? 'Edit Your Review' : 'Write a Review'}
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  for {profile.name}
                </p>
              </div>

              <form onSubmit={handleSubmitReview} className="p-6 space-y-4">
                {/* Rating */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Rating *
                  </label>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setReviewRating(star)}
                        className="p-1"
                      >
                        <Star
                          className={`w-8 h-8 ${
                            star <= reviewRating
                              ? 'text-yellow-400 fill-yellow-400'
                              : 'text-gray-300 hover:text-yellow-300'
                          } transition-colors`}
                        />
                      </button>
                    ))}
                  </div>
                </div>

                {/* Comment */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Comment (optional)
                  </label>
                  <textarea
                    value={reviewComment}
                    onChange={(e) => setReviewComment(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg text-sm resize-none"
                    rows={4}
                    placeholder="Share your experience..."
                  />
                </div>

                {/* Buttons */}
                <div className="flex justify-end gap-3 pt-4 border-t">
                  <button
                    type="button"
                    onClick={() => setShowReviewForm(false)}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border rounded-lg hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingReview}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 disabled:opacity-50"
                  >
                    <Send className="w-4 h-4" />
                    {submittingReview ? 'Submitting...' : existingReview ? 'Update Review' : 'Submit Review'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Reviews Section */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Reviews ({reviewStats?.review_count || 0})
          </h2>

          {reviewStats?.reviews.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Star className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p>No reviews yet</p>
              {!isOwnProfile && (
                <button
                  onClick={() => setShowReviewForm(true)}
                  className="mt-4 text-gray-900 font-medium hover:underline"
                >
                  Be the first to review
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {reviewStats?.reviews.map((review) => (
                <div key={review.id} className="p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden">
                        {review.reviewer_profile_image ? (
                          <img
                            src={review.reviewer_profile_image}
                            alt={review.reviewer_name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span className="text-sm font-medium text-gray-600">
                            {review.reviewer_name.charAt(0).toUpperCase()}
                          </span>
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{review.reviewer_name}</p>
                        <div className="flex items-center gap-1">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <Star
                              key={star}
                              className={`w-4 h-4 ${
                                star <= review.rating
                                  ? 'text-yellow-400 fill-yellow-400'
                                  : 'text-gray-300'
                              }`}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                    <span className="text-sm text-gray-500">
                      {new Date(review.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  {review.comment && (
                    <p className="mt-3 text-gray-700">{review.comment}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
