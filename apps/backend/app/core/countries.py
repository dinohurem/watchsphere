"""Single source of truth for country names (ISO 3166-1 alpha-2).

Rule: always the full common English name, never the two-letter code. Only two
short forms are allowed: United Arab Emirates -> "UAE", United Kingdom -> "UK".
Everything else is written out, also "United States".

The app stores ``UK`` (generator) as well as ``GB`` (ISO), and old data has
``UAE``/``USA``/``EL``; ``canonical_country_code`` folds those to the ISO code.
"""
from typing import Optional

# Aliases seen in generator CSVs / old data -> ISO alpha-2.
COUNTRY_CODE_ALIASES: dict[str, str] = {"UK": "GB", "UAE": "AE", "USA": "US", "EL": "GR"}

COUNTRY_NAMES: dict[str, str] = {
    "AD": "Andorra", "AE": "UAE", "AF": "Afghanistan", "AG": "Antigua and Barbuda",
    "AI": "Anguilla", "AL": "Albania", "AM": "Armenia", "AO": "Angola", "AQ": "Antarctica",
    "AR": "Argentina", "AS": "American Samoa", "AT": "Austria", "AU": "Australia", "AW": "Aruba",
    "AX": "Aland Islands", "AZ": "Azerbaijan", "BA": "Bosnia and Herzegovina", "BB": "Barbados",
    "BD": "Bangladesh", "BE": "Belgium", "BF": "Burkina Faso", "BG": "Bulgaria", "BH": "Bahrain",
    "BI": "Burundi", "BJ": "Benin", "BL": "Saint Barthelemy", "BM": "Bermuda", "BN": "Brunei",
    "BO": "Bolivia", "BQ": "Caribbean Netherlands", "BR": "Brazil", "BS": "Bahamas", "BT": "Bhutan",
    "BV": "Bouvet Island", "BW": "Botswana", "BY": "Belarus", "BZ": "Belize", "CA": "Canada",
    "CC": "Cocos Islands", "CD": "DR Congo", "CF": "Central African Republic", "CG": "Congo",
    "CH": "Switzerland", "CI": "Ivory Coast", "CK": "Cook Islands", "CL": "Chile", "CM": "Cameroon",
    "CN": "China", "CO": "Colombia", "CR": "Costa Rica", "CU": "Cuba", "CV": "Cape Verde",
    "CW": "Curacao", "CX": "Christmas Island", "CY": "Cyprus", "CZ": "Czech Republic",
    "DE": "Germany", "DJ": "Djibouti", "DK": "Denmark", "DM": "Dominica",
    "DO": "Dominican Republic", "DZ": "Algeria", "EC": "Ecuador", "EE": "Estonia", "EG": "Egypt",
    "EH": "Western Sahara", "ER": "Eritrea", "ES": "Spain", "ET": "Ethiopia", "FI": "Finland",
    "FJ": "Fiji", "FK": "Falkland Islands", "FM": "Micronesia", "FO": "Faroe Islands",
    "FR": "France", "GA": "Gabon", "GB": "UK", "GD": "Grenada", "GE": "Georgia",
    "GF": "French Guiana", "GG": "Guernsey", "GH": "Ghana", "GI": "Gibraltar", "GL": "Greenland",
    "GM": "Gambia", "GN": "Guinea", "GP": "Guadeloupe", "GQ": "Equatorial Guinea", "GR": "Greece",
    "GS": "South Georgia and the South Sandwich Islands", "GT": "Guatemala", "GU": "Guam",
    "GW": "Guinea-Bissau", "GY": "Guyana", "HK": "Hong Kong",
    "HM": "Heard Island and McDonald Islands",
    "HN": "Honduras", "HR": "Croatia", "HT": "Haiti", "HU": "Hungary", "ID": "Indonesia",
    "IE": "Ireland", "IL": "Israel", "IM": "Isle of Man", "IN": "India",
    "IO": "British Indian Ocean Territory", "IQ": "Iraq", "IR": "Iran", "IS": "Iceland",
    "IT": "Italy", "JE": "Jersey", "JM": "Jamaica", "JO": "Jordan", "JP": "Japan", "KE": "Kenya",
    "KG": "Kyrgyzstan", "KH": "Cambodia", "KI": "Kiribati", "KM": "Comoros",
    "KN": "Saint Kitts and Nevis", "KP": "North Korea", "KR": "South Korea", "KW": "Kuwait",
    "KY": "Cayman Islands", "KZ": "Kazakhstan", "LA": "Laos", "LB": "Lebanon", "LC": "Saint Lucia",
    "LI": "Liechtenstein", "LK": "Sri Lanka", "LR": "Liberia", "LS": "Lesotho", "LT": "Lithuania",
    "LU": "Luxembourg", "LV": "Latvia", "LY": "Libya", "MA": "Morocco", "MC": "Monaco",
    "MD": "Moldova", "ME": "Montenegro", "MF": "Saint Martin", "MG": "Madagascar",
    "MH": "Marshall Islands", "MK": "North Macedonia", "ML": "Mali", "MM": "Myanmar",
    "MN": "Mongolia", "MO": "Macau", "MP": "Northern Mariana Islands", "MQ": "Martinique",
    "MR": "Mauritania", "MS": "Montserrat", "MT": "Malta", "MU": "Mauritius", "MV": "Maldives",
    "MW": "Malawi", "MX": "Mexico", "MY": "Malaysia", "MZ": "Mozambique", "NA": "Namibia",
    "NC": "New Caledonia", "NE": "Niger", "NF": "Norfolk Island", "NG": "Nigeria",
    "NI": "Nicaragua", "NL": "Netherlands", "NO": "Norway", "NP": "Nepal", "NR": "Nauru",
    "NU": "Niue", "NZ": "New Zealand", "OM": "Oman", "PA": "Panama", "PE": "Peru",
    "PF": "French Polynesia", "PG": "Papua New Guinea", "PH": "Philippines", "PK": "Pakistan",
    "PL": "Poland", "PM": "Saint Pierre and Miquelon", "PN": "Pitcairn Islands",
    "PR": "Puerto Rico", "PS": "Palestine", "PT": "Portugal", "PW": "Palau", "PY": "Paraguay",
    "QA": "Qatar", "RE": "Reunion", "RO": "Romania", "RS": "Serbia", "RU": "Russia",
    "RW": "Rwanda", "SA": "Saudi Arabia", "SB": "Solomon Islands", "SC": "Seychelles",
    "SD": "Sudan", "SE": "Sweden", "SG": "Singapore", "SH": "Saint Helena", "SI": "Slovenia",
    "SJ": "Svalbard and Jan Mayen", "SK": "Slovakia", "SL": "Sierra Leone", "SM": "San Marino",
    "SN": "Senegal", "SO": "Somalia", "SR": "Suriname", "SS": "South Sudan",
    "ST": "Sao Tome and Principe", "SV": "El Salvador", "SX": "Sint Maarten", "SY": "Syria",
    "SZ": "Eswatini", "TC": "Turks and Caicos Islands", "TD": "Chad",
    "TF": "French Southern Territories", "TG": "Togo", "TH": "Thailand", "TJ": "Tajikistan",
    "TK": "Tokelau", "TL": "Timor-Leste", "TM": "Turkmenistan", "TN": "Tunisia", "TO": "Tonga",
    "TR": "Turkey", "TT": "Trinidad and Tobago", "TV": "Tuvalu", "TW": "Taiwan",
    "TZ": "Tanzania", "UA": "Ukraine", "UG": "Uganda",
    "UM": "United States Minor Outlying Islands", "US": "United States", "UY": "Uruguay",
    "UZ": "Uzbekistan", "VA": "Vatican City", "VC": "Saint Vincent and the Grenadines",
    "VE": "Venezuela", "VG": "British Virgin Islands", "VI": "US Virgin Islands",
    "VN": "Vietnam", "VU": "Vanuatu", "WF": "Wallis and Futuna", "WS": "Samoa", "YE": "Yemen",
    "YT": "Mayotte", "ZA": "South Africa", "ZM": "Zambia", "ZW": "Zimbabwe",
    # Not ISO-assigned but in common use (Kosovo).
    "XK": "Kosovo",
}


def canonical_country_code(code: Optional[str]) -> str:
    """Upper-cased ISO alpha-2 code; UK/UAE/USA/EL fold to GB/AE/US/GR. '' for empty."""
    c = (code or "").strip().upper()
    return COUNTRY_CODE_ALIASES.get(c, c)


def country_display_name(code: Optional[str]) -> Optional[str]:
    """Full country name for a code (UAE and UK are the only short forms); None if unknown."""
    return COUNTRY_NAMES.get(canonical_country_code(code))


def is_code_like(value: Optional[str]) -> bool:
    """True for an empty value or a 2-3 letter all-caps code ('CN', 'UK', 'UAE')."""
    v = (value or "").strip()
    return not v or (v.isalpha() and v.isupper() and len(v) <= 3)
