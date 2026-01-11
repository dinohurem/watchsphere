from typing import Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from datetime import datetime
from beanie import PydanticObjectId

from app.core.deps import get_current_user
from app.models.user import User
from app.models.watch import Watch, WatchStatus, WatchCondition

router = APIRouter()


# Pydantic schemas
class InventoryItemResponse(BaseModel):
    id: str
    brand: str
    model: str
    reference: Optional[str] = None
    price: float
    currency: str
    condition: str
    year: Optional[int] = None
    description: Optional[str] = None
    cover_image: Optional[str] = None
    status: str
    views: int = 0
    created_at: datetime
    updated_at: Optional[datetime] = None


class CreateInventoryItemRequest(BaseModel):
    brand: str
    model: str
    reference: Optional[str] = None
    price: float
    currency: str = "USD"
    condition: WatchCondition
    year: Optional[int] = None
    description: Optional[str] = None
    images: List[str] = []


class UpdateInventoryItemRequest(BaseModel):
    brand: Optional[str] = None
    model: Optional[str] = None
    reference: Optional[str] = None
    price: Optional[float] = None
    currency: Optional[str] = None
    condition: Optional[WatchCondition] = None
    year: Optional[int] = None
    description: Optional[str] = None
    status: Optional[WatchStatus] = None


@router.get("", response_model=List[InventoryItemResponse])
async def list_inventory(
    current_user: User = Depends(get_current_user),
    status_filter: Optional[WatchStatus] = None,
    skip: int = 0,
    limit: int = 50,
) -> Any:
    """List all watches in the current user's inventory"""

    query = {"dealer_id": str(current_user.id)}

    if status_filter:
        query["status"] = status_filter.value

    watches = await Watch.find(query).sort([("created_at", -1)]).skip(skip).limit(limit).to_list()

    return [
        {
            "id": str(w.id),
            "brand": w.brand,
            "model": w.model,
            "reference": w.reference,
            "price": w.price,
            "currency": w.currency,
            "condition": w.condition.value if w.condition else None,
            "year": w.year,
            "description": w.description,
            "cover_image": w.cover_image,
            "status": w.status.value,
            "views": w.views,
            "created_at": w.created_at,
            "updated_at": w.updated_at,
        }
        for w in watches
    ]


@router.get("/stats")
async def get_inventory_stats(
    current_user: User = Depends(get_current_user),
) -> Any:
    """Get inventory statistics for the current user"""

    total = await Watch.find(Watch.dealer_id == str(current_user.id)).count()
    active = await Watch.find(
        Watch.dealer_id == str(current_user.id),
        Watch.status == WatchStatus.ACTIVE
    ).count()
    draft = await Watch.find(
        Watch.dealer_id == str(current_user.id),
        Watch.status == WatchStatus.DRAFT
    ).count()
    sold = await Watch.find(
        Watch.dealer_id == str(current_user.id),
        Watch.status == WatchStatus.SOLD
    ).count()

    return {
        "total": total,
        "active": active,
        "draft": draft,
        "sold": sold,
    }


@router.get("/{item_id}", response_model=InventoryItemResponse)
async def get_inventory_item(
    item_id: str,
    current_user: User = Depends(get_current_user),
) -> Any:
    """Get a specific inventory item"""

    watch = await Watch.get(PydanticObjectId(item_id))

    if not watch:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Item not found"
        )

    # Check ownership
    if watch.dealer_id != str(current_user.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )

    return {
        "id": str(watch.id),
        "brand": watch.brand,
        "model": watch.model,
        "reference": watch.reference,
        "price": watch.price,
        "currency": watch.currency,
        "condition": watch.condition.value if watch.condition else None,
        "year": watch.year,
        "description": watch.description,
        "cover_image": watch.cover_image,
        "status": watch.status.value,
        "views": watch.views,
        "created_at": watch.created_at,
        "updated_at": watch.updated_at,
    }


@router.post("", response_model=InventoryItemResponse)
async def create_inventory_item(
    request: CreateInventoryItemRequest,
    current_user: User = Depends(get_current_user),
) -> Any:
    """Create a new inventory item"""

    watch = Watch(
        brand=request.brand,
        model=request.model,
        reference=request.reference,
        price=request.price,
        currency=request.currency,
        condition=request.condition,
        year=request.year,
        description=request.description,
        images=request.images,
        cover_image=request.images[0] if request.images else None,
        dealer_id=str(current_user.id),
        dealer_name=current_user.name,
        status=WatchStatus.DRAFT,
        created_at=datetime.utcnow(),
    )
    await watch.insert()

    return {
        "id": str(watch.id),
        "brand": watch.brand,
        "model": watch.model,
        "reference": watch.reference,
        "price": watch.price,
        "currency": watch.currency,
        "condition": watch.condition.value if watch.condition else None,
        "year": watch.year,
        "description": watch.description,
        "cover_image": watch.cover_image,
        "status": watch.status.value,
        "views": watch.views,
        "created_at": watch.created_at,
        "updated_at": watch.updated_at,
    }


@router.patch("/{item_id}", response_model=InventoryItemResponse)
async def update_inventory_item(
    item_id: str,
    request: UpdateInventoryItemRequest,
    current_user: User = Depends(get_current_user),
) -> Any:
    """Update an inventory item"""

    watch = await Watch.get(PydanticObjectId(item_id))

    if not watch:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Item not found"
        )

    # Check ownership
    if watch.dealer_id != str(current_user.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )

    # Update fields
    update_data = request.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(watch, key, value)

    watch.updated_at = datetime.utcnow()
    await watch.save()

    return {
        "id": str(watch.id),
        "brand": watch.brand,
        "model": watch.model,
        "reference": watch.reference,
        "price": watch.price,
        "currency": watch.currency,
        "condition": watch.condition.value if watch.condition else None,
        "year": watch.year,
        "description": watch.description,
        "cover_image": watch.cover_image,
        "status": watch.status.value,
        "views": watch.views,
        "created_at": watch.created_at,
        "updated_at": watch.updated_at,
    }


@router.delete("/{item_id}")
async def delete_inventory_item(
    item_id: str,
    current_user: User = Depends(get_current_user),
) -> Any:
    """Delete an inventory item"""

    watch = await Watch.get(PydanticObjectId(item_id))

    if not watch:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Item not found"
        )

    # Check ownership
    if watch.dealer_id != str(current_user.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )

    await watch.delete()

    return {"message": "Item deleted successfully"}


@router.post("/{item_id}/publish")
async def publish_inventory_item(
    item_id: str,
    current_user: User = Depends(get_current_user),
) -> Any:
    """Publish an inventory item to the market"""

    watch = await Watch.get(PydanticObjectId(item_id))

    if not watch:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Item not found"
        )

    # Check ownership
    if watch.dealer_id != str(current_user.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )

    watch.status = WatchStatus.ACTIVE
    watch.published_at = datetime.utcnow()
    watch.updated_at = datetime.utcnow()
    await watch.save()

    return {"message": "Item published successfully"}


@router.post("/{item_id}/archive")
async def archive_inventory_item(
    item_id: str,
    current_user: User = Depends(get_current_user),
) -> Any:
    """Archive an inventory item"""

    watch = await Watch.get(PydanticObjectId(item_id))

    if not watch:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Item not found"
        )

    # Check ownership
    if watch.dealer_id != str(current_user.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )

    watch.status = WatchStatus.ARCHIVED
    watch.updated_at = datetime.utcnow()
    await watch.save()

    return {"message": "Item archived successfully"}
