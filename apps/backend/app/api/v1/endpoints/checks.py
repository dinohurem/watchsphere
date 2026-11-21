"""Checks (app side): serial check, dealer number check, bracelet links and user reports.

Mounted at ``/api/v1/checks``. Everything is matched on the normalised text (see
``app.services.checks_normalize``); only ``published`` rows are ever visible. Responses never
include the reporter, internal names, photos or who_offered.
"""
from datetime import datetime
from typing import Any, Dict, List, Optional

from beanie import PydanticObjectId
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from app.core.config import settings
from app.core.deps import get_current_active_user
from app.models.checks import (
    HOW_STOLEN_LABELS,
    Bracelet,
    DealerNumber,
    SerialReport,
)
from app.models.user import User
from app.services.checks_normalize import (
    build_e164,
    normalize_country_code,
    normalize_reference,
    normalize_serial,
    validate_e164,
)
from app.services.checks_service import (
    COLLECTIONS,
    BRACELETS,
    DEALER_NUMBERS,
    SERIAL_REPORTS,
    TYPE_LABELS,
    CheckError,
    iso,
    report_summary,
)

router = APIRouter()

# Countries offered by the report/check pickers (name, ISO 3166 alpha-2, dial code).
COUNTRIES = [
    ("Hong Kong", "HK", "+852"), ("Switzerland", "CH", "+41"), ("Germany", "DE", "+49"),
    ("United Arab Emirates", "AE", "+971"), ("United States", "US", "+1"),
    ("United Kingdom", "GB", "+44"), ("China", "CN", "+86"), ("Italy", "IT", "+39"),
    ("Spain", "ES", "+34"), ("Austria", "AT", "+43"), ("France", "FR", "+33"),
    ("Japan", "JP", "+81"), ("Singapore", "SG", "+65"), ("Thailand", "TH", "+66"),
    ("Taiwan", "TW", "+886"), ("Malaysia", "MY", "+60"), ("Belgium", "BE", "+32"),
    ("Netherlands", "NL", "+31"), ("Turkey", "TR", "+90"), ("Bosnia and Herzegovina", "BA", "+387"),
    ("Croatia", "HR", "+385"), ("Serbia", "RS", "+381"), ("Russia", "RU", "+7"),
    ("India", "IN", "+91"), ("Australia", "AU", "+61"), ("Canada", "CA", "+1"),
    ("South Korea", "KR", "+82"), ("Saudi Arabia", "SA", "+966"), ("Qatar", "QA", "+974"),
    ("Israel", "IL", "+972"), ("Mexico", "MX", "+52"), ("Brazil", "BR", "+55"),
]


def _flag(iso2: str) -> str:
    return "".join(chr(0x1F1E6 + ord(c) - ord("A")) for c in iso2)


def _oid(value: str) -> PydanticObjectId:
    try:
        return PydanticObjectId(value)
    except Exception:
        raise HTTPException(status_code=404, detail="Not found")


async def _bump_views(model: Any, ids: List[Any]) -> None:
    if ids:
        try:
            await model.find({"_id": {"$in": ids}}).update_many({"$inc": {"views": 1}})
        except Exception:  # a counter must never break a check
            pass


@router.get("/config")
async def checks_config(current_user: User = Depends(get_current_active_user)) -> Any:
    return {
        "support_whatsapp": settings.SUPPORT_WHATSAPP or None,
        "how_stolen_options": [{"value": v, "label": label} for v, label in HOW_STOLEN_LABELS.items()],
        "report_types": [{"value": v, "label": label} for v, label in TYPE_LABELS.items()],
        "countries": [{"name": n, "iso": i, "country_code": c, "flag": _flag(i)} for n, i, c in COUNTRIES],
    }


# --------------------------------------------------------------------------------------------
# Serial check
# --------------------------------------------------------------------------------------------

@router.get("/serial")
async def check_serial(
    serial: str = Query(..., max_length=100),
    current_user: User = Depends(get_current_active_user),
) -> Any:
    sn = normalize_serial(serial)
    if not sn:
        raise HTTPException(status_code=422, detail="Enter a serial number")
    docs = await SerialReport.find({"serial_normalized": sn, "status": "published"}) \
        .sort([("created_at", -1)]).to_list()
    await _bump_views(SerialReport, [d.id for d in docs])
    return {
        "serial": serial,
        "serial_normalized": sn,
        "checked_at": iso(datetime.utcnow()),
        "matches": [{
            "id": str(d.id), "type": d.type.value, "brand": d.brand, "model": d.model,
            "reference": d.reference, "reported_at": iso(d.created_at), "location": d.location,
        } for d in docs],
    }


