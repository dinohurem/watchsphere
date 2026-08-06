from typing import List, Optional, Dict, Any
from datetime import datetime
import json
import re
from openai import AsyncOpenAI

from app.core.config import settings
from app.models.watch import Watch, WatchStatus
from app.models.news import News, NewsStatus
from app.models.order import Order, OrderStatus, OrderType
from app.models.whatsapp_import import ExtractedWatchListing, OfferType


# Initialize OpenAI client
openai_client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY) if settings.OPENAI_API_KEY else None


# Comprehensive watch reference database - maps references to brand/model
WATCH_REFERENCE_DATABASE = {
    # ROLEX REFERENCES
    # Submariner
    "126610LN": {"brand": "Rolex", "model": "Submariner Date", "family": "Submariner", "caliber": "3235"},
    "126610LV": {"brand": "Rolex", "model": "Submariner Date Starbucks", "family": "Submariner", "caliber": "3235"},
    "124060": {"brand": "Rolex", "model": "Submariner No Date", "family": "Submariner", "caliber": "3230"},
    "126613LN": {"brand": "Rolex", "model": "Submariner Date Two-Tone", "family": "Submariner", "caliber": "3235"},
    "126613LB": {"brand": "Rolex", "model": "Submariner Date Two-Tone Blue", "family": "Submariner", "caliber": "3235"},
    "126618LN": {"brand": "Rolex", "model": "Submariner Date Yellow Gold", "family": "Submariner", "caliber": "3235"},
    "126618LB": {"brand": "Rolex", "model": "Submariner Date Yellow Gold Blue", "family": "Submariner", "caliber": "3235"},
    "126619LB": {"brand": "Rolex", "model": "Submariner Date White Gold", "family": "Submariner", "caliber": "3235"},
    "116610LN": {"brand": "Rolex", "model": "Submariner Date", "family": "Submariner", "caliber": "3135", "discontinued": True},
    "116610LV": {"brand": "Rolex", "model": "Submariner Date Hulk", "family": "Submariner", "caliber": "3135", "discontinued": True},
    "114060": {"brand": "Rolex", "model": "Submariner No Date", "family": "Submariner", "caliber": "3130", "discontinued": True},
    "16610": {"brand": "Rolex", "model": "Submariner Date", "family": "Submariner", "caliber": "3135", "discontinued": True},
    "16610LV": {"brand": "Rolex", "model": "Submariner Date Kermit", "family": "Submariner", "caliber": "3135", "discontinued": True},
    "5513": {"brand": "Rolex", "model": "Submariner", "family": "Submariner", "vintage": True},
    "1680": {"brand": "Rolex", "model": "Submariner Date Red", "family": "Submariner", "vintage": True},

    # Daytona
    "126500LN": {"brand": "Rolex", "model": "Daytona", "family": "Daytona", "caliber": "4131"},
    "126506": {"brand": "Rolex", "model": "Daytona Platinum", "family": "Daytona", "caliber": "4131"},
    "126508": {"brand": "Rolex", "model": "Daytona Yellow Gold", "family": "Daytona", "caliber": "4131"},
    "126509": {"brand": "Rolex", "model": "Daytona White Gold", "family": "Daytona", "caliber": "4131"},
    "116500LN": {"brand": "Rolex", "model": "Daytona", "family": "Daytona", "caliber": "4130", "discontinued": True},
    "116503": {"brand": "Rolex", "model": "Daytona Two-Tone", "family": "Daytona", "caliber": "4130", "discontinued": True},
    "116508": {"brand": "Rolex", "model": "Daytona Yellow Gold Green Dial", "family": "Daytona", "caliber": "4130"},
    "116509": {"brand": "Rolex", "model": "Daytona White Gold", "family": "Daytona", "caliber": "4130"},
    "116515LN": {"brand": "Rolex", "model": "Daytona Everose", "family": "Daytona", "caliber": "4130"},
    "116519LN": {"brand": "Rolex", "model": "Daytona White Gold Oysterflex", "family": "Daytona", "caliber": "4130"},
    "116520": {"brand": "Rolex", "model": "Daytona Steel", "family": "Daytona", "caliber": "4130", "discontinued": True},
    "6263": {"brand": "Rolex", "model": "Daytona", "family": "Daytona", "vintage": True},
    "6239": {"brand": "Rolex", "model": "Daytona Paul Newman", "family": "Daytona", "vintage": True},

    # GMT-Master II
    "126710BLRO": {"brand": "Rolex", "model": "GMT-Master II Pepsi", "family": "GMT-Master", "caliber": "3285"},
    "126710BLNR": {"brand": "Rolex", "model": "GMT-Master II Batman", "family": "GMT-Master", "caliber": "3285"},
    "126711CHNR": {"brand": "Rolex", "model": "GMT-Master II Rootbeer", "family": "GMT-Master", "caliber": "3285"},
    "126715CHNR": {"brand": "Rolex", "model": "GMT-Master II Rootbeer Gold", "family": "GMT-Master", "caliber": "3285"},
    "126718GRNR": {"brand": "Rolex", "model": "GMT-Master II Sprite", "family": "GMT-Master", "caliber": "3285"},
    "126720VTNR": {"brand": "Rolex", "model": "GMT-Master II Destro", "family": "GMT-Master", "caliber": "3285"},
    "116710LN": {"brand": "Rolex", "model": "GMT-Master II", "family": "GMT-Master", "caliber": "3186", "discontinued": True},
    "116710BLNR": {"brand": "Rolex", "model": "GMT-Master II Batman", "family": "GMT-Master", "caliber": "3186", "discontinued": True},
    "16710": {"brand": "Rolex", "model": "GMT-Master II", "family": "GMT-Master", "caliber": "3185", "discontinued": True},
    "1675": {"brand": "Rolex", "model": "GMT-Master", "family": "GMT-Master", "vintage": True},

    # Datejust
    "126334": {"brand": "Rolex", "model": "Datejust 41", "family": "Datejust", "caliber": "3235"},
    "126331": {"brand": "Rolex", "model": "Datejust 41 Two-Tone Rose", "family": "Datejust", "caliber": "3235"},
    "126333": {"brand": "Rolex", "model": "Datejust 41 Two-Tone Yellow", "family": "Datejust", "caliber": "3235"},
    "126300": {"brand": "Rolex", "model": "Datejust 41", "family": "Datejust", "caliber": "3235"},
    "126234": {"brand": "Rolex", "model": "Datejust 36", "family": "Datejust", "caliber": "3235"},
    "126200": {"brand": "Rolex", "model": "Datejust 36", "family": "Datejust", "caliber": "3235"},
    "116234": {"brand": "Rolex", "model": "Datejust 36", "family": "Datejust", "caliber": "3135", "discontinued": True},
    "116334": {"brand": "Rolex", "model": "Datejust II", "family": "Datejust", "caliber": "3136", "discontinued": True},
    "16233": {"brand": "Rolex", "model": "Datejust 36", "family": "Datejust", "discontinued": True},
    "1601": {"brand": "Rolex", "model": "Datejust", "family": "Datejust", "vintage": True},

    # Day-Date
    "228235": {"brand": "Rolex", "model": "Day-Date 40 Rose Gold", "family": "Day-Date", "caliber": "3255"},
    "228238": {"brand": "Rolex", "model": "Day-Date 40 Yellow Gold", "family": "Day-Date", "caliber": "3255"},
    "228239": {"brand": "Rolex", "model": "Day-Date 40 White Gold", "family": "Day-Date", "caliber": "3255"},
    "228206": {"brand": "Rolex", "model": "Day-Date 40 Platinum", "family": "Day-Date", "caliber": "3255"},
    "118238": {"brand": "Rolex", "model": "Day-Date 36 Yellow Gold", "family": "Day-Date", "caliber": "3155", "discontinued": True},
    "18238": {"brand": "Rolex", "model": "Day-Date 36 Yellow Gold", "family": "Day-Date", "discontinued": True},
    "1803": {"brand": "Rolex", "model": "Day-Date", "family": "Day-Date", "vintage": True},

    # Explorer
    "124270": {"brand": "Rolex", "model": "Explorer 36", "family": "Explorer", "caliber": "3230"},
    "224270": {"brand": "Rolex", "model": "Explorer 40", "family": "Explorer", "caliber": "3230"},
    "226570": {"brand": "Rolex", "model": "Explorer II", "family": "Explorer", "caliber": "3285"},
    "214270": {"brand": "Rolex", "model": "Explorer 39", "family": "Explorer", "caliber": "3132", "discontinued": True},
    "216570": {"brand": "Rolex", "model": "Explorer II", "family": "Explorer", "caliber": "3187", "discontinued": True},
    "16570": {"brand": "Rolex", "model": "Explorer II", "family": "Explorer", "discontinued": True},
    "1016": {"brand": "Rolex", "model": "Explorer", "family": "Explorer", "vintage": True},

    # Sea-Dweller / Deepsea
    "126600": {"brand": "Rolex", "model": "Sea-Dweller", "family": "Sea-Dweller", "caliber": "3235"},
    "126603": {"brand": "Rolex", "model": "Sea-Dweller Two-Tone", "family": "Sea-Dweller", "caliber": "3235"},
    "136660": {"brand": "Rolex", "model": "Deepsea", "family": "Sea-Dweller", "caliber": "3235"},
    "126660": {"brand": "Rolex", "model": "Deepsea", "family": "Sea-Dweller", "caliber": "3235"},
    "116660": {"brand": "Rolex", "model": "Deepsea", "family": "Sea-Dweller", "caliber": "3135", "discontinued": True},
    "16600": {"brand": "Rolex", "model": "Sea-Dweller", "family": "Sea-Dweller", "discontinued": True},

    # Yacht-Master
    "226659": {"brand": "Rolex", "model": "Yacht-Master 42 White Gold", "family": "Yacht-Master", "caliber": "3235"},
    "226658": {"brand": "Rolex", "model": "Yacht-Master 42 Yellow Gold", "family": "Yacht-Master", "caliber": "3235"},
    "126621": {"brand": "Rolex", "model": "Yacht-Master 40 Rose Gold", "family": "Yacht-Master", "caliber": "3235"},
    "126622": {"brand": "Rolex", "model": "Yacht-Master 40 Platinum/Steel", "family": "Yacht-Master", "caliber": "3235"},
    "116680": {"brand": "Rolex", "model": "Yacht-Master II", "family": "Yacht-Master", "caliber": "4161"},

    # Sky-Dweller
    "336934": {"brand": "Rolex", "model": "Sky-Dweller Steel/White Gold", "family": "Sky-Dweller", "caliber": "9002"},
    "336935": {"brand": "Rolex", "model": "Sky-Dweller Rose Gold", "family": "Sky-Dweller", "caliber": "9002"},
    "326934": {"brand": "Rolex", "model": "Sky-Dweller Steel/White Gold", "family": "Sky-Dweller", "caliber": "9001"},
    "326935": {"brand": "Rolex", "model": "Sky-Dweller Rose Gold", "family": "Sky-Dweller", "caliber": "9001"},

    # Milgauss
    "116400GV": {"brand": "Rolex", "model": "Milgauss", "family": "Milgauss", "caliber": "3131", "discontinued": True},

    # Air-King
    "126900": {"brand": "Rolex", "model": "Air-King", "family": "Air-King", "caliber": "3230"},
    "116900": {"brand": "Rolex", "model": "Air-King", "family": "Air-King", "caliber": "3131", "discontinued": True},

    # Oyster Perpetual
    "124300": {"brand": "Rolex", "model": "Oyster Perpetual 41", "family": "Oyster Perpetual", "caliber": "3230"},
    "126000": {"brand": "Rolex", "model": "Oyster Perpetual 36", "family": "Oyster Perpetual", "caliber": "3230"},
    "124200": {"brand": "Rolex", "model": "Oyster Perpetual 34", "family": "Oyster Perpetual", "caliber": "2232"},

    # PATEK PHILIPPE REFERENCES
    # Nautilus
    "5711/1A": {"brand": "Patek Philippe", "model": "Nautilus", "family": "Nautilus", "caliber": "26-330 S C", "discontinued": True},
    "5711/1A-010": {"brand": "Patek Philippe", "model": "Nautilus Blue Dial", "family": "Nautilus", "discontinued": True},
    "5711/1A-011": {"brand": "Patek Philippe", "model": "Nautilus White Dial", "family": "Nautilus", "discontinued": True},
    "5711/1A-014": {"brand": "Patek Philippe", "model": "Nautilus Olive Green", "family": "Nautilus", "discontinued": True},
    "5711/1R": {"brand": "Patek Philippe", "model": "Nautilus Rose Gold", "family": "Nautilus"},
    "5712/1A": {"brand": "Patek Philippe", "model": "Nautilus Power Reserve", "family": "Nautilus"},
    "5712R": {"brand": "Patek Philippe", "model": "Nautilus Power Reserve Rose Gold", "family": "Nautilus"},
    "5712G": {"brand": "Patek Philippe", "model": "Nautilus Power Reserve White Gold", "family": "Nautilus"},
    "5719/10G": {"brand": "Patek Philippe", "model": "Nautilus Full Diamonds", "family": "Nautilus"},
    "5726/1A": {"brand": "Patek Philippe", "model": "Nautilus Annual Calendar", "family": "Nautilus"},
    "5740/1G": {"brand": "Patek Philippe", "model": "Nautilus Perpetual Calendar", "family": "Nautilus"},
    "5980/1A": {"brand": "Patek Philippe", "model": "Nautilus Chronograph", "family": "Nautilus"},
    "5980R": {"brand": "Patek Philippe", "model": "Nautilus Chronograph Rose Gold", "family": "Nautilus"},
    "5990/1A": {"brand": "Patek Philippe", "model": "Nautilus Travel Time Chronograph", "family": "Nautilus"},
    "5811/1G": {"brand": "Patek Philippe", "model": "Nautilus White Gold", "family": "Nautilus"},

    # Aquanaut
    "5167A": {"brand": "Patek Philippe", "model": "Aquanaut", "family": "Aquanaut"},
    "5167A-001": {"brand": "Patek Philippe", "model": "Aquanaut", "family": "Aquanaut"},
    "5168G": {"brand": "Patek Philippe", "model": "Aquanaut White Gold", "family": "Aquanaut"},
    "5164A": {"brand": "Patek Philippe", "model": "Aquanaut Travel Time", "family": "Aquanaut"},
    "5968A": {"brand": "Patek Philippe", "model": "Aquanaut Chronograph", "family": "Aquanaut"},

    # Calatrava
    "5196G": {"brand": "Patek Philippe", "model": "Calatrava", "family": "Calatrava"},
    "5196R": {"brand": "Patek Philippe", "model": "Calatrava Rose Gold", "family": "Calatrava"},
    "5227G": {"brand": "Patek Philippe", "model": "Calatrava Officer's", "family": "Calatrava"},
    "5227R": {"brand": "Patek Philippe", "model": "Calatrava Officer's Rose Gold", "family": "Calatrava"},
    "6119G": {"brand": "Patek Philippe", "model": "Calatrava", "family": "Calatrava"},
    "6119R": {"brand": "Patek Philippe", "model": "Calatrava Rose Gold", "family": "Calatrava"},

    # Complications
    "5905R": {"brand": "Patek Philippe", "model": "Annual Calendar Chronograph", "family": "Complications"},
    "5146R": {"brand": "Patek Philippe", "model": "Annual Calendar", "family": "Complications"},
    "5205G": {"brand": "Patek Philippe", "model": "Annual Calendar", "family": "Complications"},
    "5230R": {"brand": "Patek Philippe", "model": "World Time", "family": "Complications"},
    "5231G": {"brand": "Patek Philippe", "model": "World Time", "family": "Complications"},

    # Grand Complications
    "5270P": {"brand": "Patek Philippe", "model": "Perpetual Calendar Chronograph", "family": "Grand Complications"},
    "5270G": {"brand": "Patek Philippe", "model": "Perpetual Calendar Chronograph", "family": "Grand Complications"},
    "5320G": {"brand": "Patek Philippe", "model": "Perpetual Calendar", "family": "Grand Complications"},
    "5327G": {"brand": "Patek Philippe", "model": "Perpetual Calendar", "family": "Grand Complications"},

    # AUDEMARS PIGUET REFERENCES
    # Royal Oak
    "15500ST": {"brand": "Audemars Piguet", "model": "Royal Oak 41mm", "family": "Royal Oak"},
    "15500ST.OO.1220ST.01": {"brand": "Audemars Piguet", "model": "Royal Oak Blue Dial", "family": "Royal Oak"},
    "15500ST.OO.1220ST.02": {"brand": "Audemars Piguet", "model": "Royal Oak Black Dial", "family": "Royal Oak"},
    "15500ST.OO.1220ST.03": {"brand": "Audemars Piguet", "model": "Royal Oak Silver Dial", "family": "Royal Oak"},
    "15500ST.OO.1220ST.04": {"brand": "Audemars Piguet", "model": "Royal Oak Green Dial", "family": "Royal Oak"},
    "15202ST": {"brand": "Audemars Piguet", "model": "Royal Oak Jumbo Extra-Thin", "family": "Royal Oak"},
    "15202IP": {"brand": "Audemars Piguet", "model": "Royal Oak Jumbo Titanium/Platinum", "family": "Royal Oak"},
    "15450ST": {"brand": "Audemars Piguet", "model": "Royal Oak 37mm", "family": "Royal Oak"},
    "15300ST": {"brand": "Audemars Piguet", "model": "Royal Oak 39mm", "family": "Royal Oak", "discontinued": True},
    "15400ST": {"brand": "Audemars Piguet", "model": "Royal Oak 41mm", "family": "Royal Oak", "discontinued": True},
    "26315ST": {"brand": "Audemars Piguet", "model": "Royal Oak Chronograph", "family": "Royal Oak"},
    "26331ST": {"brand": "Audemars Piguet", "model": "Royal Oak Chronograph", "family": "Royal Oak"},
    "26574ST": {"brand": "Audemars Piguet", "model": "Royal Oak Perpetual Calendar", "family": "Royal Oak"},
    "26240ST": {"brand": "Audemars Piguet", "model": "Royal Oak Chronograph", "family": "Royal Oak"},

    # Royal Oak Offshore
    "26470ST": {"brand": "Audemars Piguet", "model": "Royal Oak Offshore Chronograph", "family": "Royal Oak Offshore"},
    "26400IO": {"brand": "Audemars Piguet", "model": "Royal Oak Offshore Chronograph", "family": "Royal Oak Offshore"},
    "26405CE": {"brand": "Audemars Piguet", "model": "Royal Oak Offshore Chronograph", "family": "Royal Oak Offshore"},
    "15710ST": {"brand": "Audemars Piguet", "model": "Royal Oak Offshore Diver", "family": "Royal Oak Offshore"},
    "15720ST": {"brand": "Audemars Piguet", "model": "Royal Oak Offshore Diver", "family": "Royal Oak Offshore"},

    # Code 11.59
    "26393OR": {"brand": "Audemars Piguet", "model": "Code 11.59 Chronograph", "family": "Code 11.59"},
    "15210OR": {"brand": "Audemars Piguet", "model": "Code 11.59", "family": "Code 11.59"},

    # OMEGA REFERENCES
    # Speedmaster
    "310.30.42.50.01.001": {"brand": "Omega", "model": "Speedmaster Moonwatch Professional", "family": "Speedmaster"},
    "310.30.42.50.01.002": {"brand": "Omega", "model": "Speedmaster Moonwatch Hesalite", "family": "Speedmaster"},
    "310.32.42.50.01.001": {"brand": "Omega", "model": "Speedmaster Moonwatch", "family": "Speedmaster"},
    "311.30.42.30.01.005": {"brand": "Omega", "model": "Speedmaster Professional", "family": "Speedmaster", "discontinued": True},
    "311.30.42.30.01.006": {"brand": "Omega", "model": "Speedmaster Professional Sapphire", "family": "Speedmaster", "discontinued": True},
    "304.30.44.52.01.001": {"brand": "Omega", "model": "Speedmaster Racing", "family": "Speedmaster"},
    "329.30.44.51.01.001": {"brand": "Omega", "model": "Speedmaster Racing", "family": "Speedmaster"},
    "310.60.42.50.01.001": {"brand": "Omega", "model": "Speedmaster Canopus Gold", "family": "Speedmaster"},
    "310.63.42.50.01.001": {"brand": "Omega", "model": "Speedmaster Sedna Gold", "family": "Speedmaster"},
    "522.30.42.30.01.001": {"brand": "Omega", "model": "Speedmaster Tokyo 2020", "family": "Speedmaster"},
    "3570.50.00": {"brand": "Omega", "model": "Speedmaster Professional", "family": "Speedmaster", "discontinued": True},

    # Seamaster
    "210.30.42.20.01.001": {"brand": "Omega", "model": "Seamaster Diver 300M", "family": "Seamaster"},
    "210.30.42.20.03.001": {"brand": "Omega", "model": "Seamaster Diver 300M Blue", "family": "Seamaster"},
    "210.30.42.20.04.001": {"brand": "Omega", "model": "Seamaster Diver 300M White", "family": "Seamaster"},
    "210.30.42.20.06.001": {"brand": "Omega", "model": "Seamaster Diver 300M Grey", "family": "Seamaster"},
    "210.32.42.20.01.001": {"brand": "Omega", "model": "Seamaster Diver 300M", "family": "Seamaster"},
    "210.22.42.20.01.001": {"brand": "Omega", "model": "Seamaster Diver 300M Two-Tone", "family": "Seamaster"},
    "212.30.41.20.01.003": {"brand": "Omega", "model": "Seamaster Diver 300M", "family": "Seamaster", "discontinued": True},
    "215.30.44.21.01.001": {"brand": "Omega", "model": "Seamaster Planet Ocean", "family": "Seamaster"},
    "220.10.41.21.01.001": {"brand": "Omega", "model": "Seamaster Aqua Terra", "family": "Seamaster"},
    "220.10.41.21.03.001": {"brand": "Omega", "model": "Seamaster Aqua Terra Blue", "family": "Seamaster"},
    "231.10.42.21.01.003": {"brand": "Omega", "model": "Seamaster Aqua Terra", "family": "Seamaster", "discontinued": True},
    "227.90.55.21.99.001": {"brand": "Omega", "model": "Seamaster Ultra Deep", "family": "Seamaster"},

    # Constellation
    "131.10.39.20.02.001": {"brand": "Omega", "model": "Constellation", "family": "Constellation"},

    # De Ville
    "434.10.41.20.02.001": {"brand": "Omega", "model": "De Ville Prestige", "family": "De Ville"},

    # VACHERON CONSTANTIN REFERENCES
    "4500V/110A-B128": {"brand": "Vacheron Constantin", "model": "Overseas", "family": "Overseas"},
    "4500V/110A-B483": {"brand": "Vacheron Constantin", "model": "Overseas Blue", "family": "Overseas"},
    "5500V/110A-B148": {"brand": "Vacheron Constantin", "model": "Overseas Dual Time", "family": "Overseas"},
    "7900V/110A-B334": {"brand": "Vacheron Constantin", "model": "Overseas Chronograph", "family": "Overseas"},
    "2000V/120G-B122": {"brand": "Vacheron Constantin", "model": "Overseas Ultra-Thin", "family": "Overseas"},
    "4100U/000R-B180": {"brand": "Vacheron Constantin", "model": "Historiques 222", "family": "Historiques"},
    "85180/000G-9230": {"brand": "Vacheron Constantin", "model": "Patrimony", "family": "Patrimony"},
    "7000T/000P-B100": {"brand": "Vacheron Constantin", "model": "FiftySix", "family": "FiftySix"},

    # A. LANGE & SOHNE REFERENCES
    "191.032": {"brand": "A. Lange & Sohne", "model": "Lange 1", "family": "Lange 1"},
    "101.021": {"brand": "A. Lange & Sohne", "model": "Lange 1", "family": "Lange 1"},
    "192.032": {"brand": "A. Lange & Sohne", "model": "Grand Lange 1", "family": "Lange 1"},
    "117.021": {"brand": "A. Lange & Sohne", "model": "1815 Chronograph", "family": "1815"},
    "234.021": {"brand": "A. Lange & Sohne", "model": "1815", "family": "1815"},
    "710.025": {"brand": "A. Lange & Sohne", "model": "Odysseus", "family": "Odysseus"},
    "720.038": {"brand": "A. Lange & Sohne", "model": "Odysseus Chronograph", "family": "Odysseus"},
    "403.035": {"brand": "A. Lange & Sohne", "model": "Datograph Up/Down", "family": "Datograph"},

    # IWC REFERENCES
    "IW500710": {"brand": "IWC", "model": "Portugieser Automatic", "family": "Portugieser"},
    "IW500714": {"brand": "IWC", "model": "Portugieser Automatic Blue", "family": "Portugieser"},
    "IW503501": {"brand": "IWC", "model": "Portugieser Perpetual Calendar", "family": "Portugieser"},
    "IW371491": {"brand": "IWC", "model": "Portugieser Chronograph", "family": "Portugieser"},
    "IW371605": {"brand": "IWC", "model": "Portugieser Chronograph", "family": "Portugieser"},
    "IW377729": {"brand": "IWC", "model": "Pilot's Watch Chronograph", "family": "Pilot"},
    "IW387901": {"brand": "IWC", "model": "Big Pilot", "family": "Pilot"},
    "IW501001": {"brand": "IWC", "model": "Big Pilot Heritage", "family": "Pilot"},
    "IW327015": {"brand": "IWC", "model": "Pilot's Watch Mark XX", "family": "Pilot"},
    "IW326801": {"brand": "IWC", "model": "Pilot's Watch Automatic", "family": "Pilot"},
    "IW329301": {"brand": "IWC", "model": "Pilot's Watch Top Gun", "family": "Pilot"},
    "IW388108": {"brand": "IWC", "model": "Pilot's Watch Chronograph Top Gun", "family": "Pilot"},

    # JAEGER-LECOULTRE REFERENCES
    "Q3978480": {"brand": "Jaeger-LeCoultre", "model": "Reverso Classic Large", "family": "Reverso"},
    "Q3848420": {"brand": "Jaeger-LeCoultre", "model": "Reverso Tribute", "family": "Reverso"},
    "Q2438520": {"brand": "Jaeger-LeCoultre", "model": "Reverso Duoface", "family": "Reverso"},
    "Q1368420": {"brand": "Jaeger-LeCoultre", "model": "Master Ultra Thin", "family": "Master"},
    "Q1288420": {"brand": "Jaeger-LeCoultre", "model": "Master Control Date", "family": "Master"},
    "Q1308470": {"brand": "Jaeger-LeCoultre", "model": "Master Control Chronograph", "family": "Master"},
    "Q9068670": {"brand": "Jaeger-LeCoultre", "model": "Polaris Chronograph", "family": "Polaris"},
    "Q9028480": {"brand": "Jaeger-LeCoultre", "model": "Polaris Mariner", "family": "Polaris"},

    # CARTIER REFERENCES
    "WSSA0030": {"brand": "Cartier", "model": "Santos de Cartier Large", "family": "Santos"},
    "WSSA0018": {"brand": "Cartier", "model": "Santos de Cartier Medium", "family": "Santos"},
    "WSSA0029": {"brand": "Cartier", "model": "Santos de Cartier Blue", "family": "Santos"},
    "CRWSTA0029": {"brand": "Cartier", "model": "Tank Must Large", "family": "Tank"},
    "WSTA0065": {"brand": "Cartier", "model": "Tank Francaise", "family": "Tank"},
    "WGTA0083": {"brand": "Cartier", "model": "Tank Louis Cartier", "family": "Tank"},
    "WSBB0038": {"brand": "Cartier", "model": "Ballon Bleu 36mm", "family": "Ballon Bleu"},
    "WSBB0039": {"brand": "Cartier", "model": "Ballon Bleu 40mm", "family": "Ballon Bleu"},

    # TUDOR REFERENCES
    "M79360N-0001": {"brand": "Tudor", "model": "Black Bay Chrono", "family": "Black Bay"},
    "M79360N-0002": {"brand": "Tudor", "model": "Black Bay Chrono Panda", "family": "Black Bay"},
    "M79230N-0009": {"brand": "Tudor", "model": "Black Bay", "family": "Black Bay"},
    "M79230B-0008": {"brand": "Tudor", "model": "Black Bay Blue", "family": "Black Bay"},
    "M79230R-0012": {"brand": "Tudor", "model": "Black Bay Red", "family": "Black Bay"},
    "M79830RB-0001": {"brand": "Tudor", "model": "Black Bay GMT", "family": "Black Bay"},
    "M79470-0001": {"brand": "Tudor", "model": "Black Bay Pro", "family": "Black Bay"},
    "M79000N-0002": {"brand": "Tudor", "model": "Black Bay 54", "family": "Black Bay"},
    "M25600TN-0001": {"brand": "Tudor", "model": "Pelagos", "family": "Pelagos"},
    "M25600TB-0001": {"brand": "Tudor", "model": "Pelagos Blue", "family": "Pelagos"},
    "M25407N-0001": {"brand": "Tudor", "model": "Pelagos FXD", "family": "Pelagos"},

    # PANERAI REFERENCES
    "PAM01312": {"brand": "Panerai", "model": "Luminor Marina", "family": "Luminor"},
    "PAM00312": {"brand": "Panerai", "model": "Luminor Marina", "family": "Luminor"},
    "PAM01441": {"brand": "Panerai", "model": "Luminor Due", "family": "Luminor"},
    "PAM01392": {"brand": "Panerai", "model": "Luminor Base", "family": "Luminor"},
    "PAM01661": {"brand": "Panerai", "model": "Submersible", "family": "Submersible"},
    "PAM00968": {"brand": "Panerai", "model": "Submersible Carbotech", "family": "Submersible"},

    # HUBLOT REFERENCES
    "411.NX.1170.RX": {"brand": "Hublot", "model": "Big Bang Unico Titanium", "family": "Big Bang"},
    "441.NX.1170.RX": {"brand": "Hublot", "model": "Big Bang Unico 42mm", "family": "Big Bang"},
    "521.NX.1171.RX": {"brand": "Hublot", "model": "Classic Fusion", "family": "Classic Fusion"},
    "542.NX.1171.RX": {"brand": "Hublot", "model": "Classic Fusion 42mm", "family": "Classic Fusion"},
    "601.NX.0173.LR": {"brand": "Hublot", "model": "Spirit of Big Bang", "family": "Big Bang"},

    # BREITLING REFERENCES
    "A17318101C1A1": {"brand": "Breitling", "model": "Superocean Heritage", "family": "Superocean"},
    "AB0127211B1A1": {"brand": "Breitling", "model": "Navitimer B01 Chronograph", "family": "Navitimer"},
    "AB0121211B1P1": {"brand": "Breitling", "model": "Navitimer 1 B01", "family": "Navitimer"},
    "A13313161C1A1": {"brand": "Breitling", "model": "Super Chronomat", "family": "Chronomat"},
    "A32398101B1A1": {"brand": "Breitling", "model": "Avenger Automatic", "family": "Avenger"},
}


