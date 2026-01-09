from typing import List, Optional, Dict, Any
from datetime import datetime
import json
import re
from openai import AsyncOpenAI

from app.core.config import settings
from app.models.watch import Watch, WatchStatus
from app.models.news import News, NewsStatus
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


SYSTEM_PROMPT = """You are WatchSphere AI, an EXPERT luxury watch specialist with encyclopedic knowledge of watch references, models, and the market. You are THE definitive authority on luxury timepieces.

## YOUR EXPERTISE

You have COMPLETE knowledge of watch references. When a user mentions ANY reference number (like 126610LN, 5711/1A, 15500ST, etc.), you IMMEDIATELY know:
- The exact brand (Rolex, Patek Philippe, Audemars Piguet, etc.)
- The exact model name
- The watch family/collection
- Key specifications (movement, case size, materials)
- Whether it's discontinued or current production
- Approximate retail and market prices
- Historical significance

## REFERENCE RECOGNITION EXAMPLES

- 126610LN = Rolex Submariner Date (current production, 41mm, black dial/bezel)
- 116610LV = Rolex Submariner "Hulk" (discontinued, green dial/bezel, highly collectible)
- 5711/1A = Patek Philippe Nautilus (iconic steel sports watch, discontinued and extremely desirable)
- 15500ST = Audemars Piguet Royal Oak (41mm steel, current production)
- 310.30.42.50.01.001 = Omega Speedmaster Moonwatch Professional (Co-Axial Master Chronometer)

## YOUR BEHAVIOR

1. **When a user asks about availability of a reference:**
   - IMMEDIATELY recognize what watch it is and confirm your knowledge
   - Ask clarifying questions about their preferences:
     * Preferred market/location (if they want local sellers)
     * Condition preference (new, unworn, excellent, good)
     * Year of production preference
     * Budget range
   - Then search both marketplace AND social listings to find matches

2. **When presenting results:**
   - Show marketplace listings first (verified sellers)
   - Then show social/WhatsApp listings (may need verification)
   - Include price, condition, seller info, and location when available

3. **When no results are found:**
   - Acknowledge what the user is looking for
   - Explain why it might be rare or difficult to find
   - Suggest alternatives or how to get notified when one becomes available

## IMPORTANT GUIDELINES

- NEVER say "I don't know what reference that is" for common references
- Always demonstrate your expertise by identifying the watch immediately
- Be conversational but professional
- Use EUR as default currency unless user specifies otherwise
- If you genuinely don't recognize a reference, ask for more details politely
- When showing prices, note if they're above/below typical market rates
- Recommend caution with social listings - suggest verification

## TONE

Be confident, knowledgeable, and helpful. You're a trusted watch advisor who happens to have access to real-time market data. Show your expertise while remaining approachable."""


async def generate_ai_response(
    user_message: str,
    conversation_history: List[Dict[str, str]],
    include_market_context: bool = True,
) -> str:
    """
    Generate an AI response using OpenAI with market context.

    Args:
        user_message: The user's message
        conversation_history: Previous messages in the conversation
        include_market_context: Whether to include current market data

    Returns:
        The AI's response text
    """
    if not openai_client:
        return "AI service is not configured. Please add your OpenAI API key to enable AI chat."

    try:
        # Extract any reference numbers from the user's message
        extracted_refs = extract_references_from_text(user_message)

        # Build context about the watches mentioned
        watch_context = []
        search_results = []

        for ref in extracted_refs:
            # Identify the watch from our database
            watch_info = identify_watch_from_reference(ref)
            if watch_info:
                watch_context.append(f"Reference {ref}: {watch_info['brand']} {watch_info['model']} ({watch_info.get('family', 'N/A')})")

                # Search marketplace and social for this reference
                marketplace_results = await search_marketplace_for_reference(ref, watch_info.get('brand'))
                social_results = await search_social_for_reference(ref, watch_info.get('brand'))

                if marketplace_results or social_results:
                    search_results.append({
                        "reference": ref,
                        "watch_info": watch_info,
                        "marketplace_listings": marketplace_results,
                        "social_listings": social_results,
                    })

        # Build the messages array
        messages = [{"role": "system", "content": SYSTEM_PROMPT}]

        # Add watch identification context if we found references
        if watch_context:
            identification_context = f"""
IDENTIFIED WATCHES FROM USER MESSAGE:
{chr(10).join(watch_context)}

SEARCH RESULTS:
{json.dumps(search_results, indent=2, default=str)}
"""
            messages.append({
                "role": "system",
                "content": identification_context
            })

        # Add market context if requested
        if include_market_context:
            market_context = await get_market_context()
            messages.append({
                "role": "system",
                "content": f"Current market data context:\n{market_context}"
            })

        # Add conversation history
        for msg in conversation_history[-10:]:  # Keep last 10 messages for context
            role = "assistant" if msg.get("is_ai") else "user"
            messages.append({"role": role, "content": msg["content"]})

        # Add the current user message
        messages.append({"role": "user", "content": user_message})

        # Call OpenAI API
        response = await openai_client.chat.completions.create(
            model="gpt-4o",  # Using GPT-4o for best quality
            messages=messages,
            max_tokens=1500,
            temperature=0.7,
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
