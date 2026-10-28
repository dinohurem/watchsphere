"""Monri payment verification.

A subscription may only be activated by something Monri signed: the digest on
the success redirect, or the WP3-callback signature on the server callback.
Before this, both the verify endpoint and the webhook activated Premium for
anyone who asked.
"""

import hashlib
import json
from datetime import datetime

import pytest
import pytest_asyncio
from beanie import PydanticObjectId

from app.core.config import settings
from app.models.billing import Billing, BillingStatus, BillingType, Subscription
from app.services.payment import monri_service

KEY = "key-test-merchant"
WEB = "https://www.watchsphere.io"
API_PUBLIC_URL = "https://api.watchsphere.test"


@pytest.fixture(autouse=True)
def monri_config(monkeypatch):
    monkeypatch.setattr(monri_service, "merchant_key", KEY)
    monkeypatch.setattr(monri_service, "authenticity_token", "token-test")
    monkeypatch.setattr(settings, "ALLOWED_ORIGINS", f"{WEB},http://localhost:5177")
    monkeypatch.setattr(settings, "API_PUBLIC_URL", API_PUBLIC_URL)

    async def no_email(**kwargs):
        return None

    from app.services import payment

    monkeypatch.setattr(payment.email_service, "send_subscription_confirmation_email", no_email)


@pytest_asyncio.fixture
async def billing_db():
    from beanie import init_beanie
    from mongomock_motor import AsyncMongoMockClient

    from app.models.activity_log import ActivityLog

    client = AsyncMongoMockClient()
    await init_beanie(
        database=client["watchsphere_test"],
        document_models=[Billing, Subscription, ActivityLog],
    )
    yield client


def _user(name="Buyer"):
    from app.models.user import User

    user = User.model_construct(email=f"{name.lower()}@example.com", name=name, role="dealer")
    user.id = PydanticObjectId()
    return user


@pytest.fixture
def buyer():
    return _user("Buyer")


@pytest.fixture
def api(billing_db, buyer):
    from fastapi import FastAPI
    from fastapi.testclient import TestClient

    from app.api.v1.endpoints import billing
    from app.core.deps import get_current_user

    application = FastAPI()
    application.include_router(billing.router, prefix="/billing")
    application.dependency_overrides[get_current_user] = lambda: buyer

    with TestClient(application) as client:
        yield client


async def _pending(user, order_number="SUB-20261028-00001", amount=150.0):
    billing = Billing(
        user_id=str(user.id),
        user_name=user.name,
        user_email=user.email,
        type=BillingType.SUBSCRIPTION,
        amount=amount,
        currency="EUR",
        status=BillingStatus.PENDING,
        invoice_number=order_number,
    )
    await billing.insert()
    return billing


def _signed_return(order_number="SUB-20261028-00001", response_code="0000", key=KEY, **extra):
    query = f"status=approved&approval_code=236611&order_number={order_number}&response_code={response_code}"
    for name, value in extra.items():
        query += f"&{name}={value}"
    url = f"{WEB}/payment-callback?{query}"
    digest = hashlib.sha512(f"{key}{url}".encode()).hexdigest()
    return f"{url}&digest={digest}"


def _signed_callback(payload, key=KEY):
    body = json.dumps(payload).encode()
    digest = hashlib.sha512(key.encode() + body).hexdigest()
    return body, {"authorization": f"WP3-callback {digest}", "content-type": "application/json"}


def _approved_payload(order_number="SUB-20261028-00001", amount=15000):
    return {
        "id": 186562,
        "order_number": order_number,
        "amount": amount,
        "currency": "EUR",
        "response_code": "0000",
        "status": "approved",
        "transaction_type": "purchase",
    }


async def _subscription(user):
    return await Subscription.find_one(Subscription.user_id == str(user.id))