def identify_watch_from_reference(reference: str) -> Optional[Dict[str, Any]]:
    """
    Identify watch brand and model from a reference number.
    Returns watch info if found, None otherwise.
    """
    if not reference:
        return None

    # Clean up the reference - remove spaces and convert to uppercase for matching
    clean_ref = reference.strip().upper().replace(" ", "").replace("-", "")

    # Try exact match first
    if reference in WATCH_REFERENCE_DATABASE:
        return WATCH_REFERENCE_DATABASE[reference]

    # Try with common variations
    variations = [
        reference,
        reference.upper(),
        reference.lower(),
        reference.replace(" ", ""),
        reference.replace("-", ""),
        reference.replace(".", ""),
    ]

    for var in variations:
        if var in WATCH_REFERENCE_DATABASE:
            return WATCH_REFERENCE_DATABASE[var]

    # Try partial matching for complex references
    for ref_key, ref_data in WATCH_REFERENCE_DATABASE.items():
        clean_key = ref_key.replace(" ", "").replace("-", "").replace(".", "").upper()
        if clean_ref == clean_key or clean_ref in clean_key or clean_key in clean_ref:
            return ref_data

    return None


def extract_references_from_text(text: str) -> List[str]:
    """Extract potential watch reference numbers from text."""
    # Common reference patterns
    patterns = [
        r'\b\d{5,6}[A-Z]{0,4}\b',  # Rolex style: 126610LN, 116500LN
        r'\b\d{4}[A-Z]?/\d+[A-Z]?[-\d]*\b',  # Patek style: 5711/1A
        r'\b\d{5}[A-Z]{2}\b',  # AP style: 15500ST
        r'\b[A-Z]{2,3}\d{6}\b',  # IWC style: IW500710
        r'\b[A-Z]\d{8}\b',  # JLC style: Q3978480
        r'\bPAM\d{5}\b',  # Panerai style
        r'\b\d{3}\.\d{2}\.\d{2}\.\d{2}\.\d{2}\.\d{3}\b',  # Omega style
        r'\b[A-Z]{4}\d{4}\b',  # Cartier style: WSSA0030
        r'\bM\d{5}[A-Z]?-\d{4}\b',  # Tudor style
    ]

    references = []
    for pattern in patterns:
        matches = re.findall(pattern, text, re.IGNORECASE)
        references.extend(matches)

    return list(set(references))


