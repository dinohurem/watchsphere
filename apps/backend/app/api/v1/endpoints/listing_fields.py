from typing import Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from datetime import datetime
from beanie import PydanticObjectId

from app.core.deps import get_current_admin_user, get_current_active_user
from app.models.user import User
from app.models.listing_field import ListingField, ListingFieldValue, FieldType

router = APIRouter()


# ============== Response Models ==============

class ListingFieldValueResponse(BaseModel):
    value: str
    label: str
    is_enabled: bool
    display_order: int
    parent_value: Optional[str] = None


class ListingFieldResponse(BaseModel):
    id: str
    key: str
    name: str
    description: Optional[str] = None
    field_type: FieldType
    is_enabled: bool
    is_required: bool
    display_order: int
    category: str
    parent_field_key: Optional[str] = None
    placeholder: Optional[str] = None
    min_value: Optional[float] = None
    max_value: Optional[float] = None
    values: List[ListingFieldValueResponse]
    created_at: datetime
    updated_at: Optional[datetime] = None
    created_by_id: Optional[str] = None
    created_by_name: Optional[str] = None


class ListingFieldPublicResponse(BaseModel):
    """Simplified response for public API - only includes enabled fields/values"""
    key: str
    name: str
    field_type: FieldType
    is_required: bool
    display_order: int
    category: str
    parent_field_key: Optional[str] = None
    placeholder: Optional[str] = None
    min_value: Optional[float] = None
    max_value: Optional[float] = None
    values: List[ListingFieldValueResponse]


# ============== Request Models ==============

class ListingFieldValueCreate(BaseModel):
    value: str
    label: str
    is_enabled: bool = True
    display_order: int = 0
    parent_value: Optional[str] = None


class ListingFieldCreate(BaseModel):
    key: str
    name: str
    description: Optional[str] = None
    field_type: FieldType = FieldType.DROPDOWN
    is_enabled: bool = True
    is_required: bool = False
    display_order: int = 0
    category: str = "basic"
    parent_field_key: Optional[str] = None
    placeholder: Optional[str] = None
    min_value: Optional[float] = None
    max_value: Optional[float] = None
    values: List[ListingFieldValueCreate] = []


class ListingFieldUpdate(BaseModel):
    key: Optional[str] = None
    name: Optional[str] = None
    description: Optional[str] = None
    field_type: Optional[FieldType] = None
    is_enabled: Optional[bool] = None
    is_required: Optional[bool] = None
    display_order: Optional[int] = None
    category: Optional[str] = None
    parent_field_key: Optional[str] = None
    placeholder: Optional[str] = None
    min_value: Optional[float] = None
    max_value: Optional[float] = None
    values: Optional[List[ListingFieldValueCreate]] = None


class ListingFieldValueUpdate(BaseModel):
    value: Optional[str] = None
    label: Optional[str] = None
    is_enabled: Optional[bool] = None
    display_order: Optional[int] = None
    parent_value: Optional[str] = None


# ============== Helper Functions ==============

def field_to_response(field: ListingField) -> dict:
    """Convert ListingField to response dict"""
    return {
        "id": str(field.id),
        "key": field.key,
        "name": field.name,
        "description": field.description,
        "field_type": field.field_type,
        "is_enabled": field.is_enabled,
        "is_required": field.is_required,
        "display_order": field.display_order,
        "category": field.category,
        "parent_field_key": field.parent_field_key,
        "placeholder": field.placeholder,
        "min_value": field.min_value,
        "max_value": field.max_value,
        "values": [
            {
                "value": v.value,
                "label": v.label,
                "is_enabled": v.is_enabled,
                "display_order": v.display_order,
                "parent_value": v.parent_value,
            }
            for v in field.values
        ],
        "created_at": field.created_at,
        "updated_at": field.updated_at,
        "created_by_id": field.created_by_id,
        "created_by_name": field.created_by_name,
    }


def field_to_public_response(field: ListingField) -> dict:
    """Convert ListingField to public response dict (only enabled values)"""
    return {
        "key": field.key,
        "name": field.name,
        "field_type": field.field_type,
        "is_required": field.is_required,
        "display_order": field.display_order,
        "category": field.category,
        "parent_field_key": field.parent_field_key,
        "placeholder": field.placeholder,
        "min_value": field.min_value,
        "max_value": field.max_value,
        "values": [
            {
                "value": v.value,
                "label": v.label,
                "is_enabled": v.is_enabled,
                "display_order": v.display_order,
                "parent_value": v.parent_value,
            }
            for v in sorted(field.values, key=lambda x: x.display_order)
            if v.is_enabled
        ],
    }