class TestReturnDigest:
    def test_accepts_a_real_monri_redirect(self, monkeypatch):
        """Signed by Monri's test gateway for an actual test payment."""
        monkeypatch.setattr(monri_service, "merchant_key", "key-944bc24cd123fa7403da6278825114f1")
        url = (
            "http://localhost:3000/payment-callback?status=approved&acquirer=xml-sim&amount=15000"
            "&approval_code=236611&authentication=&cc_type=visa&ch_address=Address+1"
            "&ch_city=Sarajevo&ch_email=dinowatch%40sharklasers.com&ch_full_name=Dino+Hurem"
            "&ch_phone=%2B38762123456&ch_zip=71000&currency=EUR&eci=06&enrollment=N"
            "&issuer=off-us&language=en&masked_pan=424242-xxx-xxx-4242&number_of_installments="
            "&order_number=SUB-20261028-00001&reference_number=922004&response_code=0000"
            "&digest=29bfda06010739e9fa57f2d55eb177cfadaebd49077b3448ae98a01d3dddb597ef376b41"
            "0159681c54f4c5f03585c387cfd53bb478d1b834d57b63e4c8ed88e8"
        )

        assert monri_service.verify_return_url(url)

    def test_rejects_a_tampered_url(self):
        url = _signed_return().replace("response_code=0000", "response_code=0001")

        assert not monri_service.verify_return_url(url)

    def test_rejects_a_url_without_digest(self):
        assert not monri_service.verify_return_url(f"{WEB}/payment-callback?status=approved")

    def test_rejects_a_url_signed_with_another_key(self):
        assert not monri_service.verify_return_url(_signed_return(key="key-attacker"))

    def test_unset_key_verifies_nothing(self, monkeypatch):
        monkeypatch.setattr(monri_service, "merchant_key", "")

        assert not monri_service.verify_return_url(_signed_return(key=""))


class TestFormData:
    @pytest.mark.asyncio
    async def test_uses_the_fields_monri_honours(self, buyer):
        data = await monri_service.create_payment_form_data(
            buyer, "SUB-1", f"{WEB}/payment-callback?status=approved", f"{WEB}/payment-callback?status=cancelled"
        )
        form = data["form_data"]

        assert form["success_url_override"] == f"{WEB}/payment-callback?status=approved"
        assert form["cancel_url_override"] == f"{WEB}/payment-callback?status=cancelled"
        assert form["callback_url_override"] == f"{API_PUBLIC_URL}/api/v1/billing/webhook/monri"
        assert not {"success_url", "cancel_url", "callback_url"} & form.keys()

    @pytest.mark.asyncio
    async def test_leaves_non_https_urls_to_the_merchant_settings(self, buyer, monkeypatch):
        monkeypatch.setattr(settings, "API_PUBLIC_URL", "")
        data = await monri_service.create_payment_form_data(
            buyer, "SUB-1", "http://localhost:5177/payment-callback", "http://localhost:5177/payment-callback"
        )

        assert not {k for k in data["form_data"] if k.endswith("_override")}


class TestSubscribe:
    def test_refuses_when_monri_is_not_configured(self, api, monkeypatch):
        monkeypatch.setattr(monri_service, "merchant_key", "")

        response = api.post(
            "/billing/subscription/subscribe",
            json={"return_url": f"{WEB}/payment-callback", "cancel_url": f"{WEB}/payment-callback"},
        )

        assert response.status_code == 503

    def test_refuses_to_send_buyers_to_a_foreign_site(self, api):
        response = api.post(
            "/billing/subscription/subscribe",
            json={"return_url": "https://evil.example/payment-callback", "cancel_url": f"{WEB}/x"},
        )

        assert response.status_code == 400


