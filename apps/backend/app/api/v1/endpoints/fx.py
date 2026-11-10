"""Exchange rates (generator spec §8).

``GET /fx/rates`` is public (no auth, also allowed for unapproved users): the app
converts every price into the user's currency with this one table.
"""
from typing import Any

from fastapi import APIRouter, Depends

from app.core.deps import get_current_admin_user
from app.core.market_constants import APP_CURRENCIES, SUPPORTED_CURRENCIES
from app.core.pipeline_auth import require_pipeline_key
from app.models.user import User
from app.services import fx

router = APIRouter()


@router.get("/rates")
async def get_rates() -> Any:
    rates = await fx.load_rates()
    updated_at = await fx.rates_updated_at()
    return {
        "base": "USD",
        "rates": {c: rates[c] for c in SUPPORTED_CURRENCIES if c in rates},
        "currencies": APP_CURRENCIES,
        "updated_at": updated_at.isoformat() if updated_at else None,
    }


@router.post("/refresh")
async def refresh_rates_cron(_key: str = Depends(require_pipeline_key)) -> Any:
    """Daily cron: refresh from the ECB, recompute every order's usd_price and the
    market stats. Authenticated with X-Pipeline-Key."""
    return await fx.refresh_and_recompute()


@router.post("/admin/refresh")
async def refresh_rates_admin(current_admin: User = Depends(get_current_admin_user)) -> Any:
    return await fx.refresh_and_recompute()
