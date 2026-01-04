from typing import Optional, Dict, Any
from datetime import datetime
from dateutil.relativedelta import relativedelta
import hashlib
import httpx

from app.core.config import settings
from app.models.user import User
from app.models.billing import (
    Subscription, SubscriptionPlan, SubscriptionStatus,
    Billing, BillingType, BillingStatus
)


class MonriPaymentService:
    """Service for handling Monri payment integration"""

    def __init__(self):
        self.merchant_key = settings.MONRI_MERCHANT_KEY
        self.authenticity_token = settings.MONRI_AUTHENTICITY_TOKEN
        self.api_url = settings.MONRI_API_URL
        self.subscription_price = settings.MONRI_SUBSCRIPTION_PRICE
        self.currency = settings.MONRI_CURRENCY

    def _generate_digest(self, order_number: str, amount: int, currency: str) -> str:
        """Generate digest for Monri API authentication"""
        # Amount should be in cents (100.00 EUR = 10000)
        digest_string = f"{self.merchant_key}{order_number}{amount}{currency}"
        return hashlib.sha512(digest_string.encode()).hexdigest()

    async def create_payment_form_data(
        self,
        user: User,
        order_number: str,
        return_url: str,
        cancel_url: str,
    ) -> Dict[str, Any]:
        """
        Generate payment form data for Monri hosted payment page.

        Args:
            user: The user making the payment
            order_number: Unique order number
            return_url: URL to redirect after successful payment
            cancel_url: URL to redirect if payment is cancelled

        Returns:
            Dictionary with form data for Monri payment form
        """
        amount_cents = int(self.subscription_price * 100)  # Convert to cents

        digest = self._generate_digest(order_number, amount_cents, self.currency)

        form_data = {
            "authenticity_token": self.authenticity_token,
            "ch_full_name": user.name,
            "ch_email": user.email,
            "order_number": order_number,
            "amount": amount_cents,
            "currency": self.currency,
            "digest": digest,
            "transaction_type": "purchase",
            "order_info": f"WatchSphere Premium Subscription - {user.email}",
            "language": "en",
            "success_url": return_url,
            "cancel_url": cancel_url,
            "callback_url": f"{settings.API_V1_PREFIX}/billing/webhook/monri",
        }

        return {
            "form_url": f"{self.api_url}/v2/form",
            "form_data": form_data,
            "subscription_details": {
                "price": self.subscription_price,
                "currency": self.currency,
                "plan": "Premium",
                "billing_period": "monthly",
            }
        }

    async def process_webhook(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """
        Process Monri webhook callback.

        Args:
            payload: Webhook payload from Monri

        Returns:
            Processing result
        """
        order_number = payload.get("order_number")
        status = payload.get("status")
        transaction_id = payload.get("transaction_id")
        approval_code = payload.get("approval_code")

        if not order_number:
            return {"success": False, "error": "Missing order number"}

        # Find the pending billing record
        billing = await Billing.find_one(
            Billing.invoice_number == order_number,
            Billing.status == BillingStatus.PENDING,
        )

        if not billing:
            return {"success": False, "error": "Billing record not found"}

        if status == "approved":
            # Update billing record
            billing.status = BillingStatus.PAID
            billing.paid_at = datetime.utcnow()
            billing.monri_transaction_id = transaction_id
            billing.updated_at = datetime.utcnow()
            await billing.save()

            # Update subscription
            subscription = await Subscription.find_one(
                Subscription.user_id == billing.user_id
            )

            if subscription:
                # Activate/renew subscription
                now = datetime.utcnow()
                subscription.status = SubscriptionStatus.ACTIVE
                subscription.plan = SubscriptionPlan.PREMIUM
                subscription.price_monthly = self.subscription_price

                # Set new expiration (1 month from now or from current expiration)
                if subscription.expires_at and subscription.expires_at > now:
                    # Add to existing expiration
                    subscription.expires_at = subscription.expires_at + relativedelta(months=1)
                else:
                    # New subscription period
                    subscription.expires_at = now + relativedelta(months=1)

                subscription.next_billing_date = subscription.expires_at
                subscription.auto_renew = True
                subscription.monri_subscription_id = transaction_id
                subscription.updated_at = now
                await subscription.save()

            return {
                "success": True,
                "message": "Payment processed successfully",
                "transaction_id": transaction_id,
            }

        elif status == "declined":
            billing.status = BillingStatus.FAILED
            billing.updated_at = datetime.utcnow()
            await billing.save()

            return {
                "success": False,
                "error": "Payment was declined",
                "transaction_id": transaction_id,
            }

        else:
            return {
                "success": False,
                "error": f"Unknown payment status: {status}",
            }

    async def create_subscription_billing(
        self,
        user: User,
    ) -> Billing:
        """
        Create a billing record for subscription payment.

        Args:
            user: The user subscribing

        Returns:
            Created billing record
        """
        # Generate unique order number
        count = await Billing.find_all().count()
        order_number = f"SUB-{datetime.utcnow().strftime('%Y%m%d')}-{str(count + 1).zfill(5)}"

        billing = Billing(
            user_id=str(user.id),
            user_name=user.name,
            user_email=user.email,
            type=BillingType.SUBSCRIPTION,
            amount=self.subscription_price,
            currency=self.currency,
            status=BillingStatus.PENDING,
            description="WatchSphere Premium Subscription (Monthly)",
            invoice_number=order_number,
            due_date=datetime.utcnow() + relativedelta(days=7),
        )

        await billing.insert()
        return billing


async def check_subscription_status(user_id: str) -> Dict[str, Any]:
    """
    Check if a user has an active subscription.

    Args:
        user_id: The user's ID

    Returns:
        Subscription status details
    """
    subscription = await Subscription.find_one(Subscription.user_id == user_id)

    if not subscription:
        return {
            "has_subscription": False,
            "status": None,
            "plan": None,
            "is_trial": False,
            "trial_days_remaining": 0,
            "expires_at": None,
        }

    now = datetime.utcnow()
    is_active = subscription.status == SubscriptionStatus.ACTIVE

    # Check if in trial (price is 0)
    is_trial = subscription.price_monthly == 0.0 and is_active

    # Calculate days remaining
    days_remaining = 0
    if subscription.expires_at and subscription.expires_at > now:
        delta = subscription.expires_at - now
        days_remaining = delta.days

    # Check if expired
    if subscription.expires_at and subscription.expires_at < now:
        is_active = False
        # Update status if not already expired
        if subscription.status == SubscriptionStatus.ACTIVE:
            subscription.status = SubscriptionStatus.EXPIRED
            subscription.updated_at = now
            await subscription.save()

    return {
        "has_subscription": is_active,
        "status": subscription.status.value,
        "plan": subscription.plan.value,
        "is_trial": is_trial,
        "trial_days_remaining": days_remaining if is_trial else 0,
        "subscription_days_remaining": days_remaining if not is_trial else 0,
        "expires_at": subscription.expires_at,
        "price_monthly": subscription.price_monthly,
        "currency": subscription.currency,
        "auto_renew": subscription.auto_renew,
    }


# Initialize service
monri_service = MonriPaymentService()
