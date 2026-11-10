"""Remark rules for the WTS/WTB generator (generator spec §6 + appendix A).

The editable part (remarks, triggers, aftermarket triggers, places) is stored in
MongoDB (``RemarkRule`` / ``RemarkPlace``), seeded from the defaults below, and
loaded at the start of every generator run with ``load_remark_config()``.
Remarks that carry a number stay in code (``numeric_remarks``): links,
Serviced + year, LC number, discount %, Wood Card from W + month.

Everything here is pure except the two loaders, so the generator's sync worker
can use a ``RemarkConfig`` without touching the database.
"""
from __future__ import annotations

import logging
import re
import unicodedata
from dataclasses import dataclass, field
from typing import Iterable, Optional

logger = logging.getLogger(__name__)


# --- Appendix A defaults ------------------------------------------------------
# (remark, category, mode, triggers). Order = display order in the remarks column.

CAT_SET = "Set and papers"
CAT_ORIGIN = "Origin of papers"
CAT_BRACELET = "Bracelet"
CAT_CONDITION = "Condition and service"
CAT_PRICE = "Price, tax, shipping, payment"
CAT_AVAILABILITY = "Availability and location"

DEFAULT_CATEGORIES = [CAT_SET, CAT_ORIGIN, CAT_BRACELET, CAT_CONDITION, CAT_PRICE, CAT_AVAILABILITY]

