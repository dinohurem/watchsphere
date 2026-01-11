#!/usr/bin/env python3
"""
Seed script for listing fields and filters.
Run this to populate initial data for the dynamic configuration system.
"""

import asyncio
import sys
import os

# Add the parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from motor.motor_asyncio import AsyncIOMotorClient
from beanie import init_beanie
from app.core.config import settings
from app.models.listing_field import ListingField, ListingFieldValue, FieldType
from app.models.filter import Filter, FilterValue, FilterCategory, FilterType


# ============== LISTING FIELDS DATA ==============

LISTING_FIELDS_DATA = [
    # === BASIC CATEGORY ===
    {
        "key": "brand",
        "name": "Brand",
        "description": "Watch brand/manufacturer",
        "field_type": FieldType.DROPDOWN,
        "is_enabled": True,
        "is_required": True,
        "display_order": 1,
        "category": "basic",
        "placeholder": "e.g. Rolex",
        "values": [
            {"value": "rolex", "label": "Rolex"},
            {"value": "patek_philippe", "label": "Patek Philippe"},
            {"value": "audemars_piguet", "label": "Audemars Piguet"},
            {"value": "omega", "label": "Omega"},
            {"value": "cartier", "label": "Cartier"},
            {"value": "iwc", "label": "IWC"},
            {"value": "jaeger_lecoultre", "label": "Jaeger-LeCoultre"},
            {"value": "vacheron_constantin", "label": "Vacheron Constantin"},
        ]
    },
    {
        "key": "model",
        "name": "Model",
        "description": "Watch model",
        "field_type": FieldType.DROPDOWN,
        "is_enabled": True,
        "is_required": True,
        "display_order": 2,
        "category": "basic",
        "parent_field_key": "brand",
        "placeholder": "e.g. Submariner Date",
        "values": [
            # Rolex models
            {"value": "submariner", "label": "Submariner", "parent_value": "rolex"},
            {"value": "submariner_date", "label": "Submariner Date", "parent_value": "rolex"},
            {"value": "gmt_master_ii", "label": "GMT-Master II", "parent_value": "rolex"},
            {"value": "daytona", "label": "Daytona", "parent_value": "rolex"},
            {"value": "datejust", "label": "Datejust", "parent_value": "rolex"},
            {"value": "day_date", "label": "Day-Date", "parent_value": "rolex"},
            {"value": "explorer", "label": "Explorer", "parent_value": "rolex"},
            {"value": "sea_dweller", "label": "Sea-Dweller", "parent_value": "rolex"},
            # Patek Philippe models
            {"value": "nautilus", "label": "Nautilus", "parent_value": "patek_philippe"},
            {"value": "aquanaut", "label": "Aquanaut", "parent_value": "patek_philippe"},
            {"value": "calatrava", "label": "Calatrava", "parent_value": "patek_philippe"},
            {"value": "grand_complications", "label": "Grand Complications", "parent_value": "patek_philippe"},
            {"value": "gondolo", "label": "Gondolo", "parent_value": "patek_philippe"},
            # Audemars Piguet models
            {"value": "royal_oak", "label": "Royal Oak", "parent_value": "audemars_piguet"},
            {"value": "royal_oak_offshore", "label": "Royal Oak Offshore", "parent_value": "audemars_piguet"},
            {"value": "royal_oak_concept", "label": "Royal Oak Concept", "parent_value": "audemars_piguet"},
            {"value": "code_1159", "label": "Code 11.59", "parent_value": "audemars_piguet"},
            {"value": "millenary", "label": "Millenary", "parent_value": "audemars_piguet"},
            # Omega models
            {"value": "speedmaster", "label": "Speedmaster", "parent_value": "omega"},
            {"value": "seamaster", "label": "Seamaster", "parent_value": "omega"},
            {"value": "constellation", "label": "Constellation", "parent_value": "omega"},
            {"value": "de_ville", "label": "De Ville", "parent_value": "omega"},
        ]
    },
    {
        "key": "reference",
        "name": "Reference",
        "description": "Reference number",
        "field_type": FieldType.TEXT,
        "is_enabled": True,
        "is_required": False,
        "display_order": 3,
        "category": "basic",
        "placeholder": "e.g., 126610LN",
        "values": []
    },
    {
        "key": "year",
        "name": "Year",
        "description": "Year of manufacture",
        "field_type": FieldType.NUMBER,
        "is_enabled": True,
        "is_required": False,
        "display_order": 4,
        "category": "basic",
        "placeholder": "e.g., 2024",
        "min_value": 1900,
        "max_value": 2030,
        "values": []
    },
    {
        "key": "size",
        "name": "Size",
        "description": "Case size",
        "field_type": FieldType.TEXT,
        "is_enabled": True,
        "is_required": False,
        "display_order": 5,
        "category": "basic",
        "placeholder": "e.g., 41mm",
        "values": []
    },
    {
        "key": "movement",
        "name": "Movement",
        "description": "Type of movement",
        "field_type": FieldType.DROPDOWN,
        "is_enabled": True,
        "is_required": False,
        "display_order": 6,
        "category": "basic",
        "values": [
            {"value": "automatic", "label": "Automatic"},
            {"value": "manual", "label": "Manual"},
            {"value": "quartz", "label": "Quartz"},
        ]
    },
    {
        "key": "case_material",
        "name": "Case Material",
        "description": "Material of the case",
        "field_type": FieldType.DROPDOWN,
        "is_enabled": True,
        "is_required": False,
        "display_order": 7,
        "category": "basic",
        "values": [
            {"value": "stainless_steel", "label": "Stainless Steel"},
            {"value": "yellow_gold", "label": "Yellow Gold"},
            {"value": "rose_gold", "label": "Rose Gold"},
            {"value": "white_gold", "label": "White Gold"},
            {"value": "platinum", "label": "Platinum"},
            {"value": "titanium", "label": "Titanium"},
            {"value": "ceramic", "label": "Ceramic"},
        ]
    },
    {
        "key": "bracelet_material",
        "name": "Bracelet Material",
        "description": "Material of the bracelet",
        "field_type": FieldType.DROPDOWN,
        "is_enabled": True,
        "is_required": False,
        "display_order": 8,
        "category": "basic",
        "values": [
            {"value": "stainless_steel", "label": "Stainless Steel"},
            {"value": "yellow_gold", "label": "Yellow Gold"},
            {"value": "rose_gold", "label": "Rose Gold"},
            {"value": "white_gold", "label": "White Gold"},
            {"value": "leather", "label": "Leather"},
            {"value": "rubber", "label": "Rubber"},
            {"value": "nato_strap", "label": "NATO Strap"},
        ]
    },
    {
        "key": "condition",
        "name": "Condition",
        "description": "Overall condition of the watch",
        "field_type": FieldType.DROPDOWN,
        "is_enabled": True,
        "is_required": True,
        "display_order": 9,
        "category": "basic",
        "values": [
            {"value": "unworn", "label": "Unworn"},
            {"value": "very_good", "label": "Very Good"},
            {"value": "good", "label": "Good"},
            {"value": "fair", "label": "Fair"},
        ]
    },
    {
        "key": "condition_description",
        "name": "Condition Description",
        "description": "Detailed condition description",
        "field_type": FieldType.TEXTAREA,
        "is_enabled": True,
        "is_required": False,
        "display_order": 10,
        "category": "basic",
        "placeholder": "Write a short description...",
        "values": []
    },
    {
        "key": "box_papers",
        "name": "Box and Papers",
        "description": "Included accessories",
        "field_type": FieldType.DROPDOWN,
        "is_enabled": True,
        "is_required": False,
        "display_order": 11,
        "category": "basic",
        "values": [
            {"value": "box_and_papers", "label": "Box and Papers"},
            {"value": "box_only", "label": "Box Only"},
            {"value": "papers_only", "label": "Papers Only"},
            {"value": "none", "label": "None"},
        ]
    },
    {
        "key": "gender",
        "name": "Gender",
        "description": "Target gender",
        "field_type": FieldType.DROPDOWN,
        "is_enabled": True,
        "is_required": False,
        "display_order": 12,
        "category": "basic",
        "values": [
            {"value": "men", "label": "Men"},
            {"value": "women", "label": "Women"},
            {"value": "unisex", "label": "Unisex"},
        ]
    },
    {
        "key": "location",
        "name": "Location",
        "description": "Seller location",
        "field_type": FieldType.DROPDOWN,
        "is_enabled": True,
        "is_required": False,
        "display_order": 13,
        "category": "basic",
        "values": [
            {"value": "us", "label": "United States"},
            {"value": "uk", "label": "United Kingdom"},
            {"value": "de", "label": "Germany"},
            {"value": "it", "label": "Italy"},
            {"value": "fr", "label": "France"},
            {"value": "ch", "label": "Switzerland"},
            {"value": "ae", "label": "UAE"},
            {"value": "jp", "label": "Japan"},
            {"value": "sg", "label": "Singapore"},
        ]
    },
    {
        "key": "price",
        "name": "Price",
        "description": "Asking price",
        "field_type": FieldType.NUMBER,
        "is_enabled": True,
        "is_required": True,
        "display_order": 14,
        "category": "basic",
        "placeholder": "e.g., 12,450",
        "min_value": 0,
        "values": []
    },
    {
        "key": "currency",
        "name": "Currency",
        "description": "Price currency",
        "field_type": FieldType.DROPDOWN,
        "is_enabled": True,
        "is_required": True,
        "display_order": 15,
        "category": "basic",
        "values": [
            {"value": "eur", "label": "EUR"},
            {"value": "usd", "label": "USD"},
            {"value": "gbp", "label": "GBP"},
            {"value": "chf", "label": "CHF"},
        ]
    },
    {
        "key": "availability",
        "name": "Availability",
        "description": "Stock availability",
        "field_type": FieldType.DROPDOWN,
        "is_enabled": True,
        "is_required": False,
        "display_order": 16,
        "category": "basic",
        "values": [
            {"value": "in_stock", "label": "In Stock"},
            {"value": "pre_order", "label": "Pre-order"},
            {"value": "coming_soon", "label": "Coming Soon"},
        ]
    },

    # === CALIBER CATEGORY ===
    {
        "key": "caliber_movement",
        "name": "Caliber/Movement",
        "description": "Movement caliber",
        "field_type": FieldType.TEXT,
        "is_enabled": True,
        "is_required": False,
        "display_order": 1,
        "category": "caliber",
        "placeholder": "e.g. 3235",
        "values": []
    },
    {
        "key": "base_caliber",
        "name": "Base Caliber",
        "description": "Base caliber",
        "field_type": FieldType.TEXT,
        "is_enabled": True,
        "is_required": False,
        "display_order": 2,
        "category": "caliber",
        "placeholder": "e.g., 3235",
        "values": []
    },
    {
        "key": "power_reserve",
        "name": "Power Reserve",
        "description": "Power reserve duration",
        "field_type": FieldType.TEXT,
        "is_enabled": True,
        "is_required": False,
        "display_order": 3,
        "category": "caliber",
        "placeholder": "e.g. 70h",
        "values": []
    },
    {
        "key": "number_of_jewels",
        "name": "Number of Jewels",
        "description": "Number of jewels in the movement",
        "field_type": FieldType.NUMBER,
        "is_enabled": True,
        "is_required": False,
        "display_order": 4,
        "category": "caliber",
        "placeholder": "e.g. 20",
        "min_value": 0,
        "max_value": 100,
        "values": []
    },

    # === CASE CATEGORY ===
    {
        "key": "case_diameter",
        "name": "Case Diameter",
        "description": "Diameter of the case",
        "field_type": FieldType.DROPDOWN,
        "is_enabled": True,
        "is_required": False,
        "display_order": 1,
        "category": "case",
        "values": [
            {"value": "36mm", "label": "36mm"},
            {"value": "38mm", "label": "38mm"},
            {"value": "39mm", "label": "39mm"},
            {"value": "40mm", "label": "40mm"},
            {"value": "41mm", "label": "41mm"},
            {"value": "42mm", "label": "42mm"},
            {"value": "44mm", "label": "44mm"},
            {"value": "46mm", "label": "46mm"},
        ]
    },
    {
        "key": "water_resistance",
        "name": "Water Resistance",
        "description": "Water resistance rating",
        "field_type": FieldType.DROPDOWN,
        "is_enabled": True,
        "is_required": False,
        "display_order": 2,
        "category": "case",
        "values": [
            {"value": "30m", "label": "30m"},
            {"value": "50m", "label": "50m"},
            {"value": "100m", "label": "100m"},
            {"value": "200m", "label": "200m"},
            {"value": "300m", "label": "300m"},
            {"value": "600m", "label": "600m"},
            {"value": "1000m", "label": "1000m"},
        ]
    },
    {
        "key": "bezel_material",
        "name": "Bezel Material",
        "description": "Material of the bezel",
        "field_type": FieldType.DROPDOWN,
        "is_enabled": True,
        "is_required": False,
        "display_order": 3,
        "category": "case",
        "values": [
            {"value": "stainless_steel", "label": "Stainless Steel"},
            {"value": "ceramic", "label": "Ceramic"},
            {"value": "gold", "label": "Gold"},
            {"value": "platinum", "label": "Platinum"},
        ]
    },
    {
        "key": "crystal",
        "name": "Crystal",
        "description": "Type of crystal",
        "field_type": FieldType.DROPDOWN,
        "is_enabled": True,
        "is_required": False,
        "display_order": 4,
        "category": "case",
        "values": [
            {"value": "sapphire", "label": "Sapphire"},
            {"value": "mineral", "label": "Mineral"},
            {"value": "acrylic", "label": "Acrylic"},
        ]
    },
    {
        "key": "dial_color",
        "name": "Dial Color",
        "description": "Color of the dial",
        "field_type": FieldType.DROPDOWN,
        "is_enabled": True,
        "is_required": False,
        "display_order": 5,
        "category": "case",
        "values": [
            {"value": "black", "label": "Black"},
            {"value": "white", "label": "White"},
            {"value": "blue", "label": "Blue"},
            {"value": "green", "label": "Green"},
            {"value": "silver", "label": "Silver"},
            {"value": "grey", "label": "Grey"},
            {"value": "gold", "label": "Gold"},
            {"value": "mother_of_pearl", "label": "Mother of Pearl"},
        ]
    },
    {
        "key": "dial_numbers",
        "name": "Dial Numbers",
        "description": "Type of dial numbers",
        "field_type": FieldType.DROPDOWN,
        "is_enabled": True,
        "is_required": False,
        "display_order": 6,
        "category": "case",
        "values": [
            {"value": "arabic", "label": "Arabic"},
            {"value": "roman", "label": "Roman"},
            {"value": "index", "label": "Index"},
            {"value": "none", "label": "None"},
        ]
    },

    # === BRACELET CATEGORY ===
    {
        "key": "bracelet_color",
        "name": "Bracelet Color",
        "description": "Color of the bracelet",
        "field_type": FieldType.DROPDOWN,
        "is_enabled": True,
        "is_required": False,
        "display_order": 1,
        "category": "bracelet",
        "values": [
            {"value": "silver", "label": "Silver"},
            {"value": "gold", "label": "Gold"},
            {"value": "rose_gold", "label": "Rose Gold"},
            {"value": "black", "label": "Black"},
            {"value": "brown", "label": "Brown"},
            {"value": "blue", "label": "Blue"},
        ]
    },
    {
        "key": "clasp_type",
        "name": "Clasp Type",
        "description": "Type of clasp",
        "field_type": FieldType.DROPDOWN,
        "is_enabled": True,
        "is_required": False,
        "display_order": 2,
        "category": "bracelet",
        "values": [
            {"value": "folding_clasp", "label": "Folding Clasp"},
            {"value": "buckle", "label": "Buckle"},
            {"value": "deployment_clasp", "label": "Deployment Clasp"},
            {"value": "hidden_clasp", "label": "Hidden Clasp"},
        ]
    },
    {
        "key": "clasp_material",
        "name": "Clasp Material",
        "description": "Material of the clasp",
        "field_type": FieldType.DROPDOWN,
        "is_enabled": True,
        "is_required": False,
        "display_order": 3,
        "category": "bracelet",
        "values": [
            {"value": "stainless_steel", "label": "Stainless Steel"},
            {"value": "gold", "label": "Gold"},
            {"value": "titanium", "label": "Titanium"},
        ]
    },
]


