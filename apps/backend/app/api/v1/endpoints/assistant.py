from typing import Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from datetime import datetime
from beanie import PydanticObjectId
import re

from app.core.deps import get_current_user
from app.models.user import User
from app.models.order import Order, OrderType, OrderStatus
from app.models.whatsapp_import import ExtractedWatchListing

router = APIRouter()


# Watch brand patterns for detection
WATCH_BRANDS = [
    "rolex", "patek philippe", "patek", "audemars piguet", "ap",
    "richard mille", "rm", "omega", "cartier", "hublot",
    "jaeger-lecoultre", "jlc", "vacheron constantin", "vc",
    "iwc", "breitling", "tudor", "panerai", "tag heuer",
    "submariner", "daytona", "nautilus", "royal oak", "aquanaut",
    "speedmaster", "seamaster", "gmt-master", "datejust", "day-date"
]

# Reference patterns
REF_PATTERNS = [
    r'\b([A-Z]{0,3}\d{4,6}[A-Z0-9/-]*)\b',  # Standard refs like 126610LN, 5968G
    r'\bref\.?\s*([A-Z0-9/-]+)\b',  # "ref. 126610LN"
]

# Comprehensive watch reference database for automatic identification
WATCH_REFERENCE_DATABASE = {
    # Rolex Submariner
    "126610LN": {"brand": "Rolex", "model": "Submariner Date", "family": "Submariner"},
    "126610LV": {"brand": "Rolex", "model": "Submariner Date Starbucks", "family": "Submariner"},
    "124060": {"brand": "Rolex", "model": "Submariner No Date", "family": "Submariner"},
    "126619LB": {"brand": "Rolex", "model": "Submariner Date White Gold", "family": "Submariner"},
    "116610LN": {"brand": "Rolex", "model": "Submariner Date", "family": "Submariner"},
    "116610LV": {"brand": "Rolex", "model": "Submariner Date Hulk", "family": "Submariner"},
    "114060": {"brand": "Rolex", "model": "Submariner No Date", "family": "Submariner"},
    "16610": {"brand": "Rolex", "model": "Submariner Date", "family": "Submariner"},
    "16610LV": {"brand": "Rolex", "model": "Submariner Date Kermit", "family": "Submariner"},
    "5513": {"brand": "Rolex", "model": "Submariner No Date Vintage", "family": "Submariner"},
    "1680": {"brand": "Rolex", "model": "Submariner Date Red", "family": "Submariner"},

    # Rolex Daytona
    "126500LN": {"brand": "Rolex", "model": "Cosmograph Daytona", "family": "Daytona"},
    "116500LN": {"brand": "Rolex", "model": "Cosmograph Daytona", "family": "Daytona"},
    "116508": {"brand": "Rolex", "model": "Daytona Yellow Gold Green Dial", "family": "Daytona"},
    "116509": {"brand": "Rolex", "model": "Daytona White Gold", "family": "Daytona"},
    "116503": {"brand": "Rolex", "model": "Daytona Two-Tone", "family": "Daytona"},
    "116505": {"brand": "Rolex", "model": "Daytona Everose Gold", "family": "Daytona"},
    "116515LN": {"brand": "Rolex", "model": "Daytona Everose Oysterflex", "family": "Daytona"},
    "116519LN": {"brand": "Rolex", "model": "Daytona White Gold Oysterflex", "family": "Daytona"},
    "116520": {"brand": "Rolex", "model": "Daytona Steel", "family": "Daytona"},
    "16520": {"brand": "Rolex", "model": "Daytona Zenith", "family": "Daytona"},
    "6263": {"brand": "Rolex", "model": "Daytona Paul Newman", "family": "Daytona"},
    "6239": {"brand": "Rolex", "model": "Daytona Vintage", "family": "Daytona"},

    # Rolex GMT-Master II
    "126710BLRO": {"brand": "Rolex", "model": "GMT-Master II Pepsi", "family": "GMT-Master"},
    "126710BLNR": {"brand": "Rolex", "model": "GMT-Master II Batman", "family": "GMT-Master"},
    "126711CHNR": {"brand": "Rolex", "model": "GMT-Master II Root Beer", "family": "GMT-Master"},
    "126715CHNR": {"brand": "Rolex", "model": "GMT-Master II Everose", "family": "GMT-Master"},
    "126720VTNR": {"brand": "Rolex", "model": "GMT-Master II Sprite", "family": "GMT-Master"},
    "116710LN": {"brand": "Rolex", "model": "GMT-Master II Black", "family": "GMT-Master"},
    "116710BLNR": {"brand": "Rolex", "model": "GMT-Master II Batman", "family": "GMT-Master"},
    "116718LN": {"brand": "Rolex", "model": "GMT-Master II Yellow Gold", "family": "GMT-Master"},
    "16710": {"brand": "Rolex", "model": "GMT-Master II", "family": "GMT-Master"},
    "1675": {"brand": "Rolex", "model": "GMT-Master Vintage", "family": "GMT-Master"},

    # Rolex Datejust
    "126334": {"brand": "Rolex", "model": "Datejust 41", "family": "Datejust"},
    "126331": {"brand": "Rolex", "model": "Datejust 41 Two-Tone Rose", "family": "Datejust"},
    "126333": {"brand": "Rolex", "model": "Datejust 41 Two-Tone Yellow", "family": "Datejust"},
    "126300": {"brand": "Rolex", "model": "Datejust 41 Steel", "family": "Datejust"},
    "126234": {"brand": "Rolex", "model": "Datejust 36", "family": "Datejust"},
    "126200": {"brand": "Rolex", "model": "Datejust 36 Steel", "family": "Datejust"},
    "116334": {"brand": "Rolex", "model": "Datejust II", "family": "Datejust"},
    "116233": {"brand": "Rolex", "model": "Datejust 36 Two-Tone", "family": "Datejust"},
    "16233": {"brand": "Rolex", "model": "Datejust 36", "family": "Datejust"},
    "1601": {"brand": "Rolex", "model": "Datejust Vintage", "family": "Datejust"},

    # Rolex Day-Date
    "228238": {"brand": "Rolex", "model": "Day-Date 40 Yellow Gold", "family": "Day-Date"},
    "228235": {"brand": "Rolex", "model": "Day-Date 40 Everose Gold", "family": "Day-Date"},
    "228239": {"brand": "Rolex", "model": "Day-Date 40 White Gold", "family": "Day-Date"},
    "228206": {"brand": "Rolex", "model": "Day-Date 40 Platinum", "family": "Day-Date"},
    "118238": {"brand": "Rolex", "model": "Day-Date 36 Yellow Gold", "family": "Day-Date"},
    "118235": {"brand": "Rolex", "model": "Day-Date 36 Everose Gold", "family": "Day-Date"},
    "18238": {"brand": "Rolex", "model": "Day-Date 36", "family": "Day-Date"},
    "1803": {"brand": "Rolex", "model": "Day-Date Vintage", "family": "Day-Date"},

    # Rolex Sky-Dweller
    "336934": {"brand": "Rolex", "model": "Sky-Dweller Steel/White Gold", "family": "Sky-Dweller"},
    "336935": {"brand": "Rolex", "model": "Sky-Dweller Everose Gold", "family": "Sky-Dweller"},
    "326934": {"brand": "Rolex", "model": "Sky-Dweller Steel/White Gold", "family": "Sky-Dweller"},
    "326935": {"brand": "Rolex", "model": "Sky-Dweller Everose Gold", "family": "Sky-Dweller"},
    "326238": {"brand": "Rolex", "model": "Sky-Dweller Yellow Gold", "family": "Sky-Dweller"},

    # Rolex Explorer
    "224270": {"brand": "Rolex", "model": "Explorer 40", "family": "Explorer"},
    "124270": {"brand": "Rolex", "model": "Explorer 36", "family": "Explorer"},
    "214270": {"brand": "Rolex", "model": "Explorer 39", "family": "Explorer"},
    "114270": {"brand": "Rolex", "model": "Explorer 36", "family": "Explorer"},
    "226570": {"brand": "Rolex", "model": "Explorer II", "family": "Explorer"},
    "216570": {"brand": "Rolex", "model": "Explorer II", "family": "Explorer"},
    "16570": {"brand": "Rolex", "model": "Explorer II", "family": "Explorer"},
    "1016": {"brand": "Rolex", "model": "Explorer Vintage", "family": "Explorer"},

    # Rolex Sea-Dweller / Deepsea
    "136660": {"brand": "Rolex", "model": "Sea-Dweller Deepsea", "family": "Sea-Dweller"},
    "126660": {"brand": "Rolex", "model": "Sea-Dweller Deepsea", "family": "Sea-Dweller"},
    "126600": {"brand": "Rolex", "model": "Sea-Dweller", "family": "Sea-Dweller"},
    "116660": {"brand": "Rolex", "model": "Sea-Dweller Deepsea", "family": "Sea-Dweller"},
    "16600": {"brand": "Rolex", "model": "Sea-Dweller", "family": "Sea-Dweller"},

    # Rolex Yacht-Master
    "226659": {"brand": "Rolex", "model": "Yacht-Master 42 White Gold", "family": "Yacht-Master"},
    "226658": {"brand": "Rolex", "model": "Yacht-Master 42 Yellow Gold", "family": "Yacht-Master"},
    "126621": {"brand": "Rolex", "model": "Yacht-Master 40 Two-Tone Rose", "family": "Yacht-Master"},
    "126622": {"brand": "Rolex", "model": "Yacht-Master 40 Steel/Platinum", "family": "Yacht-Master"},
    "116655": {"brand": "Rolex", "model": "Yacht-Master Everose Oysterflex", "family": "Yacht-Master"},
    "116681": {"brand": "Rolex", "model": "Yacht-Master II Two-Tone", "family": "Yacht-Master"},

    # Patek Philippe Nautilus
    "5711/1A": {"brand": "Patek Philippe", "model": "Nautilus", "family": "Nautilus"},
    "5711/1A-010": {"brand": "Patek Philippe", "model": "Nautilus Blue Dial", "family": "Nautilus"},
    "5711/1A-014": {"brand": "Patek Philippe", "model": "Nautilus Olive Green", "family": "Nautilus"},
    "5711/1R": {"brand": "Patek Philippe", "model": "Nautilus Rose Gold", "family": "Nautilus"},
    "5712/1A": {"brand": "Patek Philippe", "model": "Nautilus Power Reserve Moon Phase", "family": "Nautilus"},
    "5712R": {"brand": "Patek Philippe", "model": "Nautilus Rose Gold", "family": "Nautilus"},
    "5726/1A": {"brand": "Patek Philippe", "model": "Nautilus Annual Calendar", "family": "Nautilus"},
    "5726A": {"brand": "Patek Philippe", "model": "Nautilus Annual Calendar", "family": "Nautilus"},
    "5740/1G": {"brand": "Patek Philippe", "model": "Nautilus Perpetual Calendar", "family": "Nautilus"},
    "5990/1A": {"brand": "Patek Philippe", "model": "Nautilus Travel Time Chronograph", "family": "Nautilus"},
    "5980/1A": {"brand": "Patek Philippe", "model": "Nautilus Chronograph", "family": "Nautilus"},
    "5980R": {"brand": "Patek Philippe", "model": "Nautilus Chronograph Rose Gold", "family": "Nautilus"},
    "5811/1G": {"brand": "Patek Philippe", "model": "Nautilus White Gold", "family": "Nautilus"},

    # Patek Philippe Aquanaut
    "5167A": {"brand": "Patek Philippe", "model": "Aquanaut", "family": "Aquanaut"},
    "5167A-001": {"brand": "Patek Philippe", "model": "Aquanaut Black", "family": "Aquanaut"},
    "5167R": {"brand": "Patek Philippe", "model": "Aquanaut Rose Gold", "family": "Aquanaut"},
    "5168G": {"brand": "Patek Philippe", "model": "Aquanaut White Gold", "family": "Aquanaut"},
    "5968A": {"brand": "Patek Philippe", "model": "Aquanaut Chronograph", "family": "Aquanaut"},
    "5968G": {"brand": "Patek Philippe", "model": "Aquanaut Chronograph White Gold", "family": "Aquanaut"},
    "5968R": {"brand": "Patek Philippe", "model": "Aquanaut Chronograph Rose Gold", "family": "Aquanaut"},
    "5164A": {"brand": "Patek Philippe", "model": "Aquanaut Travel Time", "family": "Aquanaut"},
    "5164R": {"brand": "Patek Philippe", "model": "Aquanaut Travel Time Rose Gold", "family": "Aquanaut"},

    # Patek Philippe Calatrava & Others
    "5196G": {"brand": "Patek Philippe", "model": "Calatrava", "family": "Calatrava"},
    "5227G": {"brand": "Patek Philippe", "model": "Calatrava Officer", "family": "Calatrava"},
    "5296G": {"brand": "Patek Philippe", "model": "Calatrava", "family": "Calatrava"},
    "6006G": {"brand": "Patek Philippe", "model": "Calatrava", "family": "Calatrava"},
    "5205G": {"brand": "Patek Philippe", "model": "Annual Calendar", "family": "Complications"},
    "5146G": {"brand": "Patek Philippe", "model": "Annual Calendar", "family": "Complications"},
    "5270P": {"brand": "Patek Philippe", "model": "Perpetual Calendar Chronograph", "family": "Grand Complications"},
    "5320G": {"brand": "Patek Philippe", "model": "Perpetual Calendar", "family": "Grand Complications"},
    "5170G": {"brand": "Patek Philippe", "model": "Chronograph", "family": "Complications"},
    "5070G": {"brand": "Patek Philippe", "model": "Chronograph", "family": "Complications"},

    # Audemars Piguet Royal Oak
    "15500ST": {"brand": "Audemars Piguet", "model": "Royal Oak", "family": "Royal Oak"},
    "15500OR": {"brand": "Audemars Piguet", "model": "Royal Oak Rose Gold", "family": "Royal Oak"},
    "15202ST": {"brand": "Audemars Piguet", "model": "Royal Oak Jumbo Extra-Thin", "family": "Royal Oak"},
    "15202OR": {"brand": "Audemars Piguet", "model": "Royal Oak Jumbo Rose Gold", "family": "Royal Oak"},
    "15202IP": {"brand": "Audemars Piguet", "model": "Royal Oak Jumbo Titanium/Platinum", "family": "Royal Oak"},
    "15400ST": {"brand": "Audemars Piguet", "model": "Royal Oak", "family": "Royal Oak"},
    "15450ST": {"brand": "Audemars Piguet", "model": "Royal Oak 37mm", "family": "Royal Oak"},
    "26315ST": {"brand": "Audemars Piguet", "model": "Royal Oak Chronograph", "family": "Royal Oak"},
    "26331ST": {"brand": "Audemars Piguet", "model": "Royal Oak Chronograph", "family": "Royal Oak"},
    "26331OR": {"brand": "Audemars Piguet", "model": "Royal Oak Chronograph Rose Gold", "family": "Royal Oak"},
    "26574ST": {"brand": "Audemars Piguet", "model": "Royal Oak Perpetual Calendar", "family": "Royal Oak"},
    "26240ST": {"brand": "Audemars Piguet", "model": "Royal Oak Chronograph", "family": "Royal Oak"},
    "15510ST": {"brand": "Audemars Piguet", "model": "Royal Oak", "family": "Royal Oak"},
    "16202ST": {"brand": "Audemars Piguet", "model": "Royal Oak Jumbo", "family": "Royal Oak"},

    # Audemars Piguet Royal Oak Offshore
    "26470ST": {"brand": "Audemars Piguet", "model": "Royal Oak Offshore Chronograph", "family": "Royal Oak Offshore"},
    "26470OR": {"brand": "Audemars Piguet", "model": "Royal Oak Offshore Chronograph Rose Gold", "family": "Royal Oak Offshore"},
    "26405CE": {"brand": "Audemars Piguet", "model": "Royal Oak Offshore Chronograph Ceramic", "family": "Royal Oak Offshore"},
    "26238CE": {"brand": "Audemars Piguet", "model": "Royal Oak Offshore Chronograph Ceramic", "family": "Royal Oak Offshore"},
    "15710ST": {"brand": "Audemars Piguet", "model": "Royal Oak Offshore Diver", "family": "Royal Oak Offshore"},
    "15720ST": {"brand": "Audemars Piguet", "model": "Royal Oak Offshore Diver", "family": "Royal Oak Offshore"},

    # Omega Speedmaster
    "310.30.42.50.01.001": {"brand": "Omega", "model": "Speedmaster Moonwatch Professional", "family": "Speedmaster"},
    "310.30.42.50.01.002": {"brand": "Omega", "model": "Speedmaster Moonwatch Sapphire", "family": "Speedmaster"},
    "311.30.42.30.01.005": {"brand": "Omega", "model": "Speedmaster Moonwatch Professional", "family": "Speedmaster"},
    "311.30.42.30.01.006": {"brand": "Omega", "model": "Speedmaster Moonwatch Hesalite", "family": "Speedmaster"},
    "310.32.42.50.01.001": {"brand": "Omega", "model": "Speedmaster Moonwatch", "family": "Speedmaster"},
    "329.30.44.51.01.001": {"brand": "Omega", "model": "Speedmaster Racing", "family": "Speedmaster"},
    "304.30.44.52.01.001": {"brand": "Omega", "model": "Speedmaster Moonphase", "family": "Speedmaster"},
    "3570.50": {"brand": "Omega", "model": "Speedmaster Moonwatch", "family": "Speedmaster"},
    "145.022": {"brand": "Omega", "model": "Speedmaster Professional Vintage", "family": "Speedmaster"},
    "105.012": {"brand": "Omega", "model": "Speedmaster Ed White", "family": "Speedmaster"},

    # Omega Seamaster
    "210.30.42.20.01.001": {"brand": "Omega", "model": "Seamaster Diver 300M", "family": "Seamaster"},
    "210.30.42.20.03.001": {"brand": "Omega", "model": "Seamaster Diver 300M Blue", "family": "Seamaster"},
    "210.32.42.20.01.001": {"brand": "Omega", "model": "Seamaster Diver 300M", "family": "Seamaster"},
    "210.22.42.20.01.001": {"brand": "Omega", "model": "Seamaster Diver 300M Two-Tone", "family": "Seamaster"},
    "215.30.44.21.01.001": {"brand": "Omega", "model": "Seamaster Planet Ocean", "family": "Seamaster"},
    "220.10.41.21.01.001": {"brand": "Omega", "model": "Seamaster Aqua Terra", "family": "Seamaster"},
    "220.10.41.21.03.001": {"brand": "Omega", "model": "Seamaster Aqua Terra Blue", "family": "Seamaster"},
    "232.30.42.21.01.001": {"brand": "Omega", "model": "Seamaster Planet Ocean", "family": "Seamaster"},
    "2531.80": {"brand": "Omega", "model": "Seamaster Professional 300M", "family": "Seamaster"},
    "2254.50": {"brand": "Omega", "model": "Seamaster Planet Ocean", "family": "Seamaster"},

    # Vacheron Constantin
    "4500V/110A-B128": {"brand": "Vacheron Constantin", "model": "Overseas", "family": "Overseas"},
    "4500V/110A-B126": {"brand": "Vacheron Constantin", "model": "Overseas Blue", "family": "Overseas"},
    "4500V/110A-B483": {"brand": "Vacheron Constantin", "model": "Overseas Green", "family": "Overseas"},
    "5500V/110A-B148": {"brand": "Vacheron Constantin", "model": "Overseas Chronograph", "family": "Overseas"},
    "7900V/110A-B334": {"brand": "Vacheron Constantin", "model": "Overseas Perpetual Calendar Ultra-Thin", "family": "Overseas"},
    "47040/000W-9500": {"brand": "Vacheron Constantin", "model": "Overseas Chronograph", "family": "Overseas"},
    "85180/000G-9230": {"brand": "Vacheron Constantin", "model": "Patrimony", "family": "Patrimony"},
    "81180/000G-9117": {"brand": "Vacheron Constantin", "model": "Patrimony", "family": "Patrimony"},
    "43175/000R-9687": {"brand": "Vacheron Constantin", "model": "Traditionnelle", "family": "Traditionnelle"},

    # A. Lange & Söhne
    "191.032": {"brand": "A. Lange & Söhne", "model": "Lange 1", "family": "Lange 1"},
    "191.039": {"brand": "A. Lange & Söhne", "model": "Lange 1 White Gold", "family": "Lange 1"},
    "117.028": {"brand": "A. Lange & Söhne", "model": "Saxonia", "family": "Saxonia"},
    "380.033": {"brand": "A. Lange & Söhne", "model": "Odysseus", "family": "Odysseus"},
    "363.068": {"brand": "A. Lange & Söhne", "model": "Odysseus", "family": "Odysseus"},
    "403.035": {"brand": "A. Lange & Söhne", "model": "Datograph", "family": "Datograph"},
    "405.031": {"brand": "A. Lange & Söhne", "model": "Datograph Up/Down", "family": "Datograph"},
    "722.050": {"brand": "A. Lange & Söhne", "model": "Zeitwerk", "family": "Zeitwerk"},

    # IWC
    "IW377714": {"brand": "IWC", "model": "Pilot's Chronograph", "family": "Pilot"},
    "IW388101": {"brand": "IWC", "model": "Pilot's Chronograph Top Gun", "family": "Pilot"},
    "IW388111": {"brand": "IWC", "model": "Pilot's Chronograph Top Gun Mojave", "family": "Pilot"},
    "IW329303": {"brand": "IWC", "model": "Pilot's Automatic", "family": "Pilot"},
    "IW501001": {"brand": "IWC", "model": "Big Pilot", "family": "Pilot"},
    "IW501014": {"brand": "IWC", "model": "Big Pilot", "family": "Pilot"},
    "IW371609": {"brand": "IWC", "model": "Portugieser Chronograph", "family": "Portugieser"},
    "IW371605": {"brand": "IWC", "model": "Portugieser Chronograph", "family": "Portugieser"},
    "IW500714": {"brand": "IWC", "model": "Portugieser Automatic", "family": "Portugieser"},
    "IW390701": {"brand": "IWC", "model": "Portugieser Yacht Club Chronograph", "family": "Portugieser"},

    # Jaeger-LeCoultre
    "Q1368420": {"brand": "Jaeger-LeCoultre", "model": "Master Ultra Thin Moon", "family": "Master"},
    "Q1368470": {"brand": "Jaeger-LeCoultre", "model": "Master Ultra Thin Moon", "family": "Master"},
    "Q1288420": {"brand": "Jaeger-LeCoultre", "model": "Master Control Date", "family": "Master"},
    "Q3828420": {"brand": "Jaeger-LeCoultre", "model": "Reverso Classic", "family": "Reverso"},
    "Q3858520": {"brand": "Jaeger-LeCoultre", "model": "Reverso Tribute", "family": "Reverso"},
    "Q2028440": {"brand": "Jaeger-LeCoultre", "model": "Polaris", "family": "Polaris"},
    "Q9028180": {"brand": "Jaeger-LeCoultre", "model": "Polaris Chronograph", "family": "Polaris"},

    # Cartier
    "WSSA0018": {"brand": "Cartier", "model": "Santos de Cartier Medium", "family": "Santos"},
    "WSSA0029": {"brand": "Cartier", "model": "Santos de Cartier Large", "family": "Santos"},
    "WSSA0030": {"brand": "Cartier", "model": "Santos de Cartier Large", "family": "Santos"},
    "WSSA0009": {"brand": "Cartier", "model": "Santos de Cartier", "family": "Santos"},
    "W2SA0016": {"brand": "Cartier", "model": "Santos de Cartier Two-Tone", "family": "Santos"},
    "WSBB0026": {"brand": "Cartier", "model": "Tank Must", "family": "Tank"},
    "WSTA0040": {"brand": "Cartier", "model": "Tank Must Large", "family": "Tank"},
    "W5200014": {"brand": "Cartier", "model": "Tank Solo", "family": "Tank"},

    # Tudor
    "M79360N-0001": {"brand": "Tudor", "model": "Black Bay Chrono", "family": "Black Bay"},
    "M79360N-0002": {"brand": "Tudor", "model": "Black Bay Chrono Panda", "family": "Black Bay"},
    "M79230N-0009": {"brand": "Tudor", "model": "Black Bay", "family": "Black Bay"},
    "M79230B-0008": {"brand": "Tudor", "model": "Black Bay Blue", "family": "Black Bay"},
    "M79230R-0012": {"brand": "Tudor", "model": "Black Bay Red", "family": "Black Bay"},
    "M79000N-0002": {"brand": "Tudor", "model": "Black Bay 41", "family": "Black Bay"},
    "M79830RB-0001": {"brand": "Tudor", "model": "Black Bay GMT", "family": "Black Bay"},
    "M25600TN-0001": {"brand": "Tudor", "model": "Pelagos", "family": "Pelagos"},
    "M25600TB-0001": {"brand": "Tudor", "model": "Pelagos Blue", "family": "Pelagos"},
    "M25500TN-0001": {"brand": "Tudor", "model": "Pelagos FXD", "family": "Pelagos"},
    "M28500-0001": {"brand": "Tudor", "model": "Ranger", "family": "Ranger"},
    "M28500-0002": {"brand": "Tudor", "model": "Ranger", "family": "Ranger"},

    # Panerai
    "PAM01312": {"brand": "Panerai", "model": "Luminor Marina", "family": "Luminor"},
    "PAM01314": {"brand": "Panerai", "model": "Luminor Marina Blue", "family": "Luminor"},
    "PAM01392": {"brand": "Panerai", "model": "Luminor Due", "family": "Luminor"},
    "PAM01537": {"brand": "Panerai", "model": "Luminor Marina Carbotech", "family": "Luminor"},
    "PAM01080": {"brand": "Panerai", "model": "Submersible", "family": "Submersible"},
    "PAM01024": {"brand": "Panerai", "model": "Submersible", "family": "Submersible"},
    "PAM00000": {"brand": "Panerai", "model": "Luminor Base Logo", "family": "Luminor"},
    "PAM00111": {"brand": "Panerai", "model": "Luminor Marina", "family": "Luminor"},
    "PAM00560": {"brand": "Panerai", "model": "Radiomir 1940", "family": "Radiomir"},

    # Hublot
    "411.NM.1170.RX": {"brand": "Hublot", "model": "Big Bang Unico", "family": "Big Bang"},
    "411.CI.1170.RX": {"brand": "Hublot", "model": "Big Bang Unico Ceramic", "family": "Big Bang"},
    "411.OX.1180.RX": {"brand": "Hublot", "model": "Big Bang Unico King Gold", "family": "Big Bang"},
    "521.NX.1171.LR": {"brand": "Hublot", "model": "Classic Fusion", "family": "Classic Fusion"},
    "542.NX.1171.LR": {"brand": "Hublot", "model": "Classic Fusion Chronograph", "family": "Classic Fusion"},
    "601.NX.0173.LR": {"brand": "Hublot", "model": "Spirit of Big Bang", "family": "Spirit of Big Bang"},

    # Breitling
    "AB0127211B1A1": {"brand": "Breitling", "model": "Navitimer B01", "family": "Navitimer"},
    "AB0137211B1A1": {"brand": "Breitling", "model": "Navitimer B01 46", "family": "Navitimer"},
    "AB0138211B1A1": {"brand": "Breitling", "model": "Navitimer B01 43", "family": "Navitimer"},
    "A17318101B1A1": {"brand": "Breitling", "model": "Superocean Heritage", "family": "Superocean"},
    "A17375211B1A1": {"brand": "Breitling", "model": "Superocean Heritage 57", "family": "Superocean"},
    "M13313121B1A1": {"brand": "Breitling", "model": "Super Chronomat", "family": "Chronomat"},
    "AB0136251B1A1": {"brand": "Breitling", "model": "Chronomat B01", "family": "Chronomat"},
    "AB2010161B1A1": {"brand": "Breitling", "model": "Premier B01", "family": "Premier"},
}