@router.get("/serial-reports/{report_id}")
async def serial_report_detail(report_id: str, current_user: User = Depends(get_current_active_user)) -> Any:
    d = await SerialReport.get(_oid(report_id))
    if d is None or d.status.value != "published":
        raise HTTPException(status_code=404, detail="Not found")
    await _bump_views(SerialReport, [d.id])
    how = d.how_stolen.value if d.how_stolen else None
    return {
        "id": str(d.id), "type": d.type.value, "brand": d.brand, "model": d.model,
        "reference": d.reference, "serial": d.serial, "how_stolen": how,
        "how_stolen_label": HOW_STOLEN_LABELS.get(how) if how else None,
        "date_of_incident": d.date_of_incident, "location": d.location, "details": d.details,
        "reported_at": iso(d.created_at),
    }


# --------------------------------------------------------------------------------------------
# Dealer number check
# --------------------------------------------------------------------------------------------

@router.get("/phone")
async def check_phone(
    country_code: str = Query(..., max_length=10),
    number: str = Query(..., max_length=40),
    current_user: User = Depends(get_current_active_user),
) -> Any:
    cc = normalize_country_code(country_code)
    e164 = build_e164(cc, number)
    if not e164 or not validate_e164(e164):
        raise HTTPException(status_code=422, detail=f"Not a valid phone number for {cc or country_code}")
    docs = await DealerNumber.find({"e164": e164, "status": "published"}).to_list()
    scammer = next((d for d in docs if d.type.value == "scammer"), None)
    verified = next((d for d in docs if d.type.value == "verified"), None)
    hit = scammer or verified  # scammer wins
    await _bump_views(DealerNumber, [hit.id] if hit else [])
    return {
        "e164": e164,
        "state": hit.type.value if hit else "none",
        "report_id": str(hit.id) if hit else None,
        "checked_at": iso(datetime.utcnow()),
    }


@router.get("/dealer-numbers/{number_id}")
async def dealer_number_detail(number_id: str, current_user: User = Depends(get_current_active_user)) -> Any:
    d = await DealerNumber.get(_oid(number_id))
    if d is None or d.status.value != "published" or d.type.value != "scammer":
        raise HTTPException(status_code=404, detail="Not found")
    await _bump_views(DealerNumber, [d.id])
    return {
        "id": str(d.id), "e164": d.e164, "country_code": d.country_code, "phone": d.phone,
        "country": d.country, "details": d.details, "reported_at": iso(d.created_at),
    }


# --------------------------------------------------------------------------------------------
# Bracelet links
# --------------------------------------------------------------------------------------------

async def resolve_catalogue_watch(query: str) -> Optional[Any]:
    """Resolve a typed reference / alias / nickname the way Market search does.

    Reuses ``market_browse``'s catalogue search (aliases, OEM references, WS codes, brand and
    descriptor slang). Only a confident answer is returned: among the best-scoring catalogue
    entries every one must share the same reference, otherwise the typed text is used as is.
    """
    from app.api.v1.endpoints.market_browse import _alias_tables, _search_entries, score_entry
    from app.models.watch import Watch

    brand_aliases, descriptor_aliases = _alias_tables()
    scored = []
    for e in await _search_entries():
        s = score_entry(query, e, brand_aliases, descriptor_aliases)
        if s:
            scored.append((s, e))
    if not scored:
        return None
    best = max(s for s, _ in scored)
    top = sorted((e for s, e in scored if s == best), key=lambda e: -e["order_count"])
    watches = []
    for e in top[:25]:
        try:
            w = await Watch.get(PydanticObjectId(str(e["id"])))
        except Exception:
            w = None
        if w is not None and w.reference:
            watches.append(w)
    if not watches:
        return None
    refs = {normalize_reference(w.reference) for w in watches}
    if len(refs) != 1:
        return None
    return watches[0]