# ============== MARKET FILTERS DATA ==============

MARKET_FILTERS_DATA = [
    {
        "key": "brand",
        "name": "Brand",
        "category": FilterCategory.MARKET,
        "filter_type": FilterType.MULTI_SELECT,
        "is_enabled": True,
        "is_searchable": True,
        "display_order": 1,
        "ui_section": "watch",
        "values": [
            {"value": "rolex", "label": "Rolex"},
            {"value": "patek_philippe", "label": "Patek Philippe"},
            {"value": "audemars_piguet", "label": "Audemars Piguet"},
            {"value": "omega", "label": "Omega"},
            {"value": "cartier", "label": "Cartier"},
            {"value": "iwc", "label": "IWC"},
            {"value": "jaeger_lecoultre", "label": "Jaeger-LeCoultre"},
            {"value": "vacheron_constantin", "label": "Vacheron Constantin"},
            {"value": "a_lange_sohne", "label": "A. Lange & Söhne"},
            {"value": "breguet", "label": "Breguet"},
            {"value": "blancpain", "label": "Blancpain"},
            {"value": "girard_perregaux", "label": "Girard-Perregaux"},
            {"value": "richard_mille", "label": "Richard Mille"},
            {"value": "hublot", "label": "Hublot"},
            {"value": "panerai", "label": "Panerai"},
            {"value": "zenith", "label": "Zenith"},
            {"value": "tudor", "label": "Tudor"},
            {"value": "tag_heuer", "label": "TAG Heuer"},
            {"value": "breitling", "label": "Breitling"},
            {"value": "grand_seiko", "label": "Grand Seiko"},
        ]
    },
    {
        "key": "model",
        "name": "Model",
        "category": FilterCategory.MARKET,
        "filter_type": FilterType.MULTI_SELECT,
        "is_enabled": True,
        "is_searchable": True,
        "display_order": 2,
        "ui_section": "watch",
        "values": [
            {"value": "nautilus", "label": "Nautilus"},
            {"value": "royal_oak", "label": "Royal Oak"},
            {"value": "overseas", "label": "Overseas"},
            {"value": "datograph", "label": "Datograph"},
            {"value": "tradition", "label": "Tradition"},
            {"value": "submariner", "label": "Submariner"},
            {"value": "speedmaster", "label": "Speedmaster"},
            {"value": "reverso", "label": "Reverso"},
            {"value": "fifty_fathoms", "label": "Fifty Fathoms"},
            {"value": "1966", "label": "1966"},
            {"value": "rm_011", "label": "RM 011"},
            {"value": "big_bang", "label": "Big Bang"},
            {"value": "portugieser", "label": "Portugieser"},
            {"value": "luminor", "label": "Luminor"},
        ]
    },
    {
        "key": "year",
        "name": "Year",
        "category": FilterCategory.MARKET,
        "filter_type": FilterType.MULTI_SELECT,
        "is_enabled": True,
        "is_searchable": False,
        "display_order": 3,
        "ui_section": "watch",
        "values": [
            {"value": "2024", "label": "2024"},
            {"value": "2023", "label": "2023"},
            {"value": "2022", "label": "2022"},
            {"value": "2021", "label": "2021"},
            {"value": "2020", "label": "2020"},
            {"value": "2019", "label": "2019"},
            {"value": "2018", "label": "2018"},
            {"value": "2017", "label": "2017"},
            {"value": "2016", "label": "2016"},
            {"value": "2015", "label": "2015"},
            {"value": "2010_2014", "label": "2010 - 2014"},
            {"value": "2005_2009", "label": "2005 - 2009"},
            {"value": "2000_2004", "label": "2000 - 2004"},
            {"value": "1990_1999", "label": "1990 - 1999"},
            {"value": "1980_1989", "label": "1980 - 1989"},
            {"value": "before_1980", "label": "Before 1980"},
        ]
    },
    {
        "key": "location",
        "name": "Location",
        "category": FilterCategory.MARKET,
        "filter_type": FilterType.MULTI_SELECT,
        "is_enabled": True,
        "is_searchable": True,
        "display_order": 4,
        "ui_section": "watch",
        "values": [
            {"value": "us", "label": "United States"},
            {"value": "uk", "label": "United Kingdom"},
            {"value": "de", "label": "Germany"},
            {"value": "ch", "label": "Switzerland"},
            {"value": "fr", "label": "France"},
            {"value": "it", "label": "Italy"},
            {"value": "es", "label": "Spain"},
            {"value": "nl", "label": "Netherlands"},
            {"value": "be", "label": "Belgium"},
            {"value": "at", "label": "Austria"},
            {"value": "sg", "label": "Singapore"},
            {"value": "hk", "label": "Hong Kong"},
            {"value": "jp", "label": "Japan"},
            {"value": "ae", "label": "United Arab Emirates"},
            {"value": "ca", "label": "Canada"},
            {"value": "au", "label": "Australia"},
        ]
    },
    {
        "key": "price",
        "name": "Price",
        "category": FilterCategory.MARKET,
        "filter_type": FilterType.MULTI_SELECT,
        "is_enabled": True,
        "is_searchable": False,
        "display_order": 5,
        "ui_section": "price",
        "values": [
            {"value": "under_1000", "label": "Under $1,000"},
            {"value": "1000_5000", "label": "$1,000 - $5,000"},
            {"value": "5000_10000", "label": "$5,000 - $10,000"},
            {"value": "10000_25000", "label": "$10,000 - $25,000"},
            {"value": "25000_50000", "label": "$25,000 - $50,000"},
            {"value": "50000_100000", "label": "$50,000 - $100,000"},
            {"value": "100000_250000", "label": "$100,000 - $250,000"},
            {"value": "250000_500000", "label": "$250,000 - $500,000"},
            {"value": "over_500000", "label": "Over $500,000"},
        ]
    },
    {
        "key": "reference",
        "name": "Reference Number",
        "category": FilterCategory.MARKET,
        "filter_type": FilterType.MULTI_SELECT,
        "is_enabled": True,
        "is_searchable": True,
        "display_order": 6,
        "ui_section": "watch",
        "values": [
            {"value": "5711_1a", "label": "5711/1A"},
            {"value": "15202st", "label": "15202ST"},
            {"value": "4500v", "label": "4500V"},
            {"value": "403_035", "label": "403.035"},
            {"value": "7097bb", "label": "7097BB"},
            {"value": "126610ln", "label": "126610LN"},
            {"value": "310_30_42_50_01_002", "label": "310.30.42.50.01.002"},
            {"value": "q3858520", "label": "Q3858520"},
            {"value": "5000_1110_b52a", "label": "5000-1110-B52A"},
            {"value": "49555_11_131_bb6a", "label": "49555-11-131-BB6A"},
        ]
    },
    {
        "key": "delivery",
        "name": "Delivery Contents",
        "category": FilterCategory.MARKET,
        "filter_type": FilterType.MULTI_SELECT,
        "is_enabled": True,
        "is_searchable": False,
        "display_order": 7,
        "ui_section": "condition",
        "values": [
            {"value": "watch_only", "label": "Watch only"},
            {"value": "with_box", "label": "Watch with original box"},
            {"value": "with_papers", "label": "Watch with original papers"},
            {"value": "full_set", "label": "Full set (box and papers)"},
            {"value": "full_set_receipt", "label": "Full set with original receipt"},
        ]
    },
    {
        "key": "availability",
        "name": "Availability",
        "category": FilterCategory.MARKET,
        "filter_type": FilterType.MULTI_SELECT,
        "is_enabled": True,
        "is_searchable": False,
        "display_order": 8,
        "ui_section": "condition",
        "values": [
            {"value": "in_stock", "label": "In stock"},
            {"value": "available_on_request", "label": "Available on request"},
            {"value": "coming_soon", "label": "Coming soon"},
            {"value": "pre_order", "label": "Pre-order"},
        ]
    },
    {
        "key": "condition_type",
        "name": "New/Used",
        "category": FilterCategory.MARKET,
        "filter_type": FilterType.MULTI_SELECT,
        "is_enabled": True,
        "is_searchable": False,
        "display_order": 9,
        "ui_section": "condition",
        "values": [
            {"value": "new", "label": "New"},
            {"value": "unworn", "label": "Unworn"},
            {"value": "pre_owned", "label": "Pre-owned"},
        ]
    },
    {
        "key": "condition",
        "name": "Condition",
        "category": FilterCategory.MARKET,
        "filter_type": FilterType.MULTI_SELECT,
        "is_enabled": True,
        "is_searchable": False,
        "display_order": 10,
        "ui_section": "condition",
        "values": [
            {"value": "mint", "label": "Mint"},
            {"value": "excellent", "label": "Excellent"},
            {"value": "very_good", "label": "Very Good"},
            {"value": "good", "label": "Good"},
            {"value": "fair", "label": "Fair"},
        ]
    },
    {
        "key": "case_diameter",
        "name": "Case diameter/width",
        "category": FilterCategory.MARKET,
        "filter_type": FilterType.MULTI_SELECT,
        "is_enabled": True,
        "is_searchable": False,
        "display_order": 11,
        "ui_section": "case_size",
        "values": [
            {"value": "under_36mm", "label": "Under 36mm"},
            {"value": "36_38mm", "label": "36mm - 38mm"},
            {"value": "38_40mm", "label": "38mm - 40mm"},
            {"value": "40_42mm", "label": "40mm - 42mm"},
            {"value": "42_44mm", "label": "42mm - 44mm"},
            {"value": "44_46mm", "label": "44mm - 46mm"},
            {"value": "over_46mm", "label": "Over 46mm"},
        ]
    },
    {
        "key": "lug_width",
        "name": "Lug width",
        "category": FilterCategory.MARKET,
        "filter_type": FilterType.MULTI_SELECT,
        "is_enabled": True,
        "is_searchable": False,
        "display_order": 12,
        "ui_section": "case_size",
        "values": [
            {"value": "18mm", "label": "18mm"},
            {"value": "19mm", "label": "19mm"},
            {"value": "20mm", "label": "20mm"},
            {"value": "21mm", "label": "21mm"},
            {"value": "22mm", "label": "22mm"},
            {"value": "24mm", "label": "24mm"},
        ]
    },
    {
        "key": "case_thickness",
        "name": "Case thickness",
        "category": FilterCategory.MARKET,
        "filter_type": FilterType.MULTI_SELECT,
        "is_enabled": True,
        "is_searchable": False,
        "display_order": 13,
        "ui_section": "case_size",
        "values": [
            {"value": "under_8mm", "label": "Under 8mm"},
            {"value": "8_10mm", "label": "8mm - 10mm"},
            {"value": "10_12mm", "label": "10mm - 12mm"},
            {"value": "12_14mm", "label": "12mm - 14mm"},
            {"value": "over_14mm", "label": "Over 14mm"},
        ]
    },
    {
        "key": "gender",
        "name": "Gender",
        "category": FilterCategory.MARKET,
        "filter_type": FilterType.MULTI_SELECT,
        "is_enabled": True,
        "is_searchable": False,
        "display_order": 14,
        "ui_section": "watch_type",
        "values": [
            {"value": "mens", "label": "Men's watch"},
            {"value": "womens", "label": "Women's watch"},
            {"value": "unisex", "label": "Unisex"},
        ]
    },
    {
        "key": "watch_type",
        "name": "Watch type",
        "category": FilterCategory.MARKET,
        "filter_type": FilterType.MULTI_SELECT,
        "is_enabled": True,
        "is_searchable": False,
        "display_order": 15,
        "ui_section": "watch_type",
        "values": [
            {"value": "wristwatch", "label": "Wristwatch"},
            {"value": "pocket_watch", "label": "Pocket watch"},
        ]
    },
    {
        "key": "watch_style",
        "name": "Style of watch",
        "category": FilterCategory.MARKET,
        "filter_type": FilterType.MULTI_SELECT,
        "is_enabled": True,
        "is_searchable": False,
        "display_order": 16,
        "ui_section": "watch_type",
        "values": [
            {"value": "dress", "label": "Dress watch"},
            {"value": "sports", "label": "Sports watch"},
            {"value": "diving", "label": "Diving watch"},
            {"value": "pilot", "label": "Pilot watch"},
            {"value": "field", "label": "Field watch"},
            {"value": "chronograph", "label": "Chronograph"},
            {"value": "gmt", "label": "GMT/World time"},
        ]
    },
    {
        "key": "movement",
        "name": "Movement",
        "category": FilterCategory.MARKET,
        "filter_type": FilterType.MULTI_SELECT,
        "is_enabled": True,
        "is_searchable": False,
        "display_order": 17,
        "ui_section": "caliber",
        "values": [
            {"value": "automatic", "label": "Automatic"},
            {"value": "manual", "label": "Manual winding"},
            {"value": "quartz", "label": "Quartz"},
            {"value": "solar", "label": "Solar"},
            {"value": "kinetic", "label": "Kinetic"},
        ]
    },
    {
        "key": "functions",
        "name": "Functions",
        "category": FilterCategory.MARKET,
        "filter_type": FilterType.MULTI_SELECT,
        "is_enabled": True,
        "is_searchable": False,
        "display_order": 18,
        "ui_section": "caliber",
        "values": [
            {"value": "date", "label": "Date"},
            {"value": "day_date", "label": "Day-Date"},
            {"value": "chronograph", "label": "Chronograph"},
            {"value": "gmt", "label": "GMT/Second time zone"},
            {"value": "power_reserve", "label": "Power reserve indicator"},
            {"value": "moon_phase", "label": "Moon phase"},
            {"value": "annual_calendar", "label": "Annual calendar"},
            {"value": "perpetual_calendar", "label": "Perpetual calendar"},
            {"value": "minute_repeater", "label": "Minute repeater"},
            {"value": "tourbillon", "label": "Tourbillon"},
        ]
    },
    {
        "key": "dial_style",
        "name": "Dial style",
        "category": FilterCategory.MARKET,
        "filter_type": FilterType.MULTI_SELECT,
        "is_enabled": True,
        "is_searchable": False,
        "display_order": 19,
        "ui_section": "dial",
        "values": [
            {"value": "arabic", "label": "Arabic numerals"},
            {"value": "roman", "label": "Roman numerals"},
            {"value": "index", "label": "Index"},
            {"value": "mixed", "label": "Mixed"},
            {"value": "none", "label": "No numerals"},
        ]
    },
    {
        "key": "dial_color",
        "name": "Dial color",
        "category": FilterCategory.MARKET,
        "filter_type": FilterType.MULTI_SELECT,
        "is_enabled": True,
        "is_searchable": False,
        "display_order": 20,
        "ui_section": "dial",
        "values": [
            {"value": "black", "label": "Black"},
            {"value": "white", "label": "White"},
            {"value": "silver", "label": "Silver"},
            {"value": "blue", "label": "Blue"},
            {"value": "green", "label": "Green"},
            {"value": "brown", "label": "Brown"},
            {"value": "champagne", "label": "Champagne/Gold"},
            {"value": "grey", "label": "Grey"},
            {"value": "mop", "label": "Mother of pearl"},
        ]
    },
    {
        "key": "case_material",
        "name": "Case material",
        "category": FilterCategory.MARKET,
        "filter_type": FilterType.MULTI_SELECT,
        "is_enabled": True,
        "is_searchable": False,
        "display_order": 21,
        "ui_section": "case",
        "values": [
            {"value": "stainless_steel", "label": "Stainless steel"},
            {"value": "yellow_gold", "label": "Yellow gold"},
            {"value": "rose_gold", "label": "Rose gold"},
            {"value": "white_gold", "label": "White gold"},
            {"value": "platinum", "label": "Platinum"},
            {"value": "titanium", "label": "Titanium"},
            {"value": "ceramic", "label": "Ceramic"},
            {"value": "carbon", "label": "Carbon"},
            {"value": "bronze", "label": "Bronze"},
        ]
    },
    {
        "key": "bezel_material",
        "name": "Bezel material",
        "category": FilterCategory.MARKET,
        "filter_type": FilterType.MULTI_SELECT,
        "is_enabled": True,
        "is_searchable": False,
        "display_order": 22,
        "ui_section": "case",
        "values": [
            {"value": "stainless_steel", "label": "Stainless steel"},
            {"value": "yellow_gold", "label": "Yellow gold"},
            {"value": "rose_gold", "label": "Rose gold"},
            {"value": "white_gold", "label": "White gold"},
            {"value": "platinum", "label": "Platinum"},
            {"value": "ceramic", "label": "Ceramic"},
            {"value": "diamonds", "label": "Diamonds"},
        ]
    },
    {
        "key": "crystal_type",
        "name": "Crystal type",
        "category": FilterCategory.MARKET,
        "filter_type": FilterType.MULTI_SELECT,
        "is_enabled": True,
        "is_searchable": False,
        "display_order": 23,
        "ui_section": "case",
        "values": [
            {"value": "sapphire", "label": "Sapphire crystal"},
            {"value": "mineral", "label": "Mineral glass"},
            {"value": "hesalite", "label": "Hesalite/Plexiglass"},
        ]
    },
    {
        "key": "water_resistance",
        "name": "Water resistance",
        "category": FilterCategory.MARKET,
        "filter_type": FilterType.MULTI_SELECT,
        "is_enabled": True,
        "is_searchable": False,
        "display_order": 24,
        "ui_section": "case",
        "values": [
            {"value": "not_resistant", "label": "Not water resistant"},
            {"value": "30m", "label": "30m / 3 ATM"},
            {"value": "50m", "label": "50m / 5 ATM"},
            {"value": "100m", "label": "100m / 10 ATM"},
            {"value": "200m", "label": "200m / 20 ATM"},
            {"value": "300m", "label": "300m / 30 ATM"},
            {"value": "500m_plus", "label": "500m+"},
        ]
    },
    {
        "key": "band_material",
        "name": "Band material",
        "category": FilterCategory.MARKET,
        "filter_type": FilterType.MULTI_SELECT,
        "is_enabled": True,
        "is_searchable": False,
        "display_order": 25,
        "ui_section": "band",
        "values": [
            {"value": "leather", "label": "Leather"},
            {"value": "stainless_steel", "label": "Stainless steel"},
            {"value": "yellow_gold", "label": "Yellow gold"},
            {"value": "rose_gold", "label": "Rose gold"},
            {"value": "white_gold", "label": "White gold"},
            {"value": "platinum", "label": "Platinum"},
            {"value": "titanium", "label": "Titanium"},
            {"value": "rubber", "label": "Rubber"},
            {"value": "nato", "label": "NATO/Fabric"},
        ]
    },
    {
        "key": "band_color",
        "name": "Band color",
        "category": FilterCategory.MARKET,
        "filter_type": FilterType.MULTI_SELECT,
        "is_enabled": True,
        "is_searchable": False,
        "display_order": 26,
        "ui_section": "band",
        "values": [
            {"value": "black", "label": "Black"},
            {"value": "brown", "label": "Brown"},
            {"value": "blue", "label": "Blue"},
            {"value": "green", "label": "Green"},
            {"value": "silver", "label": "Silver"},
            {"value": "gold", "label": "Gold"},
            {"value": "rose_gold", "label": "Rose gold"},
            {"value": "white", "label": "White"},
        ]
    },
    {
        "key": "clasp_material",
        "name": "Clasp material",
        "category": FilterCategory.MARKET,
        "filter_type": FilterType.MULTI_SELECT,
        "is_enabled": True,
        "is_searchable": False,
        "display_order": 27,
        "ui_section": "clasp",
        "values": [
            {"value": "stainless_steel", "label": "Stainless steel"},
            {"value": "yellow_gold", "label": "Yellow gold"},
            {"value": "rose_gold", "label": "Rose gold"},
            {"value": "white_gold", "label": "White gold"},
            {"value": "platinum", "label": "Platinum"},
            {"value": "titanium", "label": "Titanium"},
        ]
    },
    {
        "key": "clasp_type",
        "name": "Clasp type",
        "category": FilterCategory.MARKET,
        "filter_type": FilterType.MULTI_SELECT,
        "is_enabled": True,
        "is_searchable": False,
        "display_order": 28,
        "ui_section": "clasp",
        "values": [
            {"value": "fold", "label": "Fold clasp"},
            {"value": "deployant", "label": "Deployant clasp"},
            {"value": "butterfly", "label": "Butterfly clasp"},
            {"value": "pin_buckle", "label": "Pin buckle"},
            {"value": "hidden", "label": "Hidden clasp"},
        ]
    },
]