class TestVerifyEndpoint:
    @pytest.mark.asyncio
    async def test_unsigned_return_activates_nothing(self, api, buyer):
        """The old hole: a pending record plus a call to /verify was Premium."""
        await _pending(buyer)

        response = api.post(
            "/billing/subscription/verify",
            json={"return_url": f"{WEB}/payment-callback?status=approved&order_number=SUB-20261028-00001&response_code=0000"},
        )

        assert response.status_code == 400
        assert await _subscription(buyer) is None
        assert (await Billing.find_one()).status == BillingStatus.PENDING

    @pytest.mark.asyncio
    async def test_signed_approved_return_activates(self, api, buyer):
        await _pending(buyer)

        response = api.post("/billing/subscription/verify", json={"return_url": _signed_return()})

        assert response.status_code == 200
        assert response.json()["status"] == "activated"
        assert response.json()["subscription"]["has_subscription"] is True
        assert (await Billing.find_one()).status == BillingStatus.PAID

    @pytest.mark.asyncio
    async def test_replaying_the_return_does_not_extend_twice(self, api, buyer):
        await _pending(buyer)
        url = _signed_return()

        api.post("/billing/subscription/verify", json={"return_url": url})
        expires_once = (await _subscription(buyer)).expires_at
        response = api.post("/billing/subscription/verify", json={"return_url": url})

        assert response.json()["status"] == "already_processed"
        assert (await _subscription(buyer)).expires_at == expires_once

    @pytest.mark.asyncio
    async def test_declined_return_activates_nothing(self, api, buyer):
        await _pending(buyer)

        response = api.post(
            "/billing/subscription/verify", json={"return_url": _signed_return(response_code="1001")}
        )

        assert response.status_code == 400
        assert await _subscription(buyer) is None

    @pytest.mark.asyncio
    async def test_cannot_redeem_someone_elses_payment(self, api, buyer):
        other = _user("Other")
        await _pending(other)

        response = api.post("/billing/subscription/verify", json={"return_url": _signed_return()})

        assert response.status_code == 404
        assert await _subscription(buyer) is None
        assert await _subscription(other) is None

    @pytest.mark.asyncio
    async def test_rejects_an_amount_that_does_not_match(self, api, buyer):
        await _pending(buyer)

        response = api.post(
            "/billing/subscription/verify",
            json={"return_url": _signed_return(amount="100", currency="EUR")},
        )

        assert response.status_code == 400
        assert await _subscription(buyer) is None


class TestWebhook:
    @pytest.mark.asyncio
    async def test_unsigned_callback_activates_nothing(self, api, buyer):
        await _pending(buyer)

        response = api.post("/billing/webhook/monri", json=_approved_payload())

        assert response.status_code == 401
        assert await _subscription(buyer) is None

    @pytest.mark.asyncio
    async def test_callback_signed_with_another_key_is_rejected(self, api, buyer):
        await _pending(buyer)
        body, headers = _signed_callback(_approved_payload(), key="key-attacker")

        response = api.post("/billing/webhook/monri", content=body, headers=headers)

        assert response.status_code == 401
        assert await _subscription(buyer) is None

    @pytest.mark.asyncio
    async def test_signed_callback_activates_and_records_the_transaction(self, api, buyer):
        await _pending(buyer)
        body, headers = _signed_callback(_approved_payload())

        response = api.post("/billing/webhook/monri", content=body, headers=headers)

        assert response.status_code == 200
        billing = await Billing.find_one()
        assert billing.status == BillingStatus.PAID
        assert billing.monri_transaction_id == "186562"
        assert (await _subscription(buyer)).expires_at > datetime.utcnow()

    @pytest.mark.asyncio
    async def test_callback_after_the_return_is_acknowledged_without_extending(self, api, buyer):
        await _pending(buyer)
        api.post("/billing/subscription/verify", json={"return_url": _signed_return()})
        expires_once = (await _subscription(buyer)).expires_at
        body, headers = _signed_callback(_approved_payload())

        response = api.post("/billing/webhook/monri", content=body, headers=headers)

        assert response.status_code == 200
        assert (await _subscription(buyer)).expires_at == expires_once

    @pytest.mark.asyncio
    async def test_signed_callback_with_wrong_amount_is_rejected(self, api, buyer):
        await _pending(buyer)
        body, headers = _signed_callback(_approved_payload(amount=100))

        response = api.post("/billing/webhook/monri", content=body, headers=headers)

        assert response.status_code == 400
        assert await _subscription(buyer) is None