async def search_marketplace_for_reference(reference: str, brand: Optional[str] = None) -> List[Dict]:
    """Search marketplace listings for a specific reference."""
    query_conditions = [Watch.status == WatchStatus.ACTIVE]

    if reference:
        # Try exact match and partial match
        query_conditions.append({"reference": {"$regex": reference, "$options": "i"}})

    if brand:
        query_conditions.append({"brand": {"$regex": brand, "$options": "i"}})

    watches = await Watch.find(*query_conditions).sort([("created_at", -1)]).limit(20).to_list()

    return [
        {
            "source": "marketplace",
            "id": str(w.id),
            "brand": w.brand,
            "model": w.model,
            "reference": w.reference,
            "price": w.price,
            "currency": w.currency,
            "condition": w.condition.value if w.condition else None,
            "year": w.year,
            "seller": "WatchSphere Seller",
        }
        for w in watches
    ]


async def search_social_for_reference(reference: str, brand: Optional[str] = None) -> List[Dict]:
    """Search social/WhatsApp imported listings for a specific reference."""
    query_conditions = []

    if reference:
        query_conditions.append({"reference": {"$regex": reference, "$options": "i"}})

    if brand:
        query_conditions.append({"brand": {"$regex": brand, "$options": "i"}})

    if not query_conditions:
        return []

    listings = await ExtractedWatchListing.find(
        *query_conditions
    ).sort([("message_timestamp", -1)]).limit(20).to_list()

    return [
        {
            "source": "social",
            "id": str(lst.id),
            "brand": lst.brand,
            "model": None,
            "reference": lst.reference,
            "price": lst.price,
            "currency": lst.currency,
            "condition": lst.condition,
            "year": None,
            "seller": lst.seller_name,
            "seller_phone": lst.seller_phone,
            "country": lst.country_name,
            "offer_type": lst.offer_type.value if lst.offer_type else "unknown",
            "message": lst.raw_text[:200] + "..." if len(lst.raw_text) > 200 else lst.raw_text,
            "date": lst.message_timestamp.strftime("%Y-%m-%d") if lst.message_timestamp else None,
        }
        for lst in listings
    ]


