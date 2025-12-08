from beanie import Document
from pydantic import Field
from datetime import datetime
from enum import Enum
from typing import Optional


class BillingType(str, Enum):
    SUBSCRIPTION = "subscription"
    TRANSACTION_FEE = "transaction_fee"


class BillingStatus(str, Enum):
    PENDING = "pending"
    PAID = "paid"
    FAILED = "failed"
    CANCELLED = "cancelled"
    REFUNDED = "refunded"


class SubscriptionPlan(str, Enum):
    FREE = "free"
    BASIC = "basic"
    PREMIUM = "premium"
    ENTERPRISE = "enterprise"


class SubscriptionStatus(str, Enum):
    ACTIVE = "active"
    CANCELLED = "cancelled"
    EXPIRED = "expired"
    PAST_DUE = "past_due"


class TransactionStatus(str, Enum):
    PENDING = "pending"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    DISPUTED = "disputed"


class Billing(Document):
    """Billing records for subscriptions and transaction fees"""
    user_id: str = Field(..., index=True)
    user_name: str  # Denormalized
    user_email: str  # Denormalized

    type: BillingType
    amount: float
    currency: str = "EUR"
    status: BillingStatus = BillingStatus.PENDING

    # Payment details
    description: Optional[str] = None
    invoice_number: Optional[str] = None
    monri_transaction_id: Optional[str] = None

    # Dates
    due_date: Optional[datetime] = None
    paid_at: Optional[datetime] = None

    # Reference to related entities
    subscription_id: Optional[str] = None
    transaction_id: Optional[str] = None

    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: Optional[datetime] = None

    class Settings:
        name = "billing"
        indexes = [
            "user_id",
            "type",
            "status",
            "due_date",
        ]


class Subscription(Document):
    """User subscription records"""
    user_id: str = Field(..., index=True, unique=True)
    user_name: str  # Denormalized
    user_email: str  # Denormalized

    plan: SubscriptionPlan = SubscriptionPlan.FREE
    status: SubscriptionStatus = SubscriptionStatus.ACTIVE

    # Monri integration
    monri_subscription_id: Optional[str] = None
    monri_customer_id: Optional[str] = None

    # Pricing
    price_monthly: float = 0.0
    currency: str = "EUR"

    # Dates
    started_at: datetime = Field(default_factory=datetime.utcnow)
    expires_at: Optional[datetime] = None
    cancelled_at: Optional[datetime] = None
    next_billing_date: Optional[datetime] = None

    # Settings
    auto_renew: bool = True

    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: Optional[datetime] = None

    class Settings:
        name = "subscriptions"
        indexes = [
            "user_id",
            "plan",
            "status",
            "expires_at",
        ]


class Transaction(Document):
    """Marketplace transaction records (buy/sell orders)"""
    # Order info
    order_id: Optional[str] = None
    watch_id: str = Field(..., index=True)
    watch_info: str  # Denormalized (e.g., "Rolex Submariner 126610LN")

    # Parties
    buyer_id: str = Field(..., index=True)
    buyer_name: str
    seller_id: str = Field(..., index=True)
    seller_name: str

    # Amounts
    amount: float  # Transaction total
    currency: str = "USD"
    fee_percentage: float = 2.5  # Platform fee percentage
    fee_amount: float  # Calculated fee

    # Status
    status: TransactionStatus = TransactionStatus.PENDING

    # Dates
    completed_at: Optional[datetime] = None

    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: Optional[datetime] = None

    class Settings:
        name = "transactions"
        indexes = [
            "watch_id",
            "buyer_id",
            "seller_id",
            "status",
        ]