def identify_watch_from_reference(reference: str) -> Optional[dict]:
    """Identify a watch from its reference number"""
    ref_upper = reference.upper().strip()

    # Direct match
    if ref_upper in WATCH_REFERENCE_DATABASE:
        return WATCH_REFERENCE_DATABASE[ref_upper]

    # Try without dashes/slashes for partial matching
    ref_normalized = ref_upper.replace("-", "").replace("/", "").replace(" ", "")
    for db_ref, info in WATCH_REFERENCE_DATABASE.items():
        db_normalized = db_ref.replace("-", "").replace("/", "").replace(" ", "")
        if db_normalized == ref_normalized or ref_normalized in db_normalized or db_normalized in ref_normalized:
            return info

    return None


class WatchReference(BaseModel):
    brand: Optional[str] = None
    model: Optional[str] = None
    reference: Optional[str] = None


class SellerInfo(BaseModel):
    name: str
    contact: Optional[str] = None
    price: Optional[float] = None
    currency: str = "EUR"
    condition: Optional[str] = None
    source: str  # "order" or "whatsapp"
    message_date: Optional[datetime] = None


class MarketData(BaseModel):
    brand: Optional[str] = None
    model: Optional[str] = None
    reference: Optional[str] = None
    avg_price: Optional[float] = None
    min_price: Optional[float] = None
    max_price: Optional[float] = None
    active_orders_count: int = 0
    whatsapp_listings_count: int = 0


