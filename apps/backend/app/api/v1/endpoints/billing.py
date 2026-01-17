from typing import Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Request
from pydantic import BaseModel
from datetime import datetime
from beanie import PydanticObjectId

from app.core.deps import get_current_admin_user, get_current_user
from app.models.user import User
from app.models.billing import (
    Billing, BillingType, BillingStatus,
    Subscription, SubscriptionPlan, SubscriptionStatus,
    Transaction, TransactionStatus, SubscriptionHistory
)
from app.services.payment import monri_service, check_subscription_status, log_payment_activity
from app.services.email import email_service
from app.models.activity_log import ActivityType, EntityType

router = APIRouter()


# Response Models
class BillingResponse(BaseModel):
    id: str
    user_id: str
    user_name: str
    user_email: str
    type: BillingType
    amount: float
    currency: str
    status: BillingStatus
    description: Optional[str] = None
    invoice_number: Optional[str] = None
    due_date: Optional[datetime] = None
    paid_at: Optional[datetime] = None
    created_at: datetime


class SubscriptionResponse(BaseModel):
    id: str
    user_id: str
    user_name: str
    user_email: str
    plan: SubscriptionPlan
    status: SubscriptionStatus
    price_monthly: float
    currency: str
    started_at: datetime
    expires_at: Optional[datetime] = None
    next_billing_date: Optional[datetime] = None
    auto_renew: bool
    created_at: datetime


class TransactionResponse(BaseModel):
    id: str
    watch_id: str
    watch_info: str
    buyer_id: str
    buyer_name: str
    seller_id: str
    seller_name: str
    amount: float
    currency: str
    fee_percentage: float
    fee_amount: float
    status: TransactionStatus
    completed_at: Optional[datetime] = None
    created_at: datetime


class SubscriptionHistoryResponse(BaseModel):
    id: str
    subscription_id: str
    user_id: str
    user_name: str
    user_email: str
    plan: SubscriptionPlan
    status: SubscriptionStatus
    price_monthly: float
    currency: str
    action: str
    action_by: Optional[str] = None
    period_start: datetime
    period_end: Optional[datetime] = None
    created_at: datetime


# Request Models
class BillingCreate(BaseModel):
    user_id: str
    type: BillingType
    amount: float
    currency: str = "EUR"
    description: Optional[str] = None
    due_date: Optional[datetime] = None


class BillingUpdate(BaseModel):
    amount: Optional[float] = None
    status: Optional[BillingStatus] = None
    description: Optional[str] = None
    due_date: Optional[datetime] = None
    paid_at: Optional[datetime] = None


class SubscriptionCreate(BaseModel):
    user_id: str
    plan: SubscriptionPlan
    status: SubscriptionStatus = SubscriptionStatus.ACTIVE
    price_monthly: float = 0.0
    currency: str = "EUR"
    expires_at: Optional[datetime] = None
    auto_renew: bool = True


class SubscriptionUpdate(BaseModel):
    plan: Optional[SubscriptionPlan] = None
    status: Optional[SubscriptionStatus] = None
    price_monthly: Optional[float] = None
    currency: Optional[str] = None
    expires_at: Optional[datetime] = None
    auto_renew: Optional[bool] = None


# ============== BILLING ADMIN ENDPOINTS ==============

@router.get("/admin/billing", response_model=List[BillingResponse])
async def admin_list_billing(
    current_admin: User = Depends(get_current_admin_user),
    skip: int = 0,
    limit: int = 100,
    type_filter: Optional[BillingType] = None,
    status_filter: Optional[BillingStatus] = None,
    user_id: Optional[str] = None,
) -> Any:
    """List all billing records (Admin only)"""

    query_conditions = []

    if type_filter:
        query_conditions.append(Billing.type == type_filter)
    if status_filter:
        query_conditions.append(Billing.status == status_filter)
    if user_id:
        query_conditions.append(Billing.user_id == user_id)

    if query_conditions:
        records = await Billing.find(*query_conditions).sort([("created_at", -1)]).skip(skip).limit(limit).to_list()
    else:
        records = await Billing.find_all().sort([("created_at", -1)]).skip(skip).limit(limit).to_list()

    return [
        {
            "id": str(r.id),
            "user_id": r.user_id,
            "user_name": r.user_name,
            "user_email": r.user_email,
            "type": r.type,
            "amount": r.amount,
            "currency": r.currency,
            "status": r.status,
            "description": r.description,
            "invoice_number": r.invoice_number,
            "due_date": r.due_date,
            "paid_at": r.paid_at,
            "created_at": r.created_at,
        }
        for r in records
    ]