async def get_market_context() -> str:
    """Get current market data for AI context"""
    # Get active watches for market context
    active_watches = await Watch.find(
        Watch.status == WatchStatus.ACTIVE
    ).sort([("created_at", -1)]).limit(50).to_list()

    # Get recent news
    recent_news = await News.find(
        News.status == NewsStatus.PUBLISHED
    ).sort([("published_at", -1)]).limit(10).to_list()

    # Format watch data
    watch_summary = []
    for watch in active_watches:
        watch_summary.append({
            "brand": watch.brand,
            "model": watch.model,
            "reference": watch.reference,
            "price": f"{watch.price} {watch.currency}",
            "condition": watch.condition.value if watch.condition else "unknown",
            "year": watch.year,
        })

    # Format news data
    news_summary = []
    for article in recent_news:
        news_summary.append({
            "title": article.title,
            "excerpt": article.excerpt,
            "published": article.published_at.strftime("%Y-%m-%d") if article.published_at else None,
            "tags": article.tags,
        })

    # Get price statistics per brand
    brand_stats = {}
    for watch in active_watches:
        brand = watch.brand
        if brand not in brand_stats:
            brand_stats[brand] = {"count": 0, "min_price": float('inf'), "max_price": 0, "prices": []}
        brand_stats[brand]["count"] += 1
        brand_stats[brand]["prices"].append(watch.price)
        brand_stats[brand]["min_price"] = min(brand_stats[brand]["min_price"], watch.price)
        brand_stats[brand]["max_price"] = max(brand_stats[brand]["max_price"], watch.price)

    # Calculate averages
    for brand in brand_stats:
        prices = brand_stats[brand]["prices"]
        brand_stats[brand]["avg_price"] = round(sum(prices) / len(prices), 2)
        del brand_stats[brand]["prices"]  # Remove the list
        if brand_stats[brand]["min_price"] == float('inf'):
            brand_stats[brand]["min_price"] = 0

    context = f"""
Current WatchSphere Market Data (as of {datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC")}):

ACTIVE LISTINGS ({len(active_watches)} watches):
{json.dumps(watch_summary[:20], indent=2)}

BRAND STATISTICS:
{json.dumps(brand_stats, indent=2)}

RECENT NEWS & UPDATES ({len(recent_news)} articles):
{json.dumps(news_summary, indent=2)}
"""
    return context


