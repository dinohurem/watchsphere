from typing import Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from datetime import datetime
from beanie import PydanticObjectId

from app.core.deps import get_current_admin_user, get_current_active_user
from app.models.user import User
from app.models.filter import Filter, FilterValue, FilterCategory, FilterType

router = APIRouter()


# ============== Response Models ==============

class FilterValueResponse(BaseModel):
    value: str
    label: str
    is_enabled: bool
    display_order: int


class FilterResponse(BaseModel):
    id: str
    key: str
    name: str
    description: Optional[str] = None
    category: FilterCategory
    filter_type: FilterType
    is_enabled: bool
    is_searchable: bool
    display_order: int
    ui_section: Optional[str] = None
    range_min: Optional[float] = None
    range_max: Optional[float] = None
    range_step: Optional[float] = None
    placeholder: Optional[str] = None
    values: List[FilterValueResponse]
    created_at: datetime
    updated_at: Optional[datetime] = None
    created_by_id: Optional[str] = None
    created_by_name: Optional[str] = None


class FilterPublicResponse(BaseModel):
    """Simplified response for public API - only includes enabled filters/values"""
    key: str
    name: str
    filter_type: FilterType
    is_searchable: bool
    display_order: int
    ui_section: Optional[str] = None
    range_min: Optional[float] = None
    range_max: Optional[float] = None
    range_step: Optional[float] = None
    placeholder: Optional[str] = None
    values: List[FilterValueResponse]


# ============== Request Models ==============

class FilterValueCreate(BaseModel):
    value: str
    label: str
    is_enabled: bool = True
    display_order: int = 0


class FilterCreate(BaseModel):
    key: str
    name: str
    description: Optional[str] = None
    category: FilterCategory
    filter_type: FilterType = FilterType.MULTI_SELECT
    is_enabled: bool = True
    is_searchable: bool = False
    display_order: int = 0
    ui_section: Optional[str] = None
    range_min: Optional[float] = None
    range_max: Optional[float] = None
    range_step: Optional[float] = None
    placeholder: Optional[str] = None
    values: List[FilterValueCreate] = []


class FilterUpdate(BaseModel):
    key: Optional[str] = None
    name: Optional[str] = None
    description: Optional[str] = None
    category: Optional[FilterCategory] = None
    filter_type: Optional[FilterType] = None
    is_enabled: Optional[bool] = None
    is_searchable: Optional[bool] = None
    display_order: Optional[int] = None
    ui_section: Optional[str] = None
    range_min: Optional[float] = None
    range_max: Optional[float] = None
    range_step: Optional[float] = None
    placeholder: Optional[str] = None
    values: Optional[List[FilterValueCreate]] = None


class FilterValueUpdate(BaseModel):
    value: Optional[str] = None
    label: Optional[str] = None
    is_enabled: Optional[bool] = None
    display_order: Optional[int] = None


# ============== Helper Functions ==============

def filter_to_response(f: Filter) -> dict:
    """Convert Filter to response dict"""
    return {
        "id": str(f.id),
        "key": f.key,
        "name": f.name,
        "description": f.description,
        "category": f.category,
        "filter_type": f.filter_type,
        "is_enabled": f.is_enabled,
        "is_searchable": f.is_searchable,
        "display_order": f.display_order,
        "ui_section": f.ui_section,
        "range_min": f.range_min,
        "range_max": f.range_max,
        "range_step": f.range_step,
        "placeholder": f.placeholder,
        "values": [
            {
                "value": v.value,
                "label": v.label,
                "is_enabled": v.is_enabled,
                "display_order": v.display_order,
            }
            for v in f.values
        ],
        "created_at": f.created_at,
        "updated_at": f.updated_at,
        "created_by_id": f.created_by_id,
        "created_by_name": f.created_by_name,
    }


def filter_to_public_response(f: Filter) -> dict:
    """Convert Filter to public response dict (only enabled values)"""
    return {
        "key": f.key,
        "name": f.name,
        "filter_type": f.filter_type,
        "is_searchable": f.is_searchable,
        "display_order": f.display_order,
        "ui_section": f.ui_section,
        "range_min": f.range_min,
        "range_max": f.range_max,
        "range_step": f.range_step,
        "placeholder": f.placeholder,
        "values": [
            {
                "value": v.value,
                "label": v.label,
                "is_enabled": v.is_enabled,
                "display_order": v.display_order,
            }
            for v in sorted(f.values, key=lambda x: x.display_order)
            if v.is_enabled
        ],
    }


# ============== PUBLIC ENDPOINTS ==============