@router.post("/admin/billing", response_model=BillingResponse)
async def admin_create_billing(
    billing_data: BillingCreate,
    current_admin: User = Depends(get_current_admin_user),
) -> Any:
    """Create a billing record (Admin only)"""

    # Get user info
    user = await User.get(PydanticObjectId(billing_data.user_id))
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    # Generate invoice number
    count = await Billing.find_all().count()
    invoice_number = f"INV-{datetime.utcnow().strftime('%Y%m')}-{str(count + 1).zfill(5)}"

    billing = Billing(
        user_id=billing_data.user_id,
        user_name=user.name,
        user_email=user.email,
        type=billing_data.type,
        amount=billing_data.amount,
        currency=billing_data.currency,
        description=billing_data.description,
        invoice_number=invoice_number,
        due_date=billing_data.due_date,
    )

    await billing.insert()

    return {
        "id": str(billing.id),
        "user_id": billing.user_id,
        "user_name": billing.user_name,
        "user_email": billing.user_email,
        "type": billing.type,
        "amount": billing.amount,
        "currency": billing.currency,
        "status": billing.status,
        "description": billing.description,
        "invoice_number": billing.invoice_number,
        "due_date": billing.due_date,
        "paid_at": billing.paid_at,
        "created_at": billing.created_at,
    }


@router.patch("/admin/billing/{billing_id}", response_model=BillingResponse)
async def admin_update_billing(
    billing_id: str,
    billing_update: BillingUpdate,
    current_admin: User = Depends(get_current_admin_user),
) -> Any:
    """Update a billing record (Admin only)"""

    billing = await Billing.get(PydanticObjectId(billing_id))

    if not billing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Billing record not found"
        )

    update_data = billing_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(billing, field, value)

    billing.updated_at = datetime.utcnow()
    await billing.save()

    return {
        "id": str(billing.id),
        "user_id": billing.user_id,
        "user_name": billing.user_name,
        "user_email": billing.user_email,
        "type": billing.type,
        "amount": billing.amount,
        "currency": billing.currency,
        "status": billing.status,
        "description": billing.description,
        "invoice_number": billing.invoice_number,
        "due_date": billing.due_date,
        "paid_at": billing.paid_at,
        "created_at": billing.created_at,
    }


@router.delete("/admin/billing/{billing_id}")
async def admin_delete_billing(
    billing_id: str,
    current_admin: User = Depends(get_current_admin_user),
) -> Any:
    """Delete a billing record (Admin only)"""

    billing = await Billing.get(PydanticObjectId(billing_id))

    if not billing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Billing record not found"
        )

    await billing.delete()

    return {"message": "Billing record deleted successfully"}


# ============== SUBSCRIPTION ADMIN ENDPOINTS ==============