DEFAULT_REMARK_RULES: list[tuple[str, str, str, list[str]]] = [
    # Set and papers
    ("fullset", CAT_SET, "BOTH", ["full set", "fullset", "complete set", "box+paper", "box & paper", "box and papers"]),
    ("only watch", CAT_SET, "BOTH", ["only watch", "watch only", "single watch", "naked", "nake", "no paper", "no papers"]),
    ("Watch + Card", CAT_SET, "BOTH", ["w+c", "w&c", "w & c", "watch and card", "watch & card", "watch & card only",
                                       "card only", "only card", "only certificate"]),
    ("Watch + Papers", CAT_SET, "BOTH", ["w+p", "w&p", "watch and papers", "watch & paper", "watch & papers",
                                         "paper and watch", "watch and paper only", "paper only", "only paper"]),
    ("white tag", CAT_SET, "BOTH", ["white tag", "both tag", "both tags", "bothtag"]),
    ("full sticker", CAT_SET, "BOTH", ["full sticker", "full stickers", "fullsticker", "fullstickers", "factory stickers"]),
    ("Partial Stickers", CAT_SET, "BOTH", ["partial stickers", "partial sticker", "part stickers"]),
    ("NFC Card", CAT_SET, "BOTH", ["nfc card", "nfc"]),
    ("Open Date", CAT_SET, "BOTH", ["open date", "open card"]),
    ("Blank Paper", CAT_SET, "BOTH", ["blank paper", "blank card", "blank warranty card", "blank certificate",
                                      "blank date", "card blank"]),
    ("New Card", CAT_SET, "BOTH", ["new card"]),
    ("New Paper", CAT_SET, "BOTH", ["new paper", "new papers", "new certificate", "new cert", "new warranty paper"]),
    ("Old Card", CAT_SET, "BOTH", ["old card"]),
    ("Wood Card", CAT_SET, "BOTH", ["wood card", "wooden card", "🪵"]),
    ("Hold Paper", CAT_SET, "BOTH", ["hold paper", "hold card", "holdcard", "card hold", "keep card",
                                     "hold card 3 months", "keep card 1 year"]),
    ("Supplementary Papers", CAT_SET, "BOTH", ["subsequent paper", "subsequent certificate", "supplementary certificate",
                                               "supplementary warranty card", "certificate issued after"]),
    ("Archive Papers", CAT_SET, "BOTH", ["archive", "archives", "archive paper", "archives paper", "extract"]),
    ("Service Card", CAT_SET, "BOTH", ["service card", "service paper", "service papers", "service warranty",
                                       "official service card", "official after-sales card"]),
    ("Extended Warranty", CAT_SET, "BOTH", ["extended warranty", "8-year extended warranty"]),
    ("E-Warranty", CAT_SET, "BOTH", ["electronic warranty", "e-warranty"]),
    ("Original Invoice", CAT_SET, "BOTH", ["original invoice", "first invoice", "first buyer invoice",
                                           "original receipt", "retail invoice"]),
    ("Box Only", CAT_SET, "BOTH", ["box only"]),
    ("No Box", CAT_SET, "BOTH", ["no box", "nobox", "no-box", "without box", "box missing"]),
    ("Old Box", CAT_SET, "BOTH", ["old box"]),
    # Origin of papers (LC numbers are numeric remarks, built in code)
    ("LC Germany", CAT_ORIGIN, "BOTH", ["lc 🇩🇪", "lc🇩🇪", "lc de", "lc germany"]),
    ("EU Papers", CAT_ORIGIN, "BOTH", ["eu card", "eu paper", "eu papers", "european card", "european paper",
                                       "european papers"]),
    ("German Papers", CAT_ORIGIN, "BOTH", ["german paper", "german papers", "german card", "german 🇩🇪 paper",
                                           "german 🇩🇪 papers"]),
    ("Italian Papers", CAT_ORIGIN, "BOTH", ["italian paper", "italian papers", "italian card"]),
    ("Japanese Papers", CAT_ORIGIN, "BOTH", ["japanese paper", "japanese papers", "japanese card",
                                             "japanese guarantee paper"]),
    ("Hong Kong Papers", CAT_ORIGIN, "BOTH", ["hong kong paper", "hong kong papers", "hk card",
                                              "hong kong guarantee paper"]),
    ("China Papers", CAT_ORIGIN, "BOTH", ["china domestic", "china domestic card", "china mainland card",
                                          "mainland card", "china card"]),
    # Bracelet (links are numeric remarks, built in code)
    ("Full Links", CAT_BRACELET, "BOTH", ["full links", "full link", "complete links", "all links", "fulllinks",
                                          "fullinks", "fulllink"]),
    # Unadjusted is listed before Adjusted and its triggers are longer, so
    # "unadjusted" / "un-adj" never also yield "Adjusted".
    ("Unadjusted", CAT_BRACELET, "BOTH", ["unadj", "unadjusted", "un-adj", "not adj", "no adj", "noadj",
                                          "no-adjusted", "unsized"]),
    ("Adjusted", CAT_BRACELET, "BOTH", ["adj", "adjusted", "sized", "adj jub", "adj oys"]),
    ("Cut Strap", CAT_BRACELET, "BOTH", ["cut strap", "strap cut", "leather cut"]),
    ("Uncut Strap", CAT_BRACELET, "BOTH", ["uncut strap", "strap uncut"]),
    ("New Clasp", CAT_BRACELET, "BOTH", ["new clasp"]),
    ("New Buckle", CAT_BRACELET, "BOTH", ["new buckle"]),
    # Condition and service (Serviced + year is numeric, built in code)
    ("polished", CAT_CONDITION, "BOTH", ["polished", "already polished"]),
    ("Unpolished", CAT_CONDITION, "BOTH", ["unpolished", "never polished", "not polished", "never polish", "no polish"]),
    ("New Movement", CAT_CONDITION, "BOTH", ["new movement", "new machine", "new engine"]),
    ("New Caliber", CAT_CONDITION, "BOTH", ["new caliber", "new calibre"]),
    ("dial change", CAT_CONDITION, "BOTH", ["dial change"]),
    ("Double Seal", CAT_CONDITION, "BOTH", ["double seal", "double sealed"]),
    ("Single Seal", CAT_CONDITION, "BOTH", ["single seal", "single sealed", "singel sealed"]),
    # "mercedes" alone is deliberately not a trigger (hits IWC Mercedes-AMG).
    ("Mercedes Hands", CAT_CONDITION, "BOTH", ["mercedes hands"]),
    ("retail ready", CAT_CONDITION, "BOTH", ["retail ready"]),
    ("CPO", CAT_CONDITION, "BOTH", ["cpo", "certified pre-owned", "rolex official pre owned",
                                    "official pre-owned store", "official 2nd hand card"]),
    # Price, tax, shipping, payment (discount % is numeric, built in code)
    ("net price", CAT_PRICE, "BOTH", ["net price", "net", "netto", "ex vat", "ex-vat", "excluding vat", "intracom",
                                      "intracommunity", "intra"]),
    # "margin invoice" is margin scheme, never Original Invoice.
    ("margin scheme", CAT_PRICE, "BOTH", ["margin scheme", "margin", "eu margin", "margin invoice", "margin deal"]),
    ("VAT incl.", CAT_PRICE, "BOTH", ["including vat", "incl. vat", "incl vat", "vat included", "inkl. mwst"]),
    ("Shipped", CAT_PRICE, "BOTH", ["shipped", "shipped in eu", "incl. shipping", "incl. shipment",
                                    "shipping included", "customs & shipping included"]),
    ("Your Label", CAT_PRICE, "BOTH", ["+ label", "+label", "plus label", "+ lbl", "+ lab", "+ lable", "your label",
                                       "ur label", "+ 🏷", "+🏷", "+ ship", "+ shipping", "+ ✈", "+✈"]),
    # "export" alone is deliberately not a trigger.
    ("only export", CAT_PRICE, "BOTH", ["only export", "export only", "need export", "(export)"]),
    ("Wire", CAT_PRICE, "BOTH", ["wire", "wire transfer"]),
    ("Cash", CAT_PRICE, "BOTH", ["cash", "bh"]),
    ("USDT", CAT_PRICE, "BOTH", ["usdt"]),
    ("Safe Sell", CAT_PRICE, "BOTH", ["safe sell", "*safe sell*", "safe deal"]),
    # Availability and location (Watch in / Need in + place are built in code)
    ("Ready Stock", CAT_AVAILABILITY, "BOTH", ["ready stock", "in stock", "instock"]),
    ("Incoming", CAT_AVAILABILITY, "BOTH", ["incoming", "arriving", "arriving soon", "on the way", "coming soon",
                                            "coming"]),
    ("WTA Munich", CAT_AVAILABILITY, "BOTH", ["wta", "wta munich"]),
    ("Worldwide", CAT_AVAILABILITY, "WTB", ["worldwide", "any country", "any location"]),
    ("Can be Used", CAT_AVAILABILITY, "WTB", ["can be used", "used ok", "used okay", "used fine"]),
    ("Any Year", CAT_AVAILABILITY, "WTB", ["any year"]),
]