# ============== SOCIAL FILTERS DATA ==============

SOCIAL_FILTERS_DATA = [
    {
        "key": "offer_type",
        "name": "Offer Type",
        "category": FilterCategory.SOCIAL,
        "filter_type": FilterType.SINGLE_SELECT,
        "is_enabled": True,
        "is_searchable": False,
        "display_order": 1,
        "values": [
            {"value": "wts", "label": "WTS (Want to Sell)"},
            {"value": "wtb", "label": "WTB (Want to Buy)"},
        ]
    },
    {
        "key": "country_code",
        "name": "Country",
        "category": FilterCategory.SOCIAL,
        "filter_type": FilterType.MULTI_SELECT,
        "is_enabled": True,
        "is_searchable": True,
        "display_order": 2,
        "values": [
            {"value": "us", "label": "United States"},
            {"value": "gb", "label": "United Kingdom"},
            {"value": "de", "label": "Germany"},
            {"value": "ch", "label": "Switzerland"},
            {"value": "fr", "label": "France"},
            {"value": "it", "label": "Italy"},
            {"value": "es", "label": "Spain"},
            {"value": "nl", "label": "Netherlands"},
            {"value": "be", "label": "Belgium"},
            {"value": "at", "label": "Austria"},
            {"value": "sg", "label": "Singapore"},
            {"value": "hk", "label": "Hong Kong"},
            {"value": "jp", "label": "Japan"},
            {"value": "ae", "label": "United Arab Emirates"},
            {"value": "ca", "label": "Canada"},
            {"value": "au", "label": "Australia"},
        ]
    },
    {
        "key": "reference",
        "name": "Reference",
        "category": FilterCategory.SOCIAL,
        "filter_type": FilterType.TEXT,
        "is_enabled": True,
        "is_searchable": False,
        "display_order": 3,
        "placeholder": "e.g., 126610LN",
        "values": []
    },
    {
        "key": "brand",
        "name": "Brand",
        "category": FilterCategory.SOCIAL,
        "filter_type": FilterType.MULTI_SELECT,
        "is_enabled": True,
        "is_searchable": True,
        "display_order": 4,
        "values": [
            {"value": "rolex", "label": "Rolex"},
            {"value": "patek_philippe", "label": "Patek Philippe"},
            {"value": "audemars_piguet", "label": "Audemars Piguet"},
            {"value": "omega", "label": "Omega"},
            {"value": "cartier", "label": "Cartier"},
            {"value": "iwc", "label": "IWC"},
            {"value": "jaeger_lecoultre", "label": "Jaeger-LeCoultre"},
            {"value": "vacheron_constantin", "label": "Vacheron Constantin"},
        ]
    },
]