@router.get("/bracelets")
async def check_bracelets(
    reference: str = Query(..., max_length=100),
    current_user: User = Depends(get_current_active_user),
) -> Any:
    q = (reference or "").strip()
    if not normalize_reference(q):
        raise HTTPException(status_code=422, detail="Enter a reference")
    watch = await resolve_catalogue_watch(q)
    refs = {normalize_reference(q)}
    if watch is not None:
        refs.add(normalize_reference(watch.reference))
        refs.update(normalize_reference(r) for r in (watch.oem_references or []))
    refs.discard("")
    rows = await Bracelet.find({"reference_normalized": {"$in": sorted(refs)}, "status": "published"}) \
        .sort([("sort_order", 1), ("created_at", 1)]).to_list()
    if watch is None and not rows:
        raise HTTPException(status_code=404, detail="Reference not found")
    await _bump_views(Bracelet, [b.id for b in rows])
    first = rows[0] if rows else None
    return {
        "query": reference,
        "reference": watch.reference if watch is not None else (first.reference if first else q),
        "brand": (watch.brand if watch is not None else None) or (first.brand if first else None),
        "model": (watch.model if watch is not None else None) or (first.model if first else None),
        "in_catalogue": watch is not None,
        "bracelets": [{
            "id": str(b.id), "name": b.bracelet, "full_links": b.full_links, "notes": b.notes,
            "photo_url": b.photo_url, "photo_thumb_url": b.photo_thumb_url or b.photo_url,
            "sort_order": b.sort_order,
        } for b in rows],
    }


# --------------------------------------------------------------------------------------------
# User reports (land as draft with the reporter, internal)
# --------------------------------------------------------------------------------------------

class _Photos(BaseModel):
    photo_urls: List[str] = Field(default_factory=list, max_length=10)


class StolenReportBody(_Photos):
    serial: str = Field(..., max_length=100)
    reference: str = Field(..., max_length=100)
    brand: Optional[str] = Field(None, max_length=100)
    model: Optional[str] = Field(None, max_length=100)
    date_of_incident: Optional[str] = None
    location: Optional[str] = Field(None, max_length=200)
    details: Optional[str] = Field(None, max_length=5000)


class CounterfeitReportBody(_Photos):
    serial: str = Field(..., max_length=100)
    reference: str = Field(..., max_length=100)
    type: str = "counterfeit"
    who_offered: Optional[str] = Field(None, max_length=200)
    details: Optional[str] = Field(None, max_length=5000)


class ScammerReportBody(BaseModel):
    country_code: str = Field(..., max_length=10)
    phone: str = Field(..., max_length=40)
    details: str = Field(..., min_length=1, max_length=5000)


def _urls(urls: List[str]) -> List[str]:
    out = [u.strip() for u in urls if u and u.strip()]
    if any(not u.lower().startswith(("http://", "https://")) for u in out):
        raise HTTPException(status_code=422, detail="photo_urls must be http(s) URLs")
    return out


async def _create_serial_report(user: User, fields: Dict[str, Any]) -> Dict[str, Any]:
    coll = COLLECTIONS[SERIAL_REPORTS]
    try:
        cleaned = coll.clean({**fields, "status": "draft"})
    except CheckError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    doc = SerialReport(**cleaned, reporter_id=str(user.id))
    await doc.insert()
    summary, ident = report_summary(coll, cleaned)
    return {"id": str(doc.id), "kind": "serial", "status": "draft", "summary": summary,
            "subtitle": f"{ident} · Status: Pending review"}


@router.post("/reports/stolen", status_code=201)
async def report_stolen(body: StolenReportBody, current_user: User = Depends(get_current_active_user)) -> Any:
    return await _create_serial_report(current_user, {
        "type": "stolen", "serial": body.serial, "reference": body.reference, "brand": body.brand,
        "model": body.model, "date_of_incident": body.date_of_incident, "location": body.location,
        "details": body.details, "photos": _urls(body.photo_urls),
    })


@router.post("/reports/counterfeit", status_code=201)
async def report_counterfeit(body: CounterfeitReportBody, current_user: User = Depends(get_current_active_user)) -> Any:
    if body.type not in ("counterfeit", "frankenstein", "fake_papers"):
        raise HTTPException(status_code=422, detail="type must be counterfeit, frankenstein or fake_papers")
    return await _create_serial_report(current_user, {
        "type": body.type, "serial": body.serial, "reference": body.reference,
        "who_offered": body.who_offered, "details": body.details, "photos": _urls(body.photo_urls),
    })


@router.post("/reports/scammer", status_code=201)
async def report_scammer(body: ScammerReportBody, current_user: User = Depends(get_current_active_user)) -> Any:
    coll = COLLECTIONS[DEALER_NUMBERS]
    try:
        cleaned = coll.clean({"type": "scammer", "country_code": body.country_code,
                              "phone": body.phone, "details": body.details, "status": "draft"})
    except CheckError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    doc = DealerNumber(**cleaned, reporter_id=str(current_user.id))
    await doc.insert()
    return {"id": str(doc.id), "kind": "dealer_number", "status": "draft", "summary": "Scammer number",
            "subtitle": f"{cleaned['e164']} · Status: Pending review"}