@router.get("/market", response_model=List[FilterPublicResponse])
async def get_market_filters() -> Any:
    """Get all enabled market filters with enabled values (Public)"""

    filters = await Filter.find({
        "category": FilterCategory.MARKET,
        "is_enabled": True
    }).sort([("display_order", 1)]).to_list()

    return [filter_to_public_response(f) for f in filters]


@router.get("/social", response_model=List[FilterPublicResponse])
async def get_social_filters() -> Any:
    """Get all enabled social search filters with enabled values (Public)"""

    filters = await Filter.find({
        "category": FilterCategory.SOCIAL,
        "is_enabled": True
    }).sort([("display_order", 1)]).to_list()

    return [filter_to_public_response(f) for f in filters]


@router.get("/order-book", response_model=List[FilterPublicResponse])
async def get_order_book_filters() -> Any:
    """Get all enabled order book filters with enabled values (Public)"""

    filters = await Filter.find({
        "category": FilterCategory.ORDER_BOOK,
        "is_enabled": True
    }).sort([("display_order", 1)]).to_list()

    return [filter_to_public_response(f) for f in filters]


# ============== ADMIN ENDPOINTS ==============

@router.get("/admin", response_model=List[FilterResponse])
async def admin_list_filters(
    current_admin: User = Depends(get_current_admin_user),
    category: Optional[FilterCategory] = None,
    skip: int = 0,
    limit: int = 100,
) -> Any:
    """List all filters (Admin only)"""

    query = {}
    if category:
        query["category"] = category

    filters = await Filter.find(query).sort([("category", 1), ("display_order", 1)]).skip(skip).limit(limit).to_list()

    return [filter_to_response(f) for f in filters]


@router.get("/admin/{filter_id}", response_model=FilterResponse)
async def admin_get_filter(
    filter_id: str,
    current_admin: User = Depends(get_current_admin_user),
) -> Any:
    """Get a filter by ID (Admin only)"""

    f = await Filter.get(PydanticObjectId(filter_id))

    if not f:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Filter not found"
        )

    return filter_to_response(f)


@router.post("/admin", response_model=FilterResponse)
async def admin_create_filter(
    filter_data: FilterCreate,
    current_admin: User = Depends(get_current_admin_user),
) -> Any:
    """Create a new filter (Admin only)"""

    # Check for duplicate key within category
    existing = await Filter.find_one({
        "key": filter_data.key,
        "category": filter_data.category
    })
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Filter with key '{filter_data.key}' already exists in category '{filter_data.category}'"
        )

    f = Filter(
        key=filter_data.key,
        name=filter_data.name,
        description=filter_data.description,
        category=filter_data.category,
        filter_type=filter_data.filter_type,
        is_enabled=filter_data.is_enabled,
        is_searchable=filter_data.is_searchable,
        display_order=filter_data.display_order,
        ui_section=filter_data.ui_section,
        range_min=filter_data.range_min,
        range_max=filter_data.range_max,
        range_step=filter_data.range_step,
        placeholder=filter_data.placeholder,
        values=[
            FilterValue(
                value=v.value,
                label=v.label,
                is_enabled=v.is_enabled,
                display_order=v.display_order,
            )
            for v in filter_data.values
        ],
        created_by_id=str(current_admin.id),
        created_by_name=current_admin.name,
    )

    await f.insert()

    return filter_to_response(f)


@router.patch("/admin/{filter_id}", response_model=FilterResponse)
async def admin_update_filter(
    filter_id: str,
    filter_update: FilterUpdate,
    current_admin: User = Depends(get_current_admin_user),
) -> Any:
    """Update a filter (Admin only)"""

    f = await Filter.get(PydanticObjectId(filter_id))

    if not f:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Filter not found"
        )

    # Check for duplicate key if key is being changed
    if filter_update.key and filter_update.key != f.key:
        category = filter_update.category or f.category
        existing = await Filter.find_one({
            "key": filter_update.key,
            "category": category
        })
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Filter with key '{filter_update.key}' already exists in category '{category}'"
            )

    # Update fields if provided
    update_data = filter_update.model_dump(exclude_unset=True)

    # Handle values separately
    if "values" in update_data:
        f.values = [
            FilterValue(
                value=v["value"],
                label=v["label"],
                is_enabled=v.get("is_enabled", True),
                display_order=v.get("display_order", 0),
            )
            for v in update_data.pop("values")
        ]

    for key, value in update_data.items():
        setattr(f, key, value)

    f.updated_at = datetime.utcnow()
    await f.save()

    return filter_to_response(f)


