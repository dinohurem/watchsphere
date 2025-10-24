from typing import Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
import uuid

from app.core.deps import get_db, get_current_active_user
from app.models.user import User
from app.models.watch import Watch, WatchCondition
from pydantic import BaseModel

router = APIRouter()


# Pydantic schemas
class WatchCreate(BaseModel):
    brand: str
    model: str
    price: float
    currency: str = "USD"
    condition: WatchCondition
    year: Optional[int] = None
    serial_number: Optional[str] = None
    description: Optional[str] = None


class DealerInfo(BaseModel):
    id: str
    name: str
    verified: bool

    class Config:
        from_attributes = True


class WatchResponse(BaseModel):
    id: str
    brand: str
    model: str
    price: float
    currency: str
    condition: WatchCondition
    year: Optional[int]
    serial_number: Optional[str]
    description: Optional[str]
    dealer: DealerInfo

    class Config:
        from_attributes = True


@router.get("/", response_model=List[WatchResponse])
def list_watches(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    brand: Optional[str] = None,
    min_price: Optional[float] = None,
    max_price: Optional[float] = None,
    condition: Optional[WatchCondition] = None,
    db: Session = Depends(get_db),
) -> Any:
    """List all watches with optional filters"""
    query = db.query(Watch)

    if brand:
        query = query.filter(Watch.brand.ilike(f"%{brand}%"))
    if min_price:
        query = query.filter(Watch.price >= min_price)
    if max_price:
        query = query.filter(Watch.price <= max_price)
    if condition:
        query = query.filter(Watch.condition == condition)

    watches = query.offset(skip).limit(limit).all()
    return watches


@router.post("/", response_model=WatchResponse, status_code=201)
def create_watch(
    watch_in: WatchCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
) -> Any:
    """Create a new watch listing"""
    watch = Watch(
        id=str(uuid.uuid4()),
        **watch_in.dict(),
        dealer_id=current_user.id,
    )
    db.add(watch)
    db.commit()
    db.refresh(watch)
    return watch


@router.get("/{watch_id}", response_model=WatchResponse)
def get_watch(watch_id: str, db: Session = Depends(get_db)) -> Any:
    """Get watch by ID"""
    watch = db.query(Watch).filter(Watch.id == watch_id).first()
    if not watch:
        raise HTTPException(status_code=404, detail="Watch not found")
    return watch


@router.put("/{watch_id}", response_model=WatchResponse)
def update_watch(
    watch_id: str,
    watch_in: WatchCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
) -> Any:
    """Update watch listing"""
    watch = db.query(Watch).filter(Watch.id == watch_id).first()
    if not watch:
        raise HTTPException(status_code=404, detail="Watch not found")

    if watch.dealer_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    for field, value in watch_in.dict().items():
        setattr(watch, field, value)

    db.commit()
    db.refresh(watch)
    return watch


@router.delete("/{watch_id}")
def delete_watch(
    watch_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
) -> Any:
    """Delete watch listing"""
    watch = db.query(Watch).filter(Watch.id == watch_id).first()
    if not watch:
        raise HTTPException(status_code=404, detail="Watch not found")

    if watch.dealer_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    db.delete(watch)
    db.commit()
    return {"message": "Watch deleted successfully"}
