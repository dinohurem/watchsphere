from beanie import Document
from pydantic import Field, BaseModel
from datetime import datetime
from enum import Enum
from typing import Optional, List


class FieldType(str, Enum):
    DROPDOWN = "dropdown"
    TEXT = "text"
    NUMBER = "number"
    MULTI_SELECT = "multi_select"
    TEXTAREA = "textarea"


class ListingFieldValue(BaseModel):
    """A single option value for a dropdown/multi-select field"""
    value: str
    label: str
    is_enabled: bool = True
    display_order: int = 0
    # For dependent fields (e.g., model depends on brand)
    parent_value: Optional[str] = None


class ListingField(Document):
    """
    Configuration for listing fields that can be managed by admin.
    This allows dynamic control over which fields and values are available
    when creating a listing on mobile/web.
    """
    # Identification
    key: str = Field(..., index=True)  # Unique key like "brand", "model", "case_material"
    name: str  # Display name like "Brand", "Model", "Case Material"
    description: Optional[str] = None

    # Configuration
    field_type: FieldType = FieldType.DROPDOWN
    is_enabled: bool = True
    is_required: bool = False
    display_order: int = 0

    # For dropdown/multi-select fields
    values: List[ListingFieldValue] = Field(default_factory=list)

    # For dependent fields (e.g., "brand" for model field)
    parent_field_key: Optional[str] = None

    # Categorization (for grouping in admin UI and listing form)
    # Categories: basic, caliber, case, bracelet
    category: str = "basic"

    # Placeholder text for text/number inputs
    placeholder: Optional[str] = None

    # For number fields
    min_value: Optional[float] = None
    max_value: Optional[float] = None

    # Audit
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: Optional[datetime] = None
    created_by_id: Optional[str] = None
    created_by_name: Optional[str] = None

    class Settings:
        name = "listing_fields"
        indexes = [
            "key",
            "category",
            "is_enabled",
            "display_order",
        ]

    class Config:
        json_schema_extra = {
            "example": {
                "key": "brand",
                "name": "Brand",
                "description": "Watch brand/manufacturer",
                "field_type": "dropdown",
                "is_enabled": True,
                "is_required": True,
                "display_order": 1,
                "category": "basic",
                "values": [
                    {"value": "rolex", "label": "Rolex", "is_enabled": True, "display_order": 1},
                    {"value": "patek_philippe", "label": "Patek Philippe", "is_enabled": True, "display_order": 2},
                ]
            }
        }