DEFAULT_AFTERMARKET_TRIGGERS = [
    "aftermarket", "after market", "after-market", "after diamond", "aftermarket diamond", "custom",
    "customized", "iced", "iced out", "moissanite", "not original", "non original", "non-original",
    "original bezel included",
]
DEFAULT_AFTERMARKET_EXCEPTIONS = ["original diamond", "factory diamond", "aftermarket stickers"]

DEFAULT_PLACES: list[tuple[str, str, list[str]]] = [
    ("Hong Kong", "country", ["hk", "hongkong"]),
    ("Dubai", "country", ["dxb", "uae", "ae", "emirates"]),
    ("Abu Dhabi", "country", []),
    ("USA", "country", ["us", "united states"]),
    ("United Kingdom", "country", ["uk", "england"]),
    ("Europe", "country", ["eu"]),
    ("Germany", "country", ["de", "deutschland"]),
    ("Switzerland", "country", ["ch", "swiss"]),
    ("France", "country", ["fr"]),
    ("Italy", "country", ["it", "italia"]),
    ("Netherlands", "country", ["nl", "holland"]),
    ("Singapore", "country", ["sg"]),
    ("Japan", "country", ["jp"]),
    ("China", "country", ["cn"]),
    ("Korea", "country", ["kr"]),
    ("Thailand", "country", ["th"]),
    ("Vietnam", "country", ["vn"]),
    ("Philippines", "country", ["ph"]),
    ("Australia", "country", ["au"]),
    ("Canada", "country", ["ca"]),
    ("Miami", "city", []),
    ("New York", "city", ["ny", "nyc"]),
    ("Los Angeles", "city", []),
    ("London", "city", []),
    ("Paris", "city", []),
    ("Geneva", "city", ["genf"]),
    ("Zurich", "city", ["zürich"]),
    ("Munich", "city", ["münchen"]),
    ("Milan", "city", []),
    ("Monaco", "city", []),
    ("Tokyo", "city", []),
    ("Macau", "city", []),
    ("Shanghai", "city", []),
    ("Doha", "city", []),
    ("Riyadh", "city", []),
]