class ConversationMessage(BaseModel):
    content: str
    is_user: bool


class AssistantQueryRequest(BaseModel):
    message: str
    intent: Optional[str] = None  # "buy", "sell", or None for detection
    conversation_history: Optional[List[ConversationMessage]] = None  # Previous messages for context


class AssistantQueryResponse(BaseModel):
    detected_intent: Optional[str] = None  # "buy", "sell", "info", or None
    detected_watches: List[WatchReference] = []
    market_data: Optional[MarketData] = None
    available_sellers: List[SellerInfo] = []
    suggested_response: str
    requires_clarification: bool = False
    clarification_options: List[str] = []


def detect_watch_reference(text: str) -> Optional[WatchReference]:
    """Detect watch brand/model/reference from text"""
    text_lower = text.lower()

    # Find brand from text
    brand = None
    model = None
    for b in WATCH_BRANDS:
        if b in text_lower:
            # Map model names to brands
            if b in ["submariner", "daytona", "gmt-master", "datejust", "day-date"]:
                brand = "Rolex"
                model = b.title().replace("-", " ")
            elif b in ["nautilus", "aquanaut"]:
                brand = "Patek Philippe"
                model = b.title()
            elif b in ["royal oak"]:
                brand = "Audemars Piguet"
                model = "Royal Oak"
            elif b in ["speedmaster", "seamaster"]:
                brand = "Omega"
                model = b.title()
            elif b == "patek philippe" or b == "patek":
                brand = "Patek Philippe"
            elif b == "audemars piguet" or b == "ap":
                brand = "Audemars Piguet"
            elif b == "richard mille" or b == "rm":
                brand = "Richard Mille"
            elif b == "jaeger-lecoultre" or b == "jlc":
                brand = "Jaeger-LeCoultre"
            elif b == "vacheron constantin" or b == "vc":
                brand = "Vacheron Constantin"
            elif b == "tag heuer":
                brand = "TAG Heuer"
            else:
                brand = b.title()
            break

    # Find reference number in text
    reference = None
    for pattern in REF_PATTERNS:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            ref = match.group(1).upper()
            # Skip if too short or doesn't look like a reference
            if len(ref) >= 4 and any(c.isdigit() for c in ref):
                reference = ref
                break

    # If we found a reference but no brand, try to identify from our database
    if reference and not brand:
        watch_info = identify_watch_from_reference(reference)
        if watch_info:
            brand = watch_info.get("brand")
            model = watch_info.get("model")
            return WatchReference(brand=brand, model=model, reference=reference)

    # If no brand was found in text and no reference identified, try to find any reference-like pattern
    if not brand and not reference:
        # Try more aggressive reference pattern matching
        aggressive_patterns = [
            r'\b([A-Z0-9]{5,15})\b',  # Any alphanumeric 5-15 chars
            r'\b(\d{4,6}[A-Z]{0,4})\b',  # Numbers followed by optional letters
            r'\b([A-Z]{1,3}\d{4,6}[A-Z0-9/-]*)\b',  # Letters + numbers + optional suffix
        ]
        for pattern in aggressive_patterns:
            matches = re.findall(pattern, text, re.IGNORECASE)
            for match in matches:
                ref_candidate = match.upper()
                watch_info = identify_watch_from_reference(ref_candidate)
                if watch_info:
                    return WatchReference(
                        brand=watch_info.get("brand"),
                        model=watch_info.get("model"),
                        reference=ref_candidate
                    )

    if not brand:
        return None

    return WatchReference(brand=brand, model=model, reference=reference)