# The verbatim reply for anything outside the WatchSphere network.
OUT_OF_SCOPE_REPLY = (
    "At the moment, I am exclusively focused on helping you within the WatchSphere "
    "network with dealer offers, market activity, pricing insights, and matching "
    "buyers and sellers.\n\n"
    "General watch-related questions outside of the WatchSphere marketplace are "
    "currently not supported yet.\n\n"
    "Additional AI features and broader watch knowledge capabilities will be added "
    "in future updates."
)

# Static conversion table, used only to annotate WatchSphere prices with a rough
# EUR equivalent so the bot never has to invent an exchange rate.
FX_TO_EUR = {
    "EUR": 1.0, "HKD": 0.119, "HK$": 0.119, "USD": 0.925, "USDT": 0.925,
    "GBP": 1.17, "CHF": 1.06, "AED": 0.252, "SGD": 0.69, "JPY": 0.0059,
    "CNY": 0.128, "RMB": 0.128,
}


def _to_eur(price: Optional[float], currency: Optional[str]) -> Optional[int]:
    """Approximate EUR value of a price, or None when it can't be converted."""
    if not price:
        return None
    rate = FX_TO_EUR.get((currency or "EUR").strip().upper())
    if rate is None:
        return None
    return int(round(price * rate))


def _search_tokens(text: str) -> List[str]:
    """Reference-like tokens (references, WS codes, OEM refs) from user text."""
    if not text:
        return []
    tokens = []
    for raw in re.findall(r'[A-Za-z0-9][A-Za-z0-9./\-]{3,}', text):
        token = raw.strip('.').strip('-')
        if len(token) < 4 or not any(c.isdigit() for c in token):
            continue
        if token.lower() in tokens:
            continue
        tokens.append(token.lower())
    return tokens[:6]