# --- Text helpers -------------------------------------------------------------

def fold(text: str) -> str:
    """Lowercase and strip accents so 'Zürich' == 'zurich', 'Ombré' == 'ombre'."""
    nfkd = unicodedata.normalize("NFKD", text or "")
    return "".join(c for c in nfkd if not unicodedata.combining(c)).lower()


def _trigger_regex(trigger: str) -> Optional[str]:
    t = fold(trigger).strip()
    if not t:
        return None
    parts = [re.escape(p) for p in t.split()]
    body = r"\s+".join(parts)
    return r"(?<![a-z0-9])" + body + r"(?![a-z0-9])"


# --- Compiled configuration ---------------------------------------------------

@dataclass
class RemarkConfig:
    # (remark, mode, compiled patterns) in display order
    rules: list[tuple[str, str, list[re.Pattern]]] = field(default_factory=list)
    aftermarket: list[re.Pattern] = field(default_factory=list)
    aftermarket_exceptions: list[re.Pattern] = field(default_factory=list)
    # alias (folded) -> place name, longest first
    places: list[tuple[str, str]] = field(default_factory=list)
    place_pattern: Optional[re.Pattern] = None


def build_config(
    rules: Iterable[dict],
    places: Iterable[dict],
) -> RemarkConfig:
    """Compile rule/place dicts (DB documents or defaults) into a RemarkConfig."""
    cfg = RemarkConfig()
    for r in sorted(rules, key=lambda r: r.get("order", 0)):
        if not r.get("enabled", True):
            continue
        pats = [p for p in (_trigger_regex(t) for t in r.get("triggers") or []) if p]
        compiled = [re.compile(p) for p in pats]
        kind = r.get("kind", "remark")
        if kind == "aftermarket":
            cfg.aftermarket.extend(compiled)
        elif kind == "aftermarket_exception":
            cfg.aftermarket_exceptions.extend(compiled)
        elif compiled and (r.get("remark") or "").strip():
            cfg.rules.append((r["remark"].strip(), (r.get("mode") or "BOTH").upper(), compiled))

    pairs: list[tuple[str, str]] = []
    for p in sorted(places, key=lambda p: p.get("order", 0)):
        if not p.get("enabled", True):
            continue
        name = (p.get("name") or "").strip()
        if not name:
            continue
        for alias in [name] + list(p.get("aliases") or []):
            a = fold(alias).strip()
            if a and a not in dict(pairs):
                pairs.append((a, name))
    pairs.sort(key=lambda kv: len(kv[0]), reverse=True)
    cfg.places = pairs
    if pairs:
        cfg.place_pattern = re.compile(
            r"(?<![a-z0-9])(?:" + "|".join(r"\s+".join(map(re.escape, a.split())) for a, _ in pairs) + r")(?![a-z0-9])"
        )
    return cfg


def default_rule_dicts() -> list[dict]:
    out: list[dict] = []
    order = 0
    for remark, category, mode, triggers in DEFAULT_REMARK_RULES:
        out.append({"remark": remark, "category": category, "mode": mode, "kind": "remark",
                    "triggers": list(triggers), "enabled": True, "order": order})
        order += 10
    out.append({"remark": "Aftermarket", "category": "Aftermarket", "mode": "BOTH", "kind": "aftermarket",
                "triggers": list(DEFAULT_AFTERMARKET_TRIGGERS), "enabled": True, "order": order})
    order += 10
    out.append({"remark": "Not aftermarket", "category": "Aftermarket", "mode": "BOTH",
                "kind": "aftermarket_exception", "triggers": list(DEFAULT_AFTERMARKET_EXCEPTIONS),
                "enabled": True, "order": order})
    return out


def default_place_dicts() -> list[dict]:
    return [{"name": n, "kind": k, "aliases": list(a), "enabled": True, "order": i * 10}
            for i, (n, k, a) in enumerate(DEFAULT_PLACES)]