def detect_intent(text: str) -> Optional[str]:
    """Detect if user wants to buy or sell"""
    text_lower = text.lower()

    buy_keywords = ["buy", "buying", "purchase", "looking for", "want to get", "interested in buying", "where can i find", "looking to buy", "want a", "i need", "available", "in stock", "any available", "is available", "can i get", "can i find", "do you have", "have any", "got any", "i want to buy"]
    sell_keywords = ["sell", "selling", "list", "want to sell", "looking to sell", "get rid of", "i want to sell"]
    info_keywords = ["price", "worth", "value", "market", "trend", "how much", "what's the", "tell me about", "info about", "information", "just want information"]

    for keyword in sell_keywords:
        if keyword in text_lower:
            return "sell"

    for keyword in buy_keywords:
        if keyword in text_lower:
            return "buy"

    for keyword in info_keywords:
        if keyword in text_lower:
            return "info"

    return None


def detect_affirmative_response(text: str) -> bool:
    """Detect if user is giving an affirmative response"""
    text_lower = text.lower().strip()
    affirmative_keywords = ["yes", "yeah", "yep", "sure", "ok", "okay", "please", "go ahead", "do it", "sounds good", "great", "perfect", "absolutely", "definitely", "of course", "yes please", "yea", "ya", "yup"]

    for keyword in affirmative_keywords:
        if text_lower == keyword or text_lower.startswith(keyword + " ") or text_lower.startswith(keyword + ",") or text_lower.startswith(keyword + "."):
            return True
    return False