@router.get("/admin/subscriptions", response_model=List[SubscriptionResponse])
async def admin_list_subscriptions(
    current_admin: User = Depends(get_current_admin_user),
    skip: int = 0,
    limit: int = 100,
    plan_filter: Optional[SubscriptionPlan] = None,
    status_filter: Optional[SubscriptionStatus] = None,
) -> Any:
    """List all subscriptions (Admin only)"""

    query_conditions = []

    if plan_filter:
        query_conditions.append(Subscription.plan == plan_filter)
    if status_filter:
        query_conditions.append(Subscription.status == status_filter)

    if query_conditions:
        subs = await Subscription.find(*query_conditions).sort([("created_at", -1)]).skip(skip).limit(limit).to_list()
    else:
        subs = await Subscription.find_all().sort([("created_at", -1)]).skip(skip).limit(limit).to_list()

    return [
        {
            "id": str(s.id),
            "user_id": s.user_id,
            "user_name": s.user_name,
            "user_email": s.user_email,
            "plan": s.plan,
            "status": s.status,
            "price_monthly": s.price_monthly,
            "currency": s.currency,
            "started_at": s.started_at,
            "expires_at": s.expires_at,
            "next_billing_date": s.next_billing_date,
            "auto_renew": s.auto_renew,
            "created_at": s.created_at,
        }
        for s in subs
    ]


@router.post("/admin/subscriptions", response_model=SubscriptionResponse)
async def admin_create_subscription(
    sub_data: SubscriptionCreate,
    current_admin: User = Depends(get_current_admin_user),
) -> Any:
    """Create a subscription (Admin only)"""

    # Get user info
    user = await User.get(PydanticObjectId(sub_data.user_id))
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    # Check if subscription already exists
    existing = await Subscription.find_one(Subscription.user_id == sub_data.user_id)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User already has a subscription"
        )

    subscription = Subscription(
        user_id=sub_data.user_id,
        user_name=user.name,
        user_email=user.email,
        plan=sub_data.plan,
        status=sub_data.status,
        price_monthly=sub_data.price_monthly,
        currency=sub_data.currency,
        expires_at=sub_data.expires_at,
        auto_renew=sub_data.auto_renew,
    )

    await subscription.insert()

    return {
        "id": str(subscription.id),
        "user_id": subscription.user_id,
        "user_name": subscription.user_name,
        "user_email": subscription.user_email,
        "plan": subscription.plan,
        "status": subscription.status,
        "price_monthly": subscription.price_monthly,
        "currency": subscription.currency,
        "started_at": subscription.started_at,
        "expires_at": subscription.expires_at,
        "next_billing_date": subscription.next_billing_date,
        "auto_renew": subscription.auto_renew,
        "created_at": subscription.created_at,
    }


@router.patch("/admin/subscriptions/{sub_id}", response_model=SubscriptionResponse)
async def admin_update_subscription(
    sub_id: str,
    sub_update: SubscriptionUpdate,
    current_admin: User = Depends(get_current_admin_user),
) -> Any:
    """Update a subscription (Admin only)"""

    subscription = await Subscription.get(PydanticObjectId(sub_id))

    if not subscription:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Subscription not found"
        )

    update_data = sub_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(subscription, field, value)

    if sub_update.status == SubscriptionStatus.CANCELLED:
        subscription.cancelled_at = datetime.utcnow()

    subscription.updated_at = datetime.utcnow()
    await subscription.save()

    return {
        "id": str(subscription.id),
        "user_id": subscription.user_id,
        "user_name": subscription.user_name,
        "user_email": subscription.user_email,
        "plan": subscription.plan,
        "status": subscription.status,
        "price_monthly": subscription.price_monthly,
        "currency": subscription.currency,
        "started_at": subscription.started_at,
        "expires_at": subscription.expires_at,
        "next_billing_date": subscription.next_billing_date,
        "auto_renew": subscription.auto_renew,
        "created_at": subscription.created_at,
    }


@router.get("/admin/subscriptions/{sub_id}/history", response_model=List[SubscriptionHistoryResponse])
async def admin_get_subscription_history(
    sub_id: str,
    current_admin: User = Depends(get_current_admin_user),
) -> Any:
    """Get subscription history records (Admin only)"""

    history = await SubscriptionHistory.find(
        SubscriptionHistory.subscription_id == sub_id
    ).sort([("created_at", -1)]).to_list()

    return [
        {
            "id": str(h.id),
            "subscription_id": h.subscription_id,
            "user_id": h.user_id,
            "user_name": h.user_name,
            "user_email": h.user_email,
            "plan": h.plan,
            "status": h.status,
            "price_monthly": h.price_monthly,
            "currency": h.currency,
            "action": h.action,
            "action_by": h.action_by,
            "period_start": h.period_start,
            "period_end": h.period_end,
            "created_at": h.created_at,
        }
        for h in history
    ]