_DEFAULT_CONFIG: Optional[RemarkConfig] = None


def default_config() -> RemarkConfig:
    global _DEFAULT_CONFIG
    if _DEFAULT_CONFIG is None:
        _DEFAULT_CONFIG = build_config(default_rule_dicts(), default_place_dicts())
    return _DEFAULT_CONFIG


async def seed_defaults(replace: bool = False) -> None:
    """Write the appendix A defaults to the database (when empty, or always with replace)."""
    from app.models.remark_rule import RemarkPlace, RemarkRule

    if replace:
        await RemarkRule.delete_all()
        await RemarkPlace.delete_all()
    if replace or await RemarkRule.count() == 0:
        for d in default_rule_dicts():
            await RemarkRule(**d).insert()
    if replace or await RemarkPlace.count() == 0:
        for d in default_place_dicts():
            await RemarkPlace(**d).insert()


async def load_remark_config() -> RemarkConfig:
    """Load the editable rules from the database (seeding them on first use).

    Falls back to the built-in defaults when the database is not available
    (scripts, tests) so a run never goes without remarks.
    """
    try:
        from app.models.remark_rule import RemarkPlace, RemarkRule

        await seed_defaults()
        rules = [r.model_dump() for r in await RemarkRule.find_all().to_list()]
        places = [p.model_dump() for p in await RemarkPlace.find_all().to_list()]
        return build_config(rules, places)
    except Exception as exc:
        logger.debug("remark rules: database unavailable, using defaults (%s)", exc)
        return default_config()


# --- Matching -----------------------------------------------------------------

def is_aftermarket(text: str, cfg: Optional[RemarkConfig] = None) -> Optional[str]:
    """Return the aftermarket trigger found in ``text`` (exceptions removed), else None."""
    cfg = cfg or default_config()
    t = fold(text)
    for pat in cfg.aftermarket_exceptions:
        t = pat.sub(" ", t)
    best = None
    for pat in cfg.aftermarket:
        m = pat.search(t)
        if m and (best is None or len(m.group(0)) > len(best)):
            best = m.group(0)
    return best


_LINKS_RE = re.compile(
    r"(?<![\w.,/])(?:missing\s+)?(\d{1,2}(?:[.,]5)?)\s*links?(?![a-z])(?:\s+missing)?"
)
_SERVICED_RE = re.compile(
    r"(?<![a-z0-9])(?:new\s+|patek\s+|rolex\s+|ap\s+|official\s+)?servic(?:e|ed)\s+(?:in\s+)?"
    r"(?:\d{1,2}[/.\-])?(20[0-3]\d)(?![0-9])"
)
_LC_RE = re.compile(r"(?<![a-z0-9])lc[\s\-]?(\d{2,3})(?![a-z0-9])")
_DISCOUNT_RES = [
    re.compile(r"(?<![\d.,])-?\s?(\d{1,2}(?:[.,]\d)?)\s?%"),
    re.compile(r"(?<![a-z0-9])less\s+(\d{1,2})(?![\d%k])"),
]
_WOOD_W_RE = re.compile(r"(?<![a-z0-9&+])w(\d{1,2})(?:\s?[/\-]\s?(\d{2,4}))?(?![a-z0-9/&+])")


def wood_card_month(text: str) -> Optional[tuple[int, Optional[int]]]:
    """'W10' / 'W10/26' / 'W9-2026' → (month, year or None)."""
    for m in _WOOD_W_RE.finditer(fold(text)):
        month = int(m.group(1))
        if not 1 <= month <= 12:
            continue
        yr = m.group(2)
        year = None
        if yr:
            y = int(yr)
            year = y if y > 99 else 2000 + y
            if not 2000 <= year <= 2099:
                continue
        return month, year
    return None


def _fmt_number(raw: str) -> str:
    raw = raw.replace(",", ".")
    return raw[:-2] if raw.endswith(".0") else raw