# ============== PUBLIC ENDPOINTS ==============

@router.get("", response_model=List[ListingFieldPublicResponse])
async def get_listing_fields(
    category: Optional[str] = None,
) -> Any:
    """Get all enabled listing fields with enabled values (Public)"""

    query = {"is_enabled": True}
    if category:
        query["category"] = category

    fields = await ListingField.find(query).sort([("display_order", 1)]).to_list()

    return [field_to_public_response(field) for field in fields]


# ============== ADMIN ENDPOINTS ==============

@router.get("/admin", response_model=List[ListingFieldResponse])
async def admin_list_listing_fields(
    current_admin: User = Depends(get_current_admin_user),
    category: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
) -> Any:
    """List all listing fields (Admin only)"""

    query = {}
    if category:
        query["category"] = category

    fields = await ListingField.find(query).sort([("category", 1), ("display_order", 1)]).skip(skip).limit(limit).to_list()

    return [field_to_response(field) for field in fields]


@router.get("/admin/{field_id}", response_model=ListingFieldResponse)
async def admin_get_listing_field(
    field_id: str,
    current_admin: User = Depends(get_current_admin_user),
) -> Any:
    """Get a listing field by ID (Admin only)"""

    field = await ListingField.get(PydanticObjectId(field_id))

    if not field:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Listing field not found"
        )

    return field_to_response(field)


@router.post("/admin", response_model=ListingFieldResponse)
async def admin_create_listing_field(
    field_data: ListingFieldCreate,
    current_admin: User = Depends(get_current_admin_user),
) -> Any:
    """Create a new listing field (Admin only)"""

    # Check for duplicate key
    existing = await ListingField.find_one({"key": field_data.key})
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Listing field with key '{field_data.key}' already exists"
        )

    field = ListingField(
        key=field_data.key,
        name=field_data.name,
        description=field_data.description,
        field_type=field_data.field_type,
        is_enabled=field_data.is_enabled,
        is_required=field_data.is_required,
        display_order=field_data.display_order,
        category=field_data.category,
        parent_field_key=field_data.parent_field_key,
        placeholder=field_data.placeholder,
        min_value=field_data.min_value,
        max_value=field_data.max_value,
        values=[
            ListingFieldValue(
                value=v.value,
                label=v.label,
                is_enabled=v.is_enabled,
                display_order=v.display_order,
                parent_value=v.parent_value,
            )
            for v in field_data.values
        ],
        created_by_id=str(current_admin.id),
        created_by_name=current_admin.name,
    )

    await field.insert()

    return field_to_response(field)


@router.patch("/admin/{field_id}", response_model=ListingFieldResponse)
async def admin_update_listing_field(
    field_id: str,
    field_update: ListingFieldUpdate,
    current_admin: User = Depends(get_current_admin_user),
) -> Any:
    """Update a listing field (Admin only)"""

    field = await ListingField.get(PydanticObjectId(field_id))

    if not field:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Listing field not found"
        )

    # Check for duplicate key if key is being changed
    if field_update.key and field_update.key != field.key:
        existing = await ListingField.find_one({"key": field_update.key})
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Listing field with key '{field_update.key}' already exists"
            )

    # Update fields if provided
    update_data = field_update.model_dump(exclude_unset=True)

    # Handle values separately
    if "values" in update_data:
        field.values = [
            ListingFieldValue(
                value=v["value"],
                label=v["label"],
                is_enabled=v.get("is_enabled", True),
                display_order=v.get("display_order", 0),
                parent_value=v.get("parent_value"),
            )
            for v in update_data.pop("values")
        ]

    for key, value in update_data.items():
        setattr(field, key, value)

    field.updated_at = datetime.utcnow()
    await field.save()

    return field_to_response(field)


@router.delete("/admin/{field_id}")
async def admin_delete_listing_field(
    field_id: str,
    current_admin: User = Depends(get_current_admin_user),
) -> Any:
    """Delete a listing field (Admin only)"""

    field = await ListingField.get(PydanticObjectId(field_id))

    if not field:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Listing field not found"
        )

    await field.delete()

    return {"message": "Listing field deleted successfully"}