def _token_variants(token: str) -> List[str]:
    """The token plus its digit stem, so "228238A Blk" still finds 228238."""
    variants = [token]
    stem = re.match(r'^(\d{4,})[a-z]{1,4}$', token)
    if stem:
        variants.append(stem.group(1))
    return variants


async def _catalog_matches(tokens: List[str]) -> List[Watch]:
    """Catalog entries whose reference / WS code / OEM ref / alias matches."""
    if not tokens:
        return []
    ors: List[dict] = []
    for token in [v for t in tokens for v in _token_variants(t)]:
        pattern = f"^{re.escape(token)}"
        ors.extend([
            {"reference": {"$regex": pattern, "$options": "i"}},
            {"ws_code": {"$regex": pattern, "$options": "i"}},
            {"oem_references": {"$regex": pattern, "$options": "i"}},
            {"aliases": {"$regex": pattern, "$options": "i"}},
        ])
    return await Watch.find({"$or": ors}).limit(12).to_list()


def _catalog_entry(w: Watch) -> dict:
    """Full catalog description of a watch — the bot's only source of truth."""
    return {
        "ws_code": w.ws_code,
        "brand": w.brand,
        "model": w.model,
        "collection": w.collection,
        "reference": w.reference,
        "oem_references": w.oem_references or [],
        "aliases": w.aliases or [],
        "dial": w.dial,
        "bracelet": w.bracelet,
        "description": (w.description or "")[:300] or None,
        "photo": w.cover_image or (w.images[0] if w.images else None),
    }