def numeric_remarks(text: str) -> list[str]:
    """Remarks that carry a number — built in code, not editable (§6)."""
    t = fold(text)
    out: list[str] = []

    def add(r: str):
        if r not in out:
            out.append(r)

    for m in _LINKS_RE.finditer(t):
        n = _fmt_number(m.group(1))
        try:
            val = float(n)
        except ValueError:
            continue
        if val <= 0:
            continue
        add(f"{n} link" if val <= 1 else f"{n} links")
    for m in _SERVICED_RE.finditer(t):
        add(f"Serviced {m.group(1)}")
    for m in _LC_RE.finditer(t):
        add(f"LC{m.group(1)}")
    for rx in _DISCOUNT_RES:
        for m in rx.finditer(t):
            n = _fmt_number(m.group(1))
            try:
                val = float(n)
            except ValueError:
                continue
            if 1 <= val <= 60:
                add(f"{n}% Retail")
    if wood_card_month(t):
        add("Wood Card")
    return out


def location_remarks(text: str, mode: str, cfg: Optional[RemarkConfig] = None) -> list[str]:
    """'Watch in Dubai' (WTS), 'Need in Miami, New York' (WTB), 'Ready Stock' for
    'ready in HK' / 'HK ready'. Places come from the editable list."""
    cfg = cfg or default_config()
    if not cfg.place_pattern:
        return []
    t = fold(text)
    lookup = dict(cfg.places)
    out: list[str] = []

    if mode == "WTB":
        verbs = r"need|needed|looking|only"
        label = "Need in"
    else:
        verbs = r"watch|watches|located|available"
        label = "Watch in"
    m = re.search(r"(?<![a-z0-9])(?:" + verbs + r")\s+(?:is\s+)?(?:in|at)\s+([^\n.;!?]+)", t)
    if m:
        names: list[str] = []
        tail = m.group(1)
        pos = 0
        # Walk the tail: place, separator, place, ... stop at the first word that is
        # neither a place nor a separator.
        while pos < len(tail):
            sep = re.match(r"\s*(?:,|/|&|\bor\b|\band\b|\+)?\s*", tail[pos:])
            pos += sep.end() if sep else 0
            pm = cfg.place_pattern.match(tail, pos)
            if not pm:
                break
            name = lookup.get(re.sub(r"\s+", " ", pm.group(0)))
            if name and name not in names:
                names.append(name)
            pos = pm.end()
        if names:
            out.append(f"{label} " + ", ".join(names))

    if re.search(r"(?<![a-z0-9])ready\s+in\s+", t) and cfg.place_pattern.search(
            t[re.search(r"(?<![a-z0-9])ready\s+in\s+", t).end():][:30]):
        out.append("Ready Stock")
    else:
        for pm in cfg.place_pattern.finditer(t):
            if re.match(r"\s+ready(?![a-z])", t[pm.end():]):
                out.append("Ready Stock")
                break
    return out


def normalize_remarks(text: str, mode: Optional[str] = None, cfg: Optional[RemarkConfig] = None,
                      include_locations: bool = True) -> str:
    """All remarks for ``text`` in display order, joined with ', '.

    Triggers are matched case- and accent-insensitively on word boundaries;
    longer triggers claim their span first, so 'unadjusted' never also yields
    'Adjusted' and 'margin invoice' never yields 'Original Invoice'.
    """
    cfg = cfg or default_config()
    t = fold(text)
    consumed = [False] * len(t)

    candidates: list[tuple[int, int, int, str]] = []  # (-length, rule_idx, start, remark) per hit
    for idx, (remark, rmode, pats) in enumerate(cfg.rules):
        if rmode != "BOTH" and mode and rmode != mode:
            continue
        for pat in pats:
            for m in pat.finditer(t):
                candidates.append((-(m.end() - m.start()), idx, m.start(), remark))
    # Longest spans claim first.
    hits: dict[int, str] = {}
    for neg_len, idx, start, remark in sorted(candidates):
        end = start - neg_len
        if any(consumed[start:end]):
            continue
        for i in range(start, end):
            consumed[i] = True
        hits.setdefault(idx, remark)

    found = [hits[i] for i in sorted(hits)]
    for r in numeric_remarks(text):
        if r not in found:
            found.append(r)
    for r in (location_remarks(text, mode or "WTS", cfg) if include_locations else []):
        if r not in found:
            found.append(r)
    return ", ".join(found)