@router.post("/admin/{field_id}/toggle-enabled")
async def admin_toggle_listing_field(
    field_id: str,
    current_admin: User = Depends(get_current_admin_user),
) -> Any:
    """Toggle enabled status of a listing field (Admin only)"""

    field = await ListingField.get(PydanticObjectId(field_id))

    if not field:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Listing field not found"
        )

    field.is_enabled = not field.is_enabled
    field.updated_at = datetime.utcnow()
    await field.save()

    return {
        "message": f"Field {'enabled' if field.is_enabled else 'disabled'} successfully",
        "is_enabled": field.is_enabled
    }


@router.post("/admin/{field_id}/values", response_model=ListingFieldResponse)
async def admin_add_field_value(
    field_id: str,
    value_data: ListingFieldValueCreate,
    current_admin: User = Depends(get_current_admin_user),
) -> Any:
    """Add a value to a listing field (Admin only)"""

    field = await ListingField.get(PydanticObjectId(field_id))

    if not field:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Listing field not found"
        )

    # Check for duplicate value
    if any(v.value == value_data.value for v in field.values):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Value '{value_data.value}' already exists in this field"
        )

    field.values.append(
        ListingFieldValue(
            value=value_data.value,
            label=value_data.label,
            is_enabled=value_data.is_enabled,
            display_order=value_data.display_order,
            parent_value=value_data.parent_value,
        )
    )

    field.updated_at = datetime.utcnow()
    await field.save()

    return field_to_response(field)


@router.patch("/admin/{field_id}/values/{value_index}", response_model=ListingFieldResponse)
async def admin_update_field_value(
    field_id: str,
    value_index: int,
    value_update: ListingFieldValueUpdate,
    current_admin: User = Depends(get_current_admin_user),
) -> Any:
    """Update a specific value in a listing field (Admin only)"""

    field = await ListingField.get(PydanticObjectId(field_id))

    if not field:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Listing field not found"
        )

    if value_index < 0 or value_index >= len(field.values):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid value index"
        )

    # Update value fields
    update_data = value_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(field.values[value_index], key, value)

    field.updated_at = datetime.utcnow()
    await field.save()

    return field_to_response(field)


@router.delete("/admin/{field_id}/values/{value_index}", response_model=ListingFieldResponse)
async def admin_delete_field_value(
    field_id: str,
    value_index: int,
    current_admin: User = Depends(get_current_admin_user),
) -> Any:
    """Delete a specific value from a listing field (Admin only)"""

    field = await ListingField.get(PydanticObjectId(field_id))

    if not field:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Listing field not found"
        )

    if value_index < 0 or value_index >= len(field.values):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid value index"
        )

    field.values.pop(value_index)
    field.updated_at = datetime.utcnow()
    await field.save()

    return field_to_response(field)


@router.post("/admin/{field_id}/values/{value_index}/toggle-enabled")
async def admin_toggle_field_value(
    field_id: str,
    value_index: int,
    current_admin: User = Depends(get_current_admin_user),
) -> Any:
    """Toggle enabled status of a specific value (Admin only)"""

    field = await ListingField.get(PydanticObjectId(field_id))

    if not field:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Listing field not found"
        )

    if value_index < 0 or value_index >= len(field.values):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid value index"
        )

    field.values[value_index].is_enabled = not field.values[value_index].is_enabled
    field.updated_at = datetime.utcnow()
    await field.save()

    return {
        "message": f"Value {'enabled' if field.values[value_index].is_enabled else 'disabled'} successfully",
        "is_enabled": field.values[value_index].is_enabled
    }


@router.get("/admin/stats/summary")
async def admin_listing_fields_stats(
    current_admin: User = Depends(get_current_admin_user),
) -> Any:
    """Get listing fields statistics (Admin only)"""

    all_fields = await ListingField.find_all().to_list()

    # Count by category
    categories = {}
    for field in all_fields:
        categories[field.category] = categories.get(field.category, 0) + 1

    # Count values
    total_values = sum(len(field.values) for field in all_fields)
    enabled_values = sum(
        len([v for v in field.values if v.is_enabled])
        for field in all_fields
    )

    return {
        "total_fields": len(all_fields),
        "enabled_fields": len([f for f in all_fields if f.is_enabled]),
        "disabled_fields": len([f for f in all_fields if not f.is_enabled]),
        "categories": categories,
        "total_values": total_values,
        "enabled_values": enabled_values,
    }