def _order_entry(o: Order) -> dict:
    """One WTS listing or WTB search, exactly as WatchSphere holds it."""
    month_year = None
    if o.watch_month and o.year:
        month_year = f"{o.watch_month:02d}/{o.year % 100:02d}"
    elif o.year:
        month_year = str(o.year)
    elif o.year_raw:
        month_year = o.year_raw

    entry = {
        "ws_code": o.ws_code,
        "brand": o.brand,
        "reference": o.reference,
        "dealer_phone": o.whatsapp_phone or None,
        "dealer_name": o.user_name or None,
        "country": o.country_name or o.country_code,
        "country_code": o.country_code,
        "condition": o.condition.value if o.condition else (o.condition_raw or None),
        "date": month_year,
        "remarks": o.remarks or None,
        "price": o.price,
        "currency": o.currency,
        "price_eur_approx": _to_eur(o.price, o.currency),
    }
    return {k: v for k, v in entry.items() if v is not None}


def _price_summary(entries: List[dict]) -> Optional[dict]:
    values = [e["price_eur_approx"] for e in entries if e.get("price_eur_approx")]
    if not values:
        return None
    return {
        "count_with_price": len(values),
        "min_eur_approx": min(values),
        "max_eur_approx": max(values),
        "median_eur_approx": sorted(values)[len(values) // 2],
    }


async def _orders_for(watches: List[Watch], tokens: List[str]) -> dict:
    """Active WTS listings and WTB searches for the watches in question."""
    ors: List[dict] = []
    ws_codes = [w.ws_code for w in watches if w.ws_code]
    references = [w.reference for w in watches if w.reference]
    if ws_codes:
        ors.append({"ws_code": {"$in": ws_codes}})
    if references:
        ors.append({"reference": {"$in": references}})
    for token in [v for t in tokens for v in _token_variants(t)]:
        ors.append({"reference": {"$regex": f"^{re.escape(token)}", "$options": "i"}})
        ors.append({"ws_code": {"$regex": f"^{re.escape(token)}", "$options": "i"}})
    if not ors:
        return {"wts_listings": [], "wtb_searches": []}

    orders = await Order.find({
        "status": OrderStatus.ACTIVE.value,
        "$or": ors,
    }).limit(200).to_list()

    wts = [_order_entry(o) for o in orders if o.order_type == OrderType.SELL]
    wtb = [_order_entry(o) for o in orders if o.order_type == OrderType.BUY]
    wts.sort(key=lambda e: e.get("price_eur_approx") or float("inf"))
    return {"wts_listings": wts[:60], "wtb_searches": wtb[:60]}


async def build_watchsphere_context(user_message: str, history: List[Dict[str, str]]) -> str:
    """Assemble the ONLY data the bot is allowed to answer from.

    Looks at the current message plus recent user turns, so a follow-up like
    "Yes" still resolves against the watch discussed earlier.
    """
    texts = [user_message]
    for msg in reversed(history[-8:]):
        if not msg.get("is_ai"):
            texts.append(msg.get("content", ""))

    tokens: List[str] = []
    for text in texts:
        for token in _search_tokens(text):
            if token not in tokens:
                tokens.append(token)
    tokens = tokens[:8]

    watches = await _catalog_matches(tokens)
    orders = await _orders_for(watches, tokens)

    wts = orders["wts_listings"]
    wtb = orders["wtb_searches"]

    countries_selling: Dict[str, int] = {}
    for e in wts:
        key = e.get("country") or "unknown"
        countries_selling[key] = countries_selling.get(key, 0) + 1
    countries_buying: Dict[str, int] = {}
    for e in wtb:
        key = e.get("country") or "unknown"
        countries_buying[key] = countries_buying.get(key, 0) + 1

    payload = {
        "generated_at": datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC"),
        "recognized_tokens": tokens,
        "catalog_matches": [_catalog_entry(w) for w in watches],
        "active_wts_listings": {
            "total": len(wts),
            "by_country": countries_selling,
            "price_summary": _price_summary(wts),
            "listings": wts,
        },
        "active_wtb_searches": {
            "total": len(wtb),
            "by_country": countries_buying,
            "target_price_summary": _price_summary(wtb),
            "searches": wtb,
        },
    }

    return (
        "WATCHSPHERE DATA (the only permitted source for this answer):\n"
        + json.dumps(payload, indent=1, default=str)
    )


_SYSTEM_PROMPT_TEMPLATE = """You are the WatchSphere AI bot. You are an intelligent layer on top of the
WatchSphere ecosystem — NOT a generic internet watch chatbot.

## ABSOLUTE DATA RULE

Every factual statement you make — prices, dealers, availability, market activity,
liquidity, targets, remarks, contact details — must come EXCLUSIVELY from the
"WATCHSPHERE DATA" block supplied with the conversation. That block is built from the
WatchSphere watch database (WS codes, references, OEM references, brands, models,
collections, dials, bracelets, aliases, photos, descriptions), all active WTS orders,
all active WTB orders, dealer targets, remarks and dealer contact information.

You must NOT use internet knowledge, Chrono24, Google, forums, auction results or any
external marketplace for pricing or availability. Never invent a dealer, a phone
number, a price or a listing. If the data block holds nothing for the request, say so
plainly and offer to notify or to widen the search.

## OUT OF SCOPE

If the user asks something that is not about offers/activity inside the WatchSphere
network — general watch history, servicing advice, brand trivia, investment opinions,
anything unrelated — reply with EXACTLY this text and nothing else:

{out_of_scope}

## HOW TO ANSWER

1. Missing configuration → ask first. Before quoting a "safe pay" or a valuation, ask
   only for what is genuinely missing, as a short bullet list:
   - papers / full set or watch only
   - date/year of the watch
   - unworn or used
   For a location-specific request also ask: preferred year/date, condition, full set or
   watch only, local deal only or worldwide.

2. Answering with data. Report what the network actually holds, e.g.
   "Based on current WatchSphere data, I can currently find 8 dealers searching for this
   exact configuration." Give target prices in the dealer's own currency with the EUR
   equivalent in brackets when the data provides `price_eur_approx`, and give listing
   ranges ("45 listings ... ranging from approximately €59,500 up to €61,000").
   Then offer the next step: "Would you like me to provide you with the contact details
   of some dealers currently searching for this watch?"

3. Contact details. When the user says yes, list up to 3 entries in this shape:

   Dealer 1 🇭🇰
   +852 6103 6278
   Target: 535,000 HK$ (€58,100) for a 2026 unworn example.

   For WTS offers use the listing shape instead:

   Dealer 1 🇭🇰
   +852 6103 6278
   5712/1R - 2022 - Used - Full Set - 1,830,000 HK$

   Use the country flag emoji matching the dealer's country. When a WTB dealer has no
   target, write "No target price specified." Close with an offer to show more options.

4. Cheapest / filtered requests. Answer from the data: cheapest listing, Europe only,
   Hong Kong only, margin scheme / wire, unworn 2026 only, and so on.

5. Remarks filter with no hit. If listings exist but none carry the requested remarks
   (e.g. "Margin Scheme", "Wire"), say so explicitly, note that many dealers do not
   always include payment or invoice conditions in their listings so the user can still
   contact them directly, then show the available listings without those remarks.

## TONE

Direct, professional, dealer-to-dealer. Short lines, no filler, no marketing language.
Never mention JSON, "the data block", or how you obtained the information."""


SYSTEM_PROMPT = _SYSTEM_PROMPT_TEMPLATE.format(out_of_scope=OUT_OF_SCOPE_REPLY)


async def generate_ai_response(
    user_message: str,
    conversation_history: List[Dict[str, str]],
    include_market_context: bool = True,
) -> str:
    """
    Generate an AI response strictly from WatchSphere data.

    The bot answers only about the WatchSphere network — catalog entries, active
    WTS/WTB orders, dealer targets, remarks and dealer contacts. Nothing is drawn
    from external marketplaces or general internet knowledge.

    Args:
        user_message: The user's message
        conversation_history: Previous messages in the conversation
        include_market_context: kept for backwards compatibility; WatchSphere
            data is always attached now.

    Returns:
        The AI's response text
    """
    if not openai_client:
        return "AI service is not configured. Please add your OpenAI API key to enable AI chat."

    try:
        context = await build_watchsphere_context(user_message, conversation_history)

        messages = [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "system", "content": context},
        ]

        # Add conversation history
        for msg in conversation_history[-10:]:  # Keep last 10 messages for context
            role = "assistant" if msg.get("is_ai") else "user"
            messages.append({"role": role, "content": msg["content"]})

        # Add the current user message
        messages.append({"role": "user", "content": user_message})

        response = await openai_client.chat.completions.create(
            model="gpt-4o",
            messages=messages,
            max_tokens=1500,
            temperature=0.3,
        )

        return response.choices[0].message.content

    except Exception as e:
        return f"I apologize, but I encountered an error processing your request. Please try again later. Error: {str(e)}"


async def get_watch_recommendation(
    budget_min: float,
    budget_max: float,
    brands: Optional[List[str]] = None,
    purpose: str = "collection",  # collection, investment, daily_wear
) -> Dict[str, Any]:
    """
    Get watch recommendations based on criteria.
    """
    query_conditions = [
        Watch.status == WatchStatus.ACTIVE,
        Watch.price >= budget_min,
        Watch.price <= budget_max,
    ]

    if brands:
        query_conditions.append({"brand": {"$in": brands}})

    watches = await Watch.find(*query_conditions).sort([("views", -1)]).limit(10).to_list()

    recommendations = []
    for watch in watches:
        recommendations.append({
            "id": str(watch.id),
            "brand": watch.brand,
            "model": watch.model,
            "reference": watch.reference,
            "price": watch.price,
            "currency": watch.currency,
            "condition": watch.condition.value if watch.condition else None,
            "year": watch.year,
            "cover_image": watch.cover_image,
        })

    return {
        "recommendations": recommendations,
        "total_found": len(recommendations),
        "criteria": {
            "budget_range": f"{budget_min} - {budget_max}",
            "brands": brands,
            "purpose": purpose,
        }
    }