@router.post("/assistant/query", response_model=AssistantQueryResponse)
async def query_assistant(
    request: AssistantQueryRequest,
    current_user: User = Depends(get_current_user),
) -> Any:
    """Query the AI assistant with watch-related data context"""

    message = request.message
    intent = request.intent or detect_intent(message)
    watch_ref = detect_watch_reference(message)

    # If no watch detected in current message, check conversation history for context
    if not watch_ref and request.conversation_history:
        for prev_msg in request.conversation_history:
            if prev_msg.is_user:
                watch_ref = detect_watch_reference(prev_msg.content)
                if watch_ref:
                    break

    # If no intent detected but user gave an affirmative response, check conversation history for context
    if not intent and detect_affirmative_response(message) and request.conversation_history:
        # Check if the last AI message asked about buy/sell/info
        for prev_msg in reversed(request.conversation_history):
            if not prev_msg.is_user:
                msg_lower = prev_msg.content.lower()
                # Check if AI asked about buying or selling
                if "are you looking to buy or sell" in msg_lower or "would you like to buy" in msg_lower:
                    # Default to info if just saying yes to the question
                    intent = "info"
                    break
                elif "add this watch to your watchlist" in msg_lower or "add it to your watchlist" in msg_lower:
                    intent = "info"
                    break
            else:
                # Check if user previously mentioned buy/sell intent
                user_intent = detect_intent(prev_msg.content)
                if user_intent:
                    intent = user_intent
                    break

    # If no watch detected and no clear intent, ask for clarification
    if not watch_ref and not intent:
        return {
            "detected_intent": None,
            "detected_watches": [],
            "market_data": None,
            "available_sellers": [],
            "suggested_response": "I'd be happy to help you with watch information. Could you tell me which specific watch model or brand you're interested in? For example, you could ask about a Rolex Submariner, Patek Philippe Nautilus, or any other timepiece.",
            "requires_clarification": False,
            "clarification_options": [],
        }

    # If watch detected but no clear intent, ask if they want to buy or sell
    if watch_ref and not intent:
        watch_name = f"{watch_ref.brand}"
        if watch_ref.model:
            watch_name += f" {watch_ref.model}"
        if watch_ref.reference:
            watch_name += f" ({watch_ref.reference})"

        return {
            "detected_intent": None,
            "detected_watches": [watch_ref],
            "market_data": None,
            "available_sellers": [],
            "suggested_response": f"I see you're interested in the **{watch_name}**. Are you looking to buy or sell this watch?",
            "requires_clarification": True,
            "clarification_options": ["I want to buy", "I want to sell", "Just want information"],
        }

    # Gather market data
    market_data = MarketData()
    available_sellers: List[SellerInfo] = []

    if watch_ref:
        market_data.brand = watch_ref.brand
        market_data.model = watch_ref.model
        market_data.reference = watch_ref.reference

        # Search active orders in database
        try:
            # Build MongoDB query for orders
            order_query = {
                "order_type": OrderType.SELL.value,
                "status": OrderStatus.ACTIVE.value,
            }
            if watch_ref.brand:
                order_query["brand"] = {"$regex": watch_ref.brand, "$options": "i"}
            if watch_ref.reference:
                order_query["reference"] = {"$regex": watch_ref.reference, "$options": "i"}

            orders = await Order.find(order_query).limit(20).to_list()
            market_data.active_orders_count = len(orders)

            if orders:
                prices = [o.price for o in orders if o.price]
                if prices:
                    market_data.avg_price = sum(prices) / len(prices)
                    market_data.min_price = min(prices)
                    market_data.max_price = max(prices)

                # Add sellers from orders
                for order in orders[:5]:  # Top 5 sellers
                    user = None
                    if order.user_id:
                        try:
                            user = await User.get(PydanticObjectId(order.user_id))
                        except Exception:
                            pass
                    available_sellers.append(SellerInfo(
                        name=user.name if user else (order.user_name or "Anonymous"),
                        price=order.price,
                        currency=order.currency or "EUR",
                        condition=order.condition.value if order.condition else None,
                        source="order",
                    ))
        except Exception as e:
            print(f"Error searching orders: {e}")

        # Search WhatsApp imported listings
        wa_conditions = []
        if watch_ref.brand:
            wa_conditions.append({"brand": {"$regex": watch_ref.brand, "$options": "i"}})
        if watch_ref.reference:
            wa_conditions.append({"reference": {"$regex": watch_ref.reference, "$options": "i"}})

        try:
            if wa_conditions:
                wa_listings = await ExtractedWatchListing.find(*wa_conditions).sort([("message_timestamp", -1)]).limit(20).to_list()
            else:
                wa_listings = []

            market_data.whatsapp_listings_count = len(wa_listings)

            # Add sellers from WhatsApp
            for listing in wa_listings[:10]:  # Top 10 WhatsApp contacts
                if listing.seller_name:
                    available_sellers.append(SellerInfo(
                        name=listing.seller_name,
                        price=listing.price,
                        currency=listing.currency or "EUR",
                        condition=listing.condition,
                        source="whatsapp",
                        message_date=listing.message_timestamp,
                    ))
        except Exception as e:
            print(f"Error searching WhatsApp listings: {e}")

    # Generate response based on intent
    if intent == "buy":
        if available_sellers:
            watch_name = f"{watch_ref.brand if watch_ref else 'the watch'}"
            if watch_ref and watch_ref.model:
                watch_name += f" {watch_ref.model}"

            seller_list = []
            for seller in available_sellers[:5]:
                price_str = f"€{seller.price:,.0f}" if seller.price else "Price on request"
                source_label = "📱 WhatsApp" if seller.source == "whatsapp" else "🏪 Market"
                seller_list.append(f"• **{seller.name}** - {price_str} ({source_label})")

            response = f"Great! I found some sellers for the **{watch_name}**:\n\n" + "\n".join(seller_list)

            if market_data.avg_price:
                response += f"\n\n**Market Overview:**\n• Average price: €{market_data.avg_price:,.0f}\n• Range: €{market_data.min_price:,.0f} - €{market_data.max_price:,.0f}"

            response += "\n\nWould you like me to help you connect with any of these sellers?"
        else:
            response = f"I don't have any active listings for the **{watch_ref.brand if watch_ref else 'watch'}** at the moment, but I can keep you posted if anything comes up. Would you like to add this watch to your watchlist?"

    elif intent == "sell":
        watch_name = f"{watch_ref.brand if watch_ref else 'your watch'}"
        if watch_ref and watch_ref.model:
            watch_name += f" {watch_ref.model}"

        if market_data.avg_price:
            response = f"Looking to sell your **{watch_name}**? Here's what I know about the current market:\n\n**Current Market:**\n• Average selling price: €{market_data.avg_price:,.0f}\n• Price range: €{market_data.min_price:,.0f} - €{market_data.max_price:,.0f}\n• Active listings: {market_data.active_orders_count}\n\nWould you like to create a sell order? I can help you list it at a competitive price."
        else:
            response = f"I can help you list your **{watch_name}** for sale. To create a listing, you'll need to provide:\n\n1. Watch condition\n2. Box & papers availability\n3. Your asking price\n4. Photos\n\nWould you like to start creating a listing?"

    else:  # info intent
        watch_name = f"{watch_ref.brand if watch_ref else 'the watch'}"
        if watch_ref and watch_ref.model:
            watch_name += f" {watch_ref.model}"

        if market_data.avg_price:
            response = f"Here's what I know about the **{watch_name}**:\n\n**Market Data:**\n• Average price: €{market_data.avg_price:,.0f}\n• Price range: €{market_data.min_price:,.0f} - €{market_data.max_price:,.0f}\n• Active listings: {market_data.active_orders_count}\n• WhatsApp market activity: {market_data.whatsapp_listings_count} recent mentions"
        else:
            response = f"I have the **{watch_name}** on record, but I don't have current market data available. Would you like me to search for more information or add it to your watchlist?"

    return {
        "detected_intent": intent,
        "detected_watches": [watch_ref] if watch_ref else [],
        "market_data": market_data if watch_ref else None,
        "available_sellers": available_sellers,
        "suggested_response": response,
        "requires_clarification": False,
        "clarification_options": [],
    }


