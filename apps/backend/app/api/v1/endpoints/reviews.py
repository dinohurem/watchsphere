from typing import Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Header
from pydantic import BaseModel
from datetime import datetime
from beanie import PydanticObjectId

from app.core.deps import get_current_active_user, get_current_admin_user
from app.models.user import User
from app.models.review import Review
from app.api.v1.endpoints.activity import log_activity
from app.models.activity_log import ActivityType, EntityType

router = APIRouter()


# ============== Request/Response Models ==============

class ReviewCreateRequest(BaseModel):
    reviewed_user_id: str
    rating: int  # 1-5 stars
    comment: Optional[str] = None


class ReviewUpdateRequest(BaseModel):
    rating: Optional[int] = None
    comment: Optional[str] = None


class ReviewResponse(BaseModel):
    id: str
    reviewer_id: str
    reviewer_name: str
    reviewer_profile_image: Optional[str] = None
    reviewed_user_id: str
    reviewed_user_name: str
    rating: int
    comment: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None


class UserReviewStats(BaseModel):
    user_id: str
    user_name: str
    average_rating: float
    review_count: int
    reviews: List[ReviewResponse]


# ============== Helper Functions ==============

async def update_user_rating_stats(user_id: str) -> None:
    """Update user's average rating and review count"""
    reviews = await Review.find(Review.reviewed_user_id == user_id).to_list()

    if reviews:
        total_rating = sum(r.rating for r in reviews)
        avg_rating = total_rating / len(reviews)
        review_count = len(reviews)
    else:
        avg_rating = 0.0
        review_count = 0

    user = await User.get(PydanticObjectId(user_id))
    if user:
        user.average_rating = round(avg_rating, 2)
        user.review_count = review_count
        user.updated_at = datetime.utcnow()
        await user.save()


# ============== User Endpoints ==============

@router.post("", response_model=ReviewResponse)
async def create_review(
    data: ReviewCreateRequest,
    current_user: User = Depends(get_current_active_user),
    x_platform: Optional[str] = Header(None, alias="X-Platform"),
) -> Any:
    """Create a review for another user"""
    # Validate rating
    if data.rating < 1 or data.rating > 5:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Rating must be between 1 and 5"
        )

    # Can't review yourself
    if data.reviewed_user_id == str(current_user.id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot review yourself"
        )

    # Get reviewed user
    reviewed_user = await User.get(PydanticObjectId(data.reviewed_user_id))
    if not reviewed_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    # Check if user already reviewed this user
    existing_review = await Review.find_one(
        Review.reviewer_id == str(current_user.id),
        Review.reviewed_user_id == data.reviewed_user_id
    )
    if existing_review:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You have already reviewed this user. You can update your existing review instead."
        )

    # Create review
    review = Review(
        reviewer_id=str(current_user.id),
        reviewer_name=current_user.name,
        reviewer_email=current_user.email,
        reviewer_profile_image=current_user.profile_image_thumbnail_url or current_user.profile_image_url,
        reviewed_user_id=data.reviewed_user_id,
        reviewed_user_name=reviewed_user.name,
        reviewed_user_email=reviewed_user.email,
        rating=data.rating,
        comment=data.comment,
    )
    await review.insert()

    # Update reviewed user's rating stats
    await update_user_rating_stats(data.reviewed_user_id)

    # Log activity
    platform = x_platform or "web"
    await log_activity(
        activity_type=ActivityType.REVIEW_CREATED,
        description=f"{current_user.name} reviewed {reviewed_user.name} ({data.rating} stars)",
        user=current_user,
        entity_type=EntityType.REVIEW,
        entity_id=str(review.id),
        metadata={
            "rating": data.rating,
            "reviewed_user_id": data.reviewed_user_id,
            "reviewed_user_name": reviewed_user.name,
            "platform": platform,
        }
    )

    return {
        "id": str(review.id),
        "reviewer_id": review.reviewer_id,
        "reviewer_name": review.reviewer_name,
        "reviewer_profile_image": review.reviewer_profile_image,
        "reviewed_user_id": review.reviewed_user_id,
        "reviewed_user_name": review.reviewed_user_name,
        "rating": review.rating,
        "comment": review.comment,
        "created_at": review.created_at,
        "updated_at": review.updated_at,
    }


