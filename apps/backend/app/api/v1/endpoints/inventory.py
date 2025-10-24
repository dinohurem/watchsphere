from typing import Any, List
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.deps import get_db, get_current_active_user
from app.models.user import User
from app.models.watch import Watch
from app.api.v1.endpoints.market import WatchResponse

router = APIRouter()


@router.get("/", response_model=List[WatchResponse])
def get_my_inventory(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
) -> Any:
    """Get current user's watch inventory"""
    watches = db.query(Watch).filter(Watch.dealer_id == current_user.id).all()
    return watches


@router.get("/stats")
def get_inventory_stats(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
) -> Any:
    """Get inventory statistics"""
    watches = db.query(Watch).filter(Watch.dealer_id == current_user.id).all()

    total_value = sum(w.price for w in watches)
    total_count = len(watches)

    return {
        "total_watches": total_count,
        "total_value": total_value,
        "currency": "USD",
        "by_condition": {
            "new": len([w for w in watches if w.condition == "new"]),
            "excellent": len([w for w in watches if w.condition == "excellent"]),
            "good": len([w for w in watches if w.condition == "good"]),
            "fair": len([w for w in watches if w.condition == "fair"]),
        },
    }