@router.get("/assistant/search-sellers")
async def search_sellers(
    brand: Optional[str] = None,
    reference: Optional[str] = None,
    model: Optional[str] = None,
    current_user: User = Depends(get_current_user),
) -> Any:
    """Search for sellers of a specific watch"""

    sellers: List[dict] = []

    # Search orders using MongoDB query
    order_query = {
        "order_type": OrderType.SELL.value,
        "status": OrderStatus.ACTIVE.value,
    }
    if brand:
        order_query["brand"] = {"$regex": brand, "$options": "i"}
    if reference:
        order_query["reference"] = {"$regex": reference, "$options": "i"}
    if model:
        order_query["model"] = {"$regex": model, "$options": "i"}

    try:
        orders = await Order.find(order_query).limit(20).to_list()
        for order in orders:
            user = None
            if order.user_id:
                try:
                    user = await User.get(PydanticObjectId(order.user_id))
                except Exception:
                    pass
            sellers.append({
                "name": user.name if user else (order.user_name or "Anonymous"),
                "price": order.price,
                "currency": order.currency or "EUR",
                "condition": order.condition.value if order.condition else None,
                "source": "market",
                "listing_id": str(order.id),
            })
    except Exception:
        pass

    # Search WhatsApp
    wa_query = {}
    if brand:
        wa_query["brand"] = {"$regex": brand, "$options": "i"}
    if reference:
        wa_query["reference"] = {"$regex": reference, "$options": "i"}

    try:
        if wa_query:
            wa_listings = await ExtractedWatchListing.find(wa_query).sort([("message_timestamp", -1)]).limit(20).to_list()
            for listing in wa_listings:
                if listing.seller_name:
                    sellers.append({
                        "name": listing.seller_name,
                        "price": listing.price,
                        "currency": listing.currency or "USD",
                        "condition": listing.condition,
                        "source": "whatsapp",
                        "message_date": listing.message_timestamp.isoformat() if listing.message_timestamp else None,
                    })
    except Exception:
        pass

    return {
        "count": len(sellers),
        "sellers": sellers,
    }