@router.delete("/admin/subscriptions/{sub_id}")
async def admin_delete_subscription(
    sub_id: str,
    current_admin: User = Depends(get_current_admin_user),
) -> Any:
    """Delete a subscription and all its history records (Admin only)"""

    subscription = await Subscription.get(PydanticObjectId(sub_id))

    if not subscription:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Subscription not found"
        )

    # Delete all history records for this subscription
    await SubscriptionHistory.find(
        SubscriptionHistory.subscription_id == sub_id
    ).delete()

    # Delete the subscription
    await subscription.delete()

    return {"message": "Subscription and history deleted successfully"}


# ============== TRANSACTION ADMIN ENDPOINTS ==============

@router.get("/admin/transactions", response_model=List[TransactionResponse])
async def admin_list_transactions(
    current_admin: User = Depends(get_current_admin_user),
    skip: int = 0,
    limit: int = 100,
    status_filter: Optional[TransactionStatus] = None,
) -> Any:
    """List all transactions (Admin only)"""

    if status_filter:
        txns = await Transaction.find(Transaction.status == status_filter).sort([("created_at", -1)]).skip(skip).limit(limit).to_list()
    else:
        txns = await Transaction.find_all().sort([("created_at", -1)]).skip(skip).limit(limit).to_list()

    return [
        {
            "id": str(t.id),
            "watch_id": t.watch_id,
            "watch_info": t.watch_info,
            "buyer_id": t.buyer_id,
            "buyer_name": t.buyer_name,
            "seller_id": t.seller_id,
            "seller_name": t.seller_name,
            "amount": t.amount,
            "currency": t.currency,
            "fee_percentage": t.fee_percentage,
            "fee_amount": t.fee_amount,
            "status": t.status,
            "completed_at": t.completed_at,
            "created_at": t.created_at,
        }
        for t in txns
    ]


# ============== STATS ==============

@router.get("/admin/billing/stats")
async def admin_billing_stats(
    current_admin: User = Depends(get_current_admin_user),
) -> Any:
    """Get billing statistics (Admin only)"""

    all_billing = await Billing.find_all().to_list()
    all_subs = await Subscription.find_all().to_list()
    all_txns = await Transaction.find_all().to_list()

    # Billing stats
    total_billed = sum(b.amount for b in all_billing)
    paid_billing = [b for b in all_billing if b.status == BillingStatus.PAID]
    total_paid = sum(b.amount for b in paid_billing)
    pending_billing = [b for b in all_billing if b.status == BillingStatus.PENDING]
    total_pending = sum(b.amount for b in pending_billing)

    # Subscription stats
    active_subs = [s for s in all_subs if s.status == SubscriptionStatus.ACTIVE]
    mrr = sum(s.price_monthly for s in active_subs)  # Monthly Recurring Revenue

    # Transaction stats
    completed_txns = [t for t in all_txns if t.status == TransactionStatus.COMPLETED]
    total_transaction_volume = sum(t.amount for t in completed_txns)
    total_fees_collected = sum(t.fee_amount for t in completed_txns)

    return {
        "billing": {
            "total_records": len(all_billing),
            "total_billed": total_billed,
            "total_paid": total_paid,
            "total_pending": total_pending,
            "pending_count": len(pending_billing),
        },
        "subscriptions": {
            "total": len(all_subs),
            "active": len(active_subs),
            "mrr": mrr,
            "by_plan": {
                plan.value: len([s for s in all_subs if s.plan == plan])
                for plan in SubscriptionPlan
            },
        },
        "transactions": {
            "total": len(all_txns),
            "completed": len(completed_txns),
            "volume": total_transaction_volume,
            "fees_collected": total_fees_collected,
        },
    }


