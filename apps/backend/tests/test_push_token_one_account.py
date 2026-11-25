"""A phone's push token belongs to the account signed in on it: registering it for one account
removes it from every other account (Kenan's alert test, 25 Nov 2026 - his phone still received the
pushes of the account it was first signed in with, and none of its own)."""
import pytest
from beanie import init_beanie
from mongomock_motor import AsyncMongoMockClient


@pytest.mark.asyncio
async def test_registering_a_token_moves_it_from_the_other_account():
    from app.api.v1.endpoints.profile import FCMTokenRequest, register_fcm_token, unregister_fcm_token
    from app.models.user import User

    client = AsyncMongoMockClient()
    await init_beanie(database=client["push_token_test"], document_models=[User])
    old = User(email="old@x.io", name="Old", username="old", fcm_tokens=["ExponentPushToken[phone]", "ExponentPushToken[ipad]"])
    new = User(email="new@x.io", name="New", username="new")
    await old.insert()
    await new.insert()

    await register_fcm_token(FCMTokenRequest(token="ExponentPushToken[phone]"), new)
    assert (await User.get(new.id)).fcm_tokens == ["ExponentPushToken[phone]"]
    assert (await User.get(old.id)).fcm_tokens == ["ExponentPushToken[ipad]"]

    # registering again is a no-op; signing out removes it
    await register_fcm_token(FCMTokenRequest(token="ExponentPushToken[phone]"), await User.get(new.id))
    assert (await User.get(new.id)).fcm_tokens == ["ExponentPushToken[phone]"]
    await unregister_fcm_token(FCMTokenRequest(token="ExponentPushToken[phone]"), await User.get(new.id))
    assert (await User.get(new.id)).fcm_tokens == []