@router.delete("/admin/{filter_id}")
async def admin_delete_filter(
    filter_id: str,
    current_admin: User = Depends(get_current_admin_user),
) -> Any:
    """Delete a filter (Admin only)"""

    f = await Filter.get(PydanticObjectId(filter_id))

    if not f:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Filter not found"
        )

    await f.delete()

    return {"message": "Filter deleted successfully"}


@router.post("/admin/{filter_id}/toggle-enabled")
async def admin_toggle_filter(
    filter_id: str,
    current_admin: User = Depends(get_current_admin_user),
) -> Any:
    """Toggle enabled status of a filter (Admin only)"""

    f = await Filter.get(PydanticObjectId(filter_id))

    if not f:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Filter not found"
        )

    f.is_enabled = not f.is_enabled
    f.updated_at = datetime.utcnow()
    await f.save()

    return {
        "message": f"Filter {'enabled' if f.is_enabled else 'disabled'} successfully",
        "is_enabled": f.is_enabled
    }


@router.post("/admin/{filter_id}/values", response_model=FilterResponse)
async def admin_add_filter_value(
    filter_id: str,
    value_data: FilterValueCreate,
    current_admin: User = Depends(get_current_admin_user),
) -> Any:
    """Add a value to a filter (Admin only)"""

    f = await Filter.get(PydanticObjectId(filter_id))

    if not f:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Filter not found"
        )

    # Check for duplicate value
    if any(v.value == value_data.value for v in f.values):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Value '{value_data.value}' already exists in this filter"
        )

    f.values.append(
        FilterValue(
            value=value_data.value,
            label=value_data.label,
            is_enabled=value_data.is_enabled,
            display_order=value_data.display_order,
        )
    )

    f.updated_at = datetime.utcnow()
    await f.save()

    return filter_to_response(f)


@router.patch("/admin/{filter_id}/values/{value_index}", response_model=FilterResponse)
async def admin_update_filter_value(
    filter_id: str,
    value_index: int,
    value_update: FilterValueUpdate,
    current_admin: User = Depends(get_current_admin_user),
) -> Any:
    """Update a specific value in a filter (Admin only)"""

    f = await Filter.get(PydanticObjectId(filter_id))

    if not f:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Filter not found"
        )

    if value_index < 0 or value_index >= len(f.values):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid value index"
        )

    # Update value fields
    update_data = value_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(f.values[value_index], key, value)

    f.updated_at = datetime.utcnow()
    await f.save()

    return filter_to_response(f)


@router.delete("/admin/{filter_id}/values/{value_index}", response_model=FilterResponse)
async def admin_delete_filter_value(
    filter_id: str,
    value_index: int,
    current_admin: User = Depends(get_current_admin_user),
) -> Any:
    """Delete a specific value from a filter (Admin only)"""

    f = await Filter.get(PydanticObjectId(filter_id))

    if not f:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Filter not found"
        )

    if value_index < 0 or value_index >= len(f.values):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid value index"
        )

    f.values.pop(value_index)
    f.updated_at = datetime.utcnow()
    await f.save()

    return filter_to_response(f)


@router.post("/admin/{filter_id}/values/{value_index}/toggle-enabled")
async def admin_toggle_filter_value(
    filter_id: str,
    value_index: int,
    current_admin: User = Depends(get_current_admin_user),
) -> Any:
    """Toggle enabled status of a specific value (Admin only)"""

    f = await Filter.get(PydanticObjectId(filter_id))

    if not f:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Filter not found"
        )

    if value_index < 0 or value_index >= len(f.values):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid value index"
        )

    f.values[value_index].is_enabled = not f.values[value_index].is_enabled
    f.updated_at = datetime.utcnow()
    await f.save()

    return {
        "message": f"Value {'enabled' if f.values[value_index].is_enabled else 'disabled'} successfully",
        "is_enabled": f.values[value_index].is_enabled
    }


@router.get("/admin/stats/summary")
async def admin_filters_stats(
    current_admin: User = Depends(get_current_admin_user),
) -> Any:
    """Get filters statistics (Admin only)"""

    all_filters = await Filter.find_all().to_list()

    # Count by category
    categories = {}
    for f in all_filters:
        cat = f.category.value
        categories[cat] = categories.get(cat, 0) + 1

    # Count values
    total_values = sum(len(f.values) for f in all_filters)
    enabled_values = sum(
        len([v for v in f.values if v.is_enabled])
        for f in all_filters
    )

    return {
        "total_filters": len(all_filters),
        "enabled_filters": len([f for f in all_filters if f.is_enabled]),
        "disabled_filters": len([f for f in all_filters if not f.is_enabled]),
        "categories": categories,
        "total_values": total_values,
        "enabled_values": enabled_values,
    }
