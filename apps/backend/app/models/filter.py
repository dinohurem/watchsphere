from beanie import Document
from pydantic import Field, BaseModel
from datetime import datetime
from enum import Enum
from typing import Optional, List


class FilterCategory(str, Enum):
    MARKET = "market"  # Market/Watch listing filters
    SOCIAL = "social"  # Social search filters
    ORDER_BOOK = "order_book"  # Order book filters


class FilterType(str, Enum):
    MULTI_SELECT = "multi_select"
    SINGLE_SELECT = "single_select"
    RANGE = "range"
    TEXT = "text"
    BOOLEAN = "boolean"


class FilterValue(BaseModel):
    """A single option value for a filter"""
    value: str
    label: str
    is_enabled: bool = True
    display_order: int = 0


class Filter(Document):
    """
    Configuration for filters that can be managed by admin.
    This allows dynamic control over which filters and values are available
    on market search, social search, and order book pages.
    """
    # Identification
    key: str = Field(..., index=True)  # Unique key like "brands", "condition", "offer_type"
    name: str  # Display name like "Brand", "Condition"
    description: Optional[str] = None

    # Configuration
    category: FilterCategory = Field(..., index=True)
    filter_type: FilterType = FilterType.MULTI_SELECT
    is_enabled: bool = True
    is_searchable: bool = False  # Shows search box in filter UI
    display_order: int = 0

    # For select-type filters
    values: List[FilterValue] = Field(default_factory=list)

    # UI grouping (for market filters organized by sections)
    # Sections: basic, condition, case_size, watch_type, movement, dial, case, strap, clasp
    ui_section: Optional[str] = None

    # For range filters
    range_min: Optional[float] = None
    range_max: Optional[float] = None
    range_step: Optional[float] = None

    # Placeholder for text filters
    placeholder: Optional[str] = None

    # Audit
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: Optional[datetime] = None
    created_by_id: Optional[str] = None
    created_by_name: Optional[str] = None

    class Settings:
        name = "filters"
        indexes = [
            "key",
            "category",
            "is_enabled",
            "display_order",
        ]

    class Config:
        json_schema_extra = {
            "example": {
                "key": "brands",
                "name": "Brand",
                "description": "Filter by watch brand",
                "category": "market",
                "filter_type": "multi_select",
                "is_enabled": True,
                "is_searchable": True,
                "display_order": 1,
                "ui_section": "basic",
                "values": [
                    {"value": "rolex", "label": "Rolex", "is_enabled": True, "display_order": 1},
                    {"value": "patek_philippe", "label": "Patek Philippe", "is_enabled": True, "display_order": 2},
                ]
            }
        }