# ============== ORDER BOOK FILTERS DATA ==============

ORDER_BOOK_FILTERS_DATA = [
    {
        "key": "order_type",
        "name": "Order Type",
        "category": FilterCategory.ORDER_BOOK,
        "filter_type": FilterType.SINGLE_SELECT,
        "is_enabled": True,
        "is_searchable": False,
        "display_order": 1,
        "values": [
            {"value": "buy", "label": "Buy Orders"},
            {"value": "sell", "label": "Sell Orders"},
        ]
    },
    {
        "key": "condition",
        "name": "Condition",
        "category": FilterCategory.ORDER_BOOK,
        "filter_type": FilterType.MULTI_SELECT,
        "is_enabled": True,
        "is_searchable": False,
        "display_order": 2,
        "values": [
            {"value": "unworn", "label": "Unworn"},
            {"value": "used", "label": "Used"},
        ]
    },
]


async def seed_listing_fields():
    """Seed listing fields"""
    print("Seeding listing fields...")

    # Clear existing
    await ListingField.find_all().delete()

    for field_data in LISTING_FIELDS_DATA:
        values = [
            ListingFieldValue(
                value=v["value"],
                label=v["label"],
                is_enabled=v.get("is_enabled", True),
                display_order=v.get("display_order", 0),
                parent_value=v.get("parent_value"),
            )
            for i, v in enumerate(field_data.get("values", []))
        ]

        # Set display order for values
        for i, v in enumerate(values):
            v.display_order = i + 1

        field = ListingField(
            key=field_data["key"],
            name=field_data["name"],
            description=field_data.get("description"),
            field_type=field_data.get("field_type", FieldType.DROPDOWN),
            is_enabled=field_data.get("is_enabled", True),
            is_required=field_data.get("is_required", False),
            display_order=field_data["display_order"],
            category=field_data.get("category", "basic"),
            parent_field_key=field_data.get("parent_field_key"),
            placeholder=field_data.get("placeholder"),
            min_value=field_data.get("min_value"),
            max_value=field_data.get("max_value"),
            values=values,
        )

        await field.insert()

    count = await ListingField.find_all().count()
    print(f"  Created {count} listing fields")