@router.get("/my-reviews", response_model=List[ReviewResponse])
async def get_my_reviews(
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """Get reviews that the current user has written"""
    reviews = await Review.find(
        Review.reviewer_id == str(current_user.id)
    ).sort([("created_at", -1)]).to_list()

    return [
        {
            "id": str(r.id),
            "reviewer_id": r.reviewer_id,
            "reviewer_name": r.reviewer_name,
            "reviewer_profile_image": r.reviewer_profile_image,
            "reviewed_user_id": r.reviewed_user_id,
            "reviewed_user_name": r.reviewed_user_name,
            "rating": r.rating,
            "comment": r.comment,
            "created_at": r.created_at,
            "updated_at": r.updated_at,
        }
        for r in reviews
    ]


@router.get("/received", response_model=List[ReviewResponse])
async def get_received_reviews(
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """Get reviews that the current user has received"""
    reviews = await Review.find(
        Review.reviewed_user_id == str(current_user.id)
    ).sort([("created_at", -1)]).to_list()

    return [
        {
            "id": str(r.id),
            "reviewer_id": r.reviewer_id,
            "reviewer_name": r.reviewer_name,
            "reviewer_profile_image": r.reviewer_profile_image,
            "reviewed_user_id": r.reviewed_user_id,
            "reviewed_user_name": r.reviewed_user_name,
            "rating": r.rating,
            "comment": r.comment,
            "created_at": r.created_at,
            "updated_at": r.updated_at,
        }
        for r in reviews
    ]


@router.get("/user/{user_id}", response_model=UserReviewStats)
async def get_user_reviews(
    user_id: str,
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """Get reviews for a specific user"""
    user = await User.get(PydanticObjectId(user_id))
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    reviews = await Review.find(
        Review.reviewed_user_id == user_id
    ).sort([("created_at", -1)]).to_list()

    if reviews:
        total_rating = sum(r.rating for r in reviews)
        avg_rating = total_rating / len(reviews)
    else:
        avg_rating = 0.0

    return {
        "user_id": user_id,
        "user_name": user.name,
        "average_rating": round(avg_rating, 2),
        "review_count": len(reviews),
        "reviews": [
            {
                "id": str(r.id),
                "reviewer_id": r.reviewer_id,
                "reviewer_name": r.reviewer_name,
                "reviewer_profile_image": r.reviewer_profile_image,
                "reviewed_user_id": r.reviewed_user_id,
                "reviewed_user_name": r.reviewed_user_name,
                "rating": r.rating,
                "comment": r.comment,
                "created_at": r.created_at,
                "updated_at": r.updated_at,
            }
            for r in reviews
        ]
    }


@router.patch("/{review_id}", response_model=ReviewResponse)
async def update_review(
    review_id: str,
    data: ReviewUpdateRequest,
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """Update own review"""
    review = await Review.get(PydanticObjectId(review_id))
    if not review:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Review not found"
        )

    if review.reviewer_id != str(current_user.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to update this review"
        )

    # Validate rating if provided
    if data.rating is not None and (data.rating < 1 or data.rating > 5):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Rating must be between 1 and 5"
        )

    # Update fields
    update_data = data.model_dump(exclude_unset=True)
    if update_data:
        update_data["updated_at"] = datetime.utcnow()
        await review.set(update_data)

    # Update reviewed user's rating stats if rating changed
    if data.rating is not None:
        await update_user_rating_stats(review.reviewed_user_id)

    return {
        "id": str(review.id),
        "reviewer_id": review.reviewer_id,
        "reviewer_name": review.reviewer_name,
        "reviewer_profile_image": review.reviewer_profile_image,
        "reviewed_user_id": review.reviewed_user_id,
        "reviewed_user_name": review.reviewed_user_name,
        "rating": review.rating,
        "comment": review.comment,
        "created_at": review.created_at,
        "updated_at": review.updated_at,
    }


@router.delete("/{review_id}")
async def delete_review(
    review_id: str,
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """Delete own review"""
    review = await Review.get(PydanticObjectId(review_id))
    if not review:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Review not found"
        )

    if review.reviewer_id != str(current_user.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to delete this review"
        )

    reviewed_user_id = review.reviewed_user_id
    await review.delete()

    # Update reviewed user's rating stats
    await update_user_rating_stats(reviewed_user_id)

    return {"message": "Review deleted successfully"}


# ============== Public Endpoints ==============

@router.get("/public/user/{user_id}", response_model=UserReviewStats)
async def get_public_user_reviews(
    user_id: str,
) -> Any:
    """Get public reviews for a user (no auth required)"""
    user = await User.get(PydanticObjectId(user_id))
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    reviews = await Review.find(
        Review.reviewed_user_id == user_id
    ).sort([("created_at", -1)]).to_list()

    if reviews:
        total_rating = sum(r.rating for r in reviews)
        avg_rating = total_rating / len(reviews)
    else:
        avg_rating = 0.0

    return {
        "user_id": user_id,
        "user_name": user.name,
        "average_rating": round(avg_rating, 2),
        "review_count": len(reviews),
        "reviews": [
            {
                "id": str(r.id),
                "reviewer_id": r.reviewer_id,
                "reviewer_name": r.reviewer_name,
                "reviewer_profile_image": r.reviewer_profile_image,
                "reviewed_user_id": r.reviewed_user_id,
                "reviewed_user_name": r.reviewed_user_name,
                "rating": r.rating,
                "comment": r.comment,
                "created_at": r.created_at,
                "updated_at": r.updated_at,
            }
            for r in reviews
        ]
    }


# ============== Admin Endpoints ==============

@router.get("/admin/all", response_model=List[ReviewResponse])
async def admin_list_all_reviews(
    current_admin: User = Depends(get_current_admin_user),
    skip: int = 0,
    limit: int = 100,
    user_id: Optional[str] = None,  # Filter by reviewed user
    reviewer_id: Optional[str] = None,  # Filter by reviewer
) -> Any:
    """List all reviews (Admin only)"""
    query_conditions = []

    if user_id:
        query_conditions.append(Review.reviewed_user_id == user_id)
    if reviewer_id:
        query_conditions.append(Review.reviewer_id == reviewer_id)

    if query_conditions:
        reviews = await Review.find(*query_conditions).sort([("created_at", -1)]).skip(skip).limit(limit).to_list()
    else:
        reviews = await Review.find_all().sort([("created_at", -1)]).skip(skip).limit(limit).to_list()

    return [
        {
            "id": str(r.id),
            "reviewer_id": r.reviewer_id,
            "reviewer_name": r.reviewer_name,
            "reviewer_profile_image": r.reviewer_profile_image,
            "reviewed_user_id": r.reviewed_user_id,
            "reviewed_user_name": r.reviewed_user_name,
            "rating": r.rating,
            "comment": r.comment,
            "created_at": r.created_at,
            "updated_at": r.updated_at,
        }
        for r in reviews
    ]


@router.get("/admin/user/{user_id}", response_model=UserReviewStats)
async def admin_get_user_reviews(
    user_id: str,
    current_admin: User = Depends(get_current_admin_user),
) -> Any:
    """Get all reviews for a specific user (Admin only)"""
    user = await User.get(PydanticObjectId(user_id))
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    reviews = await Review.find(
        Review.reviewed_user_id == user_id
    ).sort([("created_at", -1)]).to_list()

    if reviews:
        total_rating = sum(r.rating for r in reviews)
        avg_rating = total_rating / len(reviews)
    else:
        avg_rating = 0.0

    return {
        "user_id": user_id,
        "user_name": user.name,
        "average_rating": round(avg_rating, 2),
        "review_count": len(reviews),
        "reviews": [
            {
                "id": str(r.id),
                "reviewer_id": r.reviewer_id,
                "reviewer_name": r.reviewer_name,
                "reviewer_profile_image": r.reviewer_profile_image,
                "reviewed_user_id": r.reviewed_user_id,
                "reviewed_user_name": r.reviewed_user_name,
                "rating": r.rating,
                "comment": r.comment,
                "created_at": r.created_at,
                "updated_at": r.updated_at,
            }
            for r in reviews
        ]
    }


@router.delete("/admin/{review_id}")
async def admin_delete_review(
    review_id: str,
    current_admin: User = Depends(get_current_admin_user),
) -> Any:
    """Delete any review (Admin only)"""
    review = await Review.get(PydanticObjectId(review_id))
    if not review:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Review not found"
        )

    reviewed_user_id = review.reviewed_user_id
    await review.delete()

    # Update reviewed user's rating stats
    await update_user_rating_stats(reviewed_user_id)

    return {"message": "Review deleted successfully"}


class AdminReviewCreateRequest(BaseModel):
    reviewer_id: str
    reviewed_user_id: str
    rating: int  # 1-5 stars
    comment: Optional[str] = None


class AdminReviewUpdateRequest(BaseModel):
    rating: Optional[int] = None
    comment: Optional[str] = None


@router.post("/admin", response_model=ReviewResponse)
async def admin_create_review(
    data: AdminReviewCreateRequest,
    current_admin: User = Depends(get_current_admin_user),
) -> Any:
    """Create a review on behalf of any user (Admin only)"""
    # Validate rating
    if data.rating < 1 or data.rating > 5:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Rating must be between 1 and 5"
        )

    # Can't review yourself
    if data.reviewer_id == data.reviewed_user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A user cannot review themselves"
        )

    # Get reviewer
    reviewer = await User.get(PydanticObjectId(data.reviewer_id))
    if not reviewer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Reviewer not found"
        )

    # Get reviewed user
    reviewed_user = await User.get(PydanticObjectId(data.reviewed_user_id))
    if not reviewed_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Reviewed user not found"
        )

    # Check if reviewer already reviewed this user
    existing_review = await Review.find_one(
        Review.reviewer_id == data.reviewer_id,
        Review.reviewed_user_id == data.reviewed_user_id
    )
    if existing_review:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This user has already reviewed this person"
        )

    # Create review
    review = Review(
        reviewer_id=data.reviewer_id,
        reviewer_name=reviewer.name,
        reviewer_email=reviewer.email,
        reviewer_profile_image=reviewer.profile_image_thumbnail_url or reviewer.profile_image_url,
        reviewed_user_id=data.reviewed_user_id,
        reviewed_user_name=reviewed_user.name,
        reviewed_user_email=reviewed_user.email,
        rating=data.rating,
        comment=data.comment,
    )
    await review.insert()

    # Update reviewed user's rating stats
    await update_user_rating_stats(data.reviewed_user_id)

    # Log activity
    await log_activity(
        activity_type=ActivityType.REVIEW_CREATED,
        description=f"Admin created review: {reviewer.name} reviewed {reviewed_user.name} ({data.rating} stars)",
        user=current_admin,
        entity_type=EntityType.REVIEW,
        entity_id=str(review.id),
        metadata={
            "rating": data.rating,
            "reviewer_id": data.reviewer_id,
            "reviewer_name": reviewer.name,
            "reviewed_user_id": data.reviewed_user_id,
            "reviewed_user_name": reviewed_user.name,
            "created_by_admin": True,
        }
    )

    return {
        "id": str(review.id),
        "reviewer_id": review.reviewer_id,
        "reviewer_name": review.reviewer_name,
        "reviewer_profile_image": review.reviewer_profile_image,
        "reviewed_user_id": review.reviewed_user_id,
        "reviewed_user_name": review.reviewed_user_name,
        "rating": review.rating,
        "comment": review.comment,
        "created_at": review.created_at,
        "updated_at": review.updated_at,
    }