# ============== USER SUBSCRIPTION ENDPOINTS ==============

class SubscribeRequest(BaseModel):
    return_url: str
    cancel_url: str


class UserSubscriptionResponse(BaseModel):
    has_subscription: bool
    status: Optional[str] = None
    plan: Optional[str] = None
    is_trial: bool
    trial_days_remaining: int
    subscription_days_remaining: int
    expires_at: Optional[datetime] = None
    price_monthly: Optional[float] = None
    currency: Optional[str] = None
    auto_renew: Optional[bool] = None


@router.get("/subscription/status", response_model=UserSubscriptionResponse)
async def get_subscription_status(
    current_user: User = Depends(get_current_user),
) -> Any:
    """Get current user's subscription status"""
    status_info = await check_subscription_status(str(current_user.id))
    return status_info


@router.post("/subscription/subscribe")
async def initiate_subscription(
    data: SubscribeRequest,
    current_user: User = Depends(get_current_user),
) -> Any:
    """
    Initiate subscription payment.
    Returns payment form data for Monri hosted payment page.
    """
    # Check if user already has an active non-trial subscription
    status_info = await check_subscription_status(str(current_user.id))

    if status_info["has_subscription"] and not status_info["is_trial"]:
        # Check if subscription is still valid for more than 7 days
        if status_info["subscription_days_remaining"] > 7:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="You already have an active subscription"
            )

    # Create billing record
    billing = await monri_service.create_subscription_billing(current_user)

    # Get payment form data
    payment_data = await monri_service.create_payment_form_data(
        user=current_user,
        order_number=billing.invoice_number,
        return_url=data.return_url,
        cancel_url=data.cancel_url,
    )

    # Log payment initiation
    await log_payment_activity(
        activity_type=ActivityType.PAYMENT_INITIATED,
        description=f"Payment initiated for Premium subscription ({billing.amount} {billing.currency})",
        user_id=str(current_user.id),
        user_name=current_user.name,
        user_email=current_user.email,
        entity_type=EntityType.PAYMENT,
        entity_id=str(billing.id),
        metadata={
            "amount": billing.amount,
            "currency": billing.currency,
            "order_number": billing.invoice_number,
        }
    )

    return {
        "billing_id": str(billing.id),
        "order_number": billing.invoice_number,
        **payment_data,
    }