async def seed_filters():
    """Seed filters"""
    print("Seeding filters...")

    # Clear existing
    await Filter.find_all().delete()

    all_filters = MARKET_FILTERS_DATA + SOCIAL_FILTERS_DATA + ORDER_BOOK_FILTERS_DATA

    for filter_data in all_filters:
        values = [
            FilterValue(
                value=v["value"],
                label=v["label"],
                is_enabled=v.get("is_enabled", True),
                display_order=i + 1,
            )
            for i, v in enumerate(filter_data.get("values", []))
        ]

        f = Filter(
            key=filter_data["key"],
            name=filter_data["name"],
            category=filter_data["category"],
            filter_type=filter_data.get("filter_type", FilterType.MULTI_SELECT),
            is_enabled=filter_data.get("is_enabled", True),
            is_searchable=filter_data.get("is_searchable", False),
            display_order=filter_data["display_order"],
            ui_section=filter_data.get("ui_section"),
            placeholder=filter_data.get("placeholder"),
            values=values,
        )

        await f.insert()

    market_count = await Filter.find({"category": FilterCategory.MARKET}).count()
    social_count = await Filter.find({"category": FilterCategory.SOCIAL}).count()
    order_book_count = await Filter.find({"category": FilterCategory.ORDER_BOOK}).count()

    print(f"  Created {market_count} market filters")
    print(f"  Created {social_count} social filters")
    print(f"  Created {order_book_count} order book filters")


async def main():
    """Main seed function"""
    print("=" * 50)
    print("Seeding Listing Fields and Filters")
    print("=" * 50)

    # Connect to MongoDB
    client = AsyncIOMotorClient(settings.MONGODB_URL)
    await init_beanie(
        database=client[settings.MONGODB_DB_NAME],
        document_models=[ListingField, Filter]
    )

    try:
        await seed_listing_fields()
        await seed_filters()

        print("=" * 50)
        print("Seeding complete!")
        print("=" * 50)

    finally:
        client.close()


if __name__ == "__main__":
    asyncio.run(main())