@router.patch("/admin/{review_id}", response_model=ReviewResponse)
async def admin_update_review(
    review_id: str,
    data: AdminReviewUpdateRequest,
    current_admin: User = Depends(get_current_admin_user),
) -> Any:
    """Update any review (Admin only)"""
    review = await Review.get(PydanticObjectId(review_id))
    if not review:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Review not found"
        )

    # Validate rating if provided
    if data.rating is not None and (data.rating < 1 or data.rating > 5):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Rating must be between 1 and 5"
        )

    # Update fields
    update_data = data.model_dump(exclude_unset=True)
    if update_data:
        update_data["updated_at"] = datetime.utcnow()
        await review.set(update_data)

    # Update reviewed user's rating stats if rating changed
    if data.rating is not None:
        await update_user_rating_stats(review.reviewed_user_id)

    return {
        "id": str(review.id),
        "reviewer_id": review.reviewer_id,
        "reviewer_name": review.reviewer_name,
        "reviewer_profile_image": review.reviewer_profile_image,
        "reviewed_user_id": review.reviewed_user_id,
        "reviewed_user_name": review.reviewed_user_name,
        "rating": review.rating,
        "comment": review.comment,
        "created_at": review.created_at,
        "updated_at": review.updated_at,
    }


@router.get("/admin/stats")
async def admin_review_stats(
    current_admin: User = Depends(get_current_admin_user),
) -> Any:
    """Get review statistics (Admin only)"""
    all_reviews = await Review.find_all().to_list()

    # Rating distribution
    rating_distribution = {1: 0, 2: 0, 3: 0, 4: 0, 5: 0}
    for review in all_reviews:
        rating_distribution[review.rating] += 1

    # Calculate average
    if all_reviews:
        total_rating = sum(r.rating for r in all_reviews)
        avg_rating = total_rating / len(all_reviews)
    else:
        avg_rating = 0.0

    return {
        "total_reviews": len(all_reviews),
        "average_rating": round(avg_rating, 2),
        "rating_distribution": rating_distribution,
        "unique_reviewers": len(set(r.reviewer_id for r in all_reviews)),
        "unique_reviewed_users": len(set(r.reviewed_user_id for r in all_reviews)),
    }