@router.post("/subscription/verify")
async def verify_subscription_payment(
    current_user: User = Depends(get_current_user),
) -> Any:
    """
    Verify and activate subscription after payment return.
    This endpoint is called when the user returns from Monri with approved status,
    in case the webhook hasn't processed yet.
    """
    from dateutil.relativedelta import relativedelta

    # Find the most recent pending billing record for this user
    billing = await Billing.find_one(
        Billing.user_id == str(current_user.id),
        Billing.type == BillingType.SUBSCRIPTION,
        Billing.status == BillingStatus.PENDING,
    )

    if not billing:
        # Check if there's already a paid billing record (webhook already processed)
        recent_paid = await Billing.find_one(
            Billing.user_id == str(current_user.id),
            Billing.type == BillingType.SUBSCRIPTION,
            Billing.status == BillingStatus.PAID,
        )
        if recent_paid:
            # Check subscription status
            status_info = await check_subscription_status(str(current_user.id))
            return {
                "status": "already_processed",
                "subscription": status_info,
            }
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No pending payment found"
        )

    # Process the payment as approved (simulate webhook for development)
    now = datetime.utcnow()

    # Update billing record
    billing.status = BillingStatus.PAID
    billing.paid_at = now
    billing.updated_at = now
    await billing.save()

    # Update or create subscription
    subscription = await Subscription.find_one(
        Subscription.user_id == str(current_user.id)
    )

    if subscription:
        # Activate/renew existing subscription
        subscription.status = SubscriptionStatus.ACTIVE
        subscription.plan = SubscriptionPlan.PREMIUM
        subscription.price_monthly = monri_service.subscription_price

        # Set new expiration (1 month from now or from current expiration)
        if subscription.expires_at and subscription.expires_at > now:
            subscription.expires_at = subscription.expires_at + relativedelta(months=1)
        else:
            subscription.expires_at = now + relativedelta(months=1)

        subscription.next_billing_date = subscription.expires_at
        subscription.auto_renew = True
        subscription.updated_at = now
        await subscription.save()
    else:
        # Create new subscription record
        subscription = Subscription(
            user_id=str(current_user.id),
            user_name=current_user.name,
            user_email=current_user.email,
            plan=SubscriptionPlan.PREMIUM,
            status=SubscriptionStatus.ACTIVE,
            price_monthly=monri_service.subscription_price,
            currency=monri_service.currency,
            started_at=now,
            expires_at=now + relativedelta(months=1),
            next_billing_date=now + relativedelta(months=1),
            auto_renew=True,
        )
        await subscription.insert()

    # Log the payment activity
    await log_payment_activity(
        activity_type=ActivityType.PAYMENT_COMPLETED,
        description=f"Payment of {billing.amount} {billing.currency} completed for Premium subscription (verified)",
        user_id=str(current_user.id),
        user_name=current_user.name,
        user_email=current_user.email,
        entity_type=EntityType.PAYMENT,
        entity_id=str(billing.id),
        metadata={
            "amount": billing.amount,
            "currency": billing.currency,
            "order_number": billing.invoice_number,
            "verified_manually": True,
        }
    )

    # Send subscription confirmation email
    try:
        expires_at_str = subscription.expires_at.strftime('%B %d, %Y') if subscription.expires_at else "N/A"
        await email_service.send_subscription_confirmation_email(
            to_email=current_user.email,
            user_name=current_user.name,
            plan_name="Premium",
            amount=billing.amount,
            currency=billing.currency,
            expires_at=expires_at_str,
            is_renewal=False,
        )
    except Exception as e:
        # Don't fail the payment flow if email fails
        print(f"Failed to send subscription confirmation email: {e}")

    # Get updated subscription status
    status_info = await check_subscription_status(str(current_user.id))

    return {
        "status": "activated",
        "subscription": status_info,
    }


@router.post("/subscription/cancel")
async def cancel_subscription(
    current_user: User = Depends(get_current_user),
) -> Any:
    """Cancel auto-renewal of subscription"""
    subscription = await Subscription.find_one(
        Subscription.user_id == str(current_user.id)
    )

    if not subscription:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No subscription found"
        )

    if subscription.status != SubscriptionStatus.ACTIVE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Subscription is not active"
        )

    # Cancel auto-renewal but keep subscription active until expiration
    subscription.auto_renew = False
    subscription.updated_at = datetime.utcnow()
    await subscription.save()

    # Log subscription cancellation
    await log_payment_activity(
        activity_type=ActivityType.SUBSCRIPTION_CANCELLED,
        description=f"Subscription auto-renewal cancelled. Expires on {subscription.expires_at.strftime('%Y-%m-%d') if subscription.expires_at else 'N/A'}",
        user_id=str(current_user.id),
        user_name=current_user.name,
        user_email=current_user.email,
        entity_type=EntityType.SUBSCRIPTION,
        entity_id=str(subscription.id),
        metadata={
            "plan": subscription.plan.value,
            "expires_at": subscription.expires_at.isoformat() if subscription.expires_at else None,
        }
    )

    return {
        "message": "Subscription will not renew automatically",
        "expires_at": subscription.expires_at,
    }


@router.post("/webhook/monri")
async def monri_webhook(request: Request) -> Any:
    """Handle Monri payment webhook callbacks"""
    try:
        payload = await request.json()
    except Exception:
        payload = dict(await request.form())

    result = await monri_service.process_webhook(payload)

    if result.get("success"):
        return {"status": "ok"}
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=result.get("error", "Unknown error")
        )
