"""Global paywall toggle.

Every client hides its upgrade prompt when /billing/subscription/status
reports has_subscription, so with the paywall off that endpoint reports access
for every user. Only an admin may flip the switch.
"""

from datetime import datetime, timedelta

import pytest
import pytest_asyncio
from beanie import PydanticObjectId

from app.models.app_settings import AppSettings
from app.models.billing import Subscription, SubscriptionPlan, SubscriptionStatus


@pytest_asyncio.fixture
async def settings_db():
    from beanie import init_beanie
    from mongomock_motor import AsyncMongoMockClient

    client = AsyncMongoMockClient()
    await init_beanie(
        database=client["watchsphere_test"],
        document_models=[AppSettings, Subscription],
    )
    yield client


def _user(role="dealer"):
    from app.models.user import User

    user = User.model_construct(email=f"{role}@example.com", name=role.title(), role=role)
    user.id = PydanticObjectId()
    return user


@pytest.fixture
def member():
    return _user("dealer")


@pytest.fixture
def client(settings_db, member):
    from fastapi import FastAPI
    from fastapi.testclient import TestClient

    from app.api.v1.endpoints import app_settings, billing
    from app.core.deps import get_current_user

    application = FastAPI()
    application.include_router(billing.router, prefix="/billing")
    application.include_router(app_settings.router, prefix="/settings")
    application.dependency_overrides[get_current_user] = lambda: member

    with TestClient(application) as test_client:
        yield test_client


def _as_admin(client):
    from app.core.deps import get_current_admin_user

    client.app.dependency_overrides[get_current_admin_user] = lambda: _user("admin")


async def _set_paywall(enabled):
    settings = await AppSettings.get_global()
    settings.paywall_enabled = enabled
    await settings.save()


class TestStatus:
    def test_paywall_is_off_by_default(self, client):
        assert client.get("/settings/app").json()["paywall_enabled"] is False

        body = client.get("/billing/subscription/status").json()
        assert body["has_subscription"] is True
        assert body["paywall_enabled"] is False

    async def test_paywall_on_gates_users_without_a_subscription(self, client):
        await _set_paywall(True)

        body = client.get("/billing/subscription/status").json()
        assert body["has_subscription"] is False
        assert body["paywall_enabled"] is True

    async def test_paywall_off_keeps_the_real_subscription_details(self, client, member):
        expires = datetime.utcnow() - timedelta(days=3)
        await Subscription(
            user_id=str(member.id),
            user_name=member.name,
            user_email=member.email,
            plan=SubscriptionPlan.PREMIUM,
            status=SubscriptionStatus.ACTIVE,
            price_monthly=150.0,
            currency="EUR",
            started_at=expires - timedelta(days=30),
            expires_at=expires,
        ).insert()

        body = client.get("/billing/subscription/status").json()
        assert body["has_subscription"] is True
        assert body["status"] == "expired"
        assert body["plan"] == "premium"

        await _set_paywall(True)
        assert client.get("/billing/subscription/status").json()["has_subscription"] is False


class TestToggle:
    def test_admin_can_turn_the_paywall_on_and_off(self, client):
        _as_admin(client)

        response = client.patch("/settings/app", json={"paywall_enabled": True})
        assert response.status_code == 200
        assert response.json() == {"v2_enabled": False, "paywall_enabled": True}
        assert client.get("/billing/subscription/status").json()["has_subscription"] is False

        client.patch("/settings/app", json={"paywall_enabled": False})
        assert client.get("/billing/subscription/status").json()["has_subscription"] is True

    def test_updating_one_setting_leaves_the_other_alone(self, client):
        _as_admin(client)
        client.patch("/settings/app", json={"paywall_enabled": True})

        response = client.patch("/settings/app", json={"v2_enabled": True})
        assert response.json() == {"v2_enabled": True, "paywall_enabled": True}

    def test_non_admin_cannot_change_it(self, client):
        response = client.patch("/settings/app", json={"paywall_enabled": True})
        assert response.status_code in (401, 403)
        assert client.get("/settings/app").json()["paywall_enabled"] is False
