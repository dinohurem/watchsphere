"""Decisions on one order's price (approval page, tab "Suspicious prices").

One implementation for the click, the bulk action and the decision file."""
from datetime import datetime
from typing import Optional

from fastapi import HTTPException

from app.models.order import Order, OrderStatus
from app.services import fx
from app.services import market_stats as ms

PRICE_DECISIONS = ("approve", "reject", "fix_currency", "correct_price")


def parse_price(value) -> Optional[float]:
    """"11.500", "11,500.50", "11500" -> float; None when it is not a positive number."""
    s = str(value or "").strip().replace(" ", "")
    if not s:
        return None
    if "," in s and "." in s:
        s = s.replace(".", "").replace(",", ".") if s.rfind(",") > s.rfind(".") else s.replace(",", "")
    elif "," in s:
        s = s.replace(",", ".") if len(s.split(",")[-1]) != 3 else s.replace(",", "")
    elif s.count(".") > 1 or (s.count(".") == 1 and len(s.split(".")[-1]) == 3):
        s = s.replace(".", "")
    try:
        v = float(s)
    except ValueError:
        return None
    return v if v > 0 else None


async def apply_price_action(order: Order, action: str, value=None, rates: Optional[dict] = None) -> None:
    """Changes and saves the order (never deletes: reject is the caller's job, it archives
    first). ``value`` "suggested" takes the currency / price the flag suggested. A held offer
    that gets any of the three decisions becomes visible and is never flagged again.
    Raises HTTPException(400) for bad input; the caller refreshes the stats."""
    if rates is None:
        rates = await fx.load_rates()
    flag = order.price_flag or {}
    was_held = order.status == OrderStatus.HELD
    if action == "approve":
        order.price_approved = True
    elif action == "fix_currency":
        if str(value or "").strip().lower() == "suggested":
            value = flag.get("suggested_currency")
            if not value:
                raise HTTPException(status_code=400, detail="No suggested currency for this offer")
        cur = fx.normalize_currency(str(value or ""))
        if not cur or cur not in rates:
            raise HTTPException(status_code=400, detail=f"Unknown currency '{value}'")
        order.currency = cur
        order.usd_price = await fx.to_usd(order.price, cur)
    elif action == "correct_price":
        if str(value or "").strip().lower() == "suggested":
            value = flag.get("suggested_price")
            if not value:
                raise HTTPException(status_code=400, detail="No suggested price for this offer")
        price = value if isinstance(value, (int, float)) else parse_price(value)
        if not price or price <= 0:
            raise HTTPException(status_code=400, detail="Price must be a positive number")
        order.price = float(price)
        order.usd_price = await fx.to_usd(order.price, order.currency)
    else:
        raise HTTPException(status_code=400, detail="Unknown action")
    if was_held:
        order.status = OrderStatus.ACTIVE
        order.price_flag = None
        order.price_approved = True
    order.updated_at = datetime.utcnow()
    await order.save()


async def refresh_stats(ws_codes) -> None:
    codes = sorted({c for c in ws_codes if c})
    if codes:
        await ms.recompute_for(codes)
