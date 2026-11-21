"""Checks: field cleaning, serialisation, import parsing, export and reporter notifications.

Shared by the app endpoints (``endpoints/checks.py``) and the admin endpoints
(``endpoints/checks_admin.py``). Pure functions where possible so they are easy to test.
"""
import csv
import io
import logging
import re
from datetime import date, datetime
from typing import Any, Dict, Iterable, List, Optional, Tuple

from beanie import PydanticObjectId

from app.models.checks import (
    HOW_STOLEN_LABELS,
    Bracelet,
    CheckStatus,
    DealerNumber,
    DealerNumberType,
    HowStolen,
    SerialReport,
    SerialReportType,
)
from app.services.checks_normalize import (
    build_e164,
    normalize_country_code,
    normalize_reference,
    normalize_serial,
    validate_e164,
)

logger = logging.getLogger(__name__)

SERIAL_REPORTS = "serial-reports"
DEALER_NUMBERS = "dealer-numbers"
BRACELETS = "bracelets"

TYPE_LABELS = {
    "stolen": "Stolen",
    "counterfeit": "Counterfeit",
    "frankenstein": "Frankenstein",
    "fake_papers": "Fake papers",
}


def iso(dt: Optional[datetime]) -> Optional[str]:
    """Stored as naive UTC; the explicit Z keeps clients from reading it as local time."""
    if dt is None:
        return None
    return dt.isoformat() + ("Z" if dt.tzinfo is None else "")


def _slug(s: Any) -> str:
    return re.sub(r"[^a-z0-9]+", "", str(s or "").lower())


_HOW_LOOKUP = {_slug(v): v for v in HOW_STOLEN_LABELS}
_HOW_LOOKUP.update({_slug(label): v for v, label in HOW_STOLEN_LABELS.items()})
_TYPE_LOOKUP = {_slug(v): v for v in TYPE_LABELS}
_TYPE_LOOKUP.update({_slug(label): v for v, label in TYPE_LABELS.items()})
_TYPE_LOOKUP.update({"fakepaper": "fake_papers", "fakedocuments": "fake_papers"})


class CheckError(ValueError):
    """A value the team or the user entered is not acceptable (HTTP 422 / invalid import row)."""


# --------------------------------------------------------------------------------------------
# Field cleaning
# --------------------------------------------------------------------------------------------

def _text(v: Any) -> Optional[str]:
    if v is None:
        return None
    if isinstance(v, float) and v.is_integer():
        v = int(v)
    s = str(v).strip()
    return s or None


def _parse_date(v: Any) -> Optional[str]:
    if v is None or (isinstance(v, str) and not v.strip()):
        return None
    if isinstance(v, datetime):
        return v.date().isoformat()
    if isinstance(v, date):
        return v.isoformat()
    s = str(v).strip()
    for fmt in ("%Y-%m-%d", "%Y-%m-%d %H:%M:%S", "%d.%m.%Y", "%d/%m/%Y"):
        try:
            return datetime.strptime(s, fmt).date().isoformat()
        except ValueError:
            continue
    raise CheckError(f"Invalid date '{s}' (use YYYY-MM-DD)")


def _parse_int(v: Any, field: str, default: Optional[int] = None) -> Optional[int]:
    if v is None or (isinstance(v, str) and not v.strip()):
        return default
    try:
        f = float(str(v).strip().replace(",", "."))
    except ValueError:
        raise CheckError(f"{field} must be a number")
    if not f.is_integer() or f < 0:
        raise CheckError(f"{field} must be a whole number of 0 or more")
    return int(f)


def _parse_status(v: Any, allowed: Tuple[str, ...]) -> Optional[str]:
    s = _text(v)
    if s is None:
        return None
    s = s.lower()
    if s not in allowed:
        raise CheckError(f"Invalid status '{s}' (use {', '.join(allowed)})")
    return s


def _photo_list(v: Any) -> List[str]:
    if v is None:
        return []
    if isinstance(v, str):
        v = [p for p in re.split(r"[;\n]", v) if p.strip()]
    return [str(p).strip() for p in v if str(p).strip()]


# Editable fields per collection (also what the import file may contain).
SERIAL_FIELDS = ("type", "serial", "brand", "model", "reference", "how_stolen", "date_of_incident",
                 "location", "who_offered", "details", "photos", "photo_thumbnails", "status")
DEALER_FIELDS = ("type", "country_code", "phone", "name", "country", "details", "photos",
                 "photo_thumbnails", "status")
BRACELET_FIELDS = ("brand", "model", "reference", "bracelet", "full_links", "notes", "photo_url",
                   "photo_thumb_url", "sort_order", "status")

FIELD_ALIASES = {"date": "date_of_incident", "incident_date": "date_of_incident",
                 "serial_number": "serial", "phone_number": "phone", "links": "full_links",
                 "bracelet_name": "bracelet", "sort": "sort_order"}


def clean_serial_report(data: Dict[str, Any]) -> Dict[str, Any]:
    """Validate + normalise a full serial-report field dict (raises CheckError)."""
    t = _TYPE_LOOKUP.get(_slug(data.get("type")))
    if not t:
        raise CheckError("Type is required (stolen, counterfeit, frankenstein or fake_papers)")
    serial = _text(data.get("serial"))
    sn = normalize_serial(serial)
    if not sn:
        raise CheckError("Serial number is required")
    reference = _text(data.get("reference"))
    rn = normalize_reference(reference)
    if not rn:
        raise CheckError("Reference is required")
    how = _text(data.get("how_stolen"))
    if how is not None:
        how = _HOW_LOOKUP.get(_slug(how))
        if not how:
            raise CheckError(f"Invalid how_stolen '{data.get('how_stolen')}'")
    out = {
        "type": t, "serial": serial, "serial_normalized": sn,
        "brand": _text(data.get("brand")), "model": _text(data.get("model")),
        "reference": reference, "reference_normalized": rn, "how_stolen": how,
        "date_of_incident": _parse_date(data.get("date_of_incident")),
        "location": _text(data.get("location")), "who_offered": _text(data.get("who_offered")),
        "details": _text(data.get("details")),
        "photos": _photo_list(data.get("photos")),
        "photo_thumbnails": _photo_list(data.get("photo_thumbnails")),
        "status": _parse_status(data.get("status"), ("draft", "published", "rejected")) or "published",
    }
    return out


def clean_dealer_number(data: Dict[str, Any]) -> Dict[str, Any]:
    t = _text(data.get("type"))
    t = t.lower() if t else None
    if t not in ("verified", "scammer"):
        t = {"verifieddealer": "verified"}.get(_slug(data.get("type")))
    if not t:
        raise CheckError("Type is required (verified or scammer)")
    cc = normalize_country_code(_text(data.get("country_code")))
    if not cc:
        raise CheckError("Country code is required")
    phone = _text(data.get("phone"))
    e164 = build_e164(cc, phone)
    if not e164 or not validate_e164(e164):
        raise CheckError(f"Not a valid phone number for {cc}")
    return {
        "type": t, "country_code": cc, "phone": phone, "e164": e164,
        "name": _text(data.get("name")), "country": _text(data.get("country")),
        "details": _text(data.get("details")),
        "photos": _photo_list(data.get("photos")),
        "photo_thumbnails": _photo_list(data.get("photo_thumbnails")),
        "status": _parse_status(data.get("status"), ("draft", "published", "rejected")) or "published",
    }


def clean_bracelet(data: Dict[str, Any]) -> Dict[str, Any]:
    reference = _text(data.get("reference"))
    rn = normalize_reference(reference)
    if not rn:
        raise CheckError("Reference is required")
    bracelet = _text(data.get("bracelet"))
    if not bracelet:
        raise CheckError("Bracelet is required")
    links = _parse_int(data.get("full_links"), "Full links")
    if links is None:
        raise CheckError("Full links is required")
    return {
        "brand": _text(data.get("brand")), "model": _text(data.get("model")),
        "reference": reference, "reference_normalized": rn, "bracelet": bracelet,
        "full_links": links, "notes": _text(data.get("notes")),
        "photo_url": _text(data.get("photo_url")),
        "photo_thumb_url": _text(data.get("photo_thumb_url")),
        "sort_order": _parse_int(data.get("sort_order"), "Sort order", 0) or 0,
        "status": _parse_status(data.get("status"), ("draft", "published")) or "published",
    }


class Collection:
    """Everything the generic admin endpoints need to know about one collection."""

    def __init__(self, key, model, fields, clean, columns, search_fields, kind):
        self.key, self.model, self.fields, self.clean = key, model, fields, clean
        self.columns, self.search_fields, self.kind = columns, search_fields, kind


COLLECTIONS: Dict[str, Collection] = {
    SERIAL_REPORTS: Collection(
        SERIAL_REPORTS, SerialReport, SERIAL_FIELDS, clean_serial_report,
        ["type", "serial", "brand", "model", "reference", "how_stolen", "date", "location",
         "who_offered", "details", "status", "photo_filename"],
        ["serial", "serial_normalized", "brand", "model", "reference", "reference_normalized",
         "location", "details"],
        "serial"),
    DEALER_NUMBERS: Collection(
        DEALER_NUMBERS, DealerNumber, DEALER_FIELDS, clean_dealer_number,
        ["type", "country_code", "phone", "name", "country", "details", "status", "photo_filename"],
        ["phone", "e164", "name", "country", "details"],
        "dealer_number"),
    BRACELETS: Collection(
        BRACELETS, Bracelet, BRACELET_FIELDS, clean_bracelet,
        ["brand", "model", "reference", "bracelet", "full_links", "notes", "sort_order", "status",
         "photo_filename"],
        ["brand", "model", "reference", "reference_normalized", "bracelet", "notes"],
        "bracelet"),
}


def doc_fields(coll: Collection, doc: Any) -> Dict[str, Any]:
    """The editable fields of a document, as stored (enums as strings)."""
    out = {}
    for f in coll.fields:
        v = getattr(doc, f, None)
        out[f] = v.value if hasattr(v, "value") else v
    return out


def merge_and_clean(coll: Collection, changes: Dict[str, Any], existing: Any = None) -> Dict[str, Any]:
    """Merge ``changes`` over the existing document (if any) and clean the whole thing."""
    base = doc_fields(coll, existing) if existing is not None else {}
    for k, v in changes.items():
        k = FIELD_ALIASES.get(k, k)
        if k in coll.fields:
            base[k] = v
    return coll.clean(base)


def display_name(coll: Collection, d: Dict[str, Any]) -> str:
    if coll.kind == "serial":
        return " ".join(p for p in (d.get("brand"), d.get("model"), d.get("reference")) if p) or d.get("serial") or ""
    if coll.kind == "dealer_number":
        return d.get("name") or d.get("e164") or ""
    return " ".join(p for p in (d.get("brand"), d.get("model"), d.get("reference")) if p)


async def reporters_for(docs: Iterable[Any]) -> Dict[str, Dict[str, Any]]:
    """{user id: {id, name, email}} for the reporters of the given documents."""
    from app.models.user import User

    ids = {d.reporter_id for d in docs if getattr(d, "reporter_id", None)}
    out: Dict[str, Dict[str, Any]] = {}
    oids = []
    for i in ids:
        try:
            oids.append(PydanticObjectId(i))
        except Exception:
            pass
    if oids:
        for u in await User.find({"_id": {"$in": oids}}).to_list():
            out[str(u.id)] = {"id": str(u.id), "name": u.name, "email": u.email}
    return out


def admin_dict(coll: Collection, doc: Any, reporters: Optional[Dict[str, Dict[str, Any]]] = None) -> Dict[str, Any]:
    d = doc_fields(coll, doc)
    if coll.kind == "serial":
        d.update(serial_normalized=doc.serial_normalized, reference_normalized=doc.reference_normalized,
                 how_stolen_label=HOW_STOLEN_LABELS.get(d.get("how_stolen") or ""))
    elif coll.kind == "dealer_number":
        d["e164"] = doc.e164
    else:
        d["reference_normalized"] = doc.reference_normalized
    d.update(id=str(doc.id), views=doc.views, created_at=iso(doc.created_at),
             updated_at=iso(doc.updated_at), display_name=display_name(coll, d))
    rid = getattr(doc, "reporter_id", None)
    d["reporter_id"] = rid
    d["reporter"] = (reporters or {}).get(rid) if rid else None
    return d


# --------------------------------------------------------------------------------------------
# Listing filters
# --------------------------------------------------------------------------------------------

def build_list_query(coll: Collection, search: Optional[str] = None, status: Optional[str] = None,
                     type: Optional[str] = None, ids: Optional[List[str]] = None) -> Dict[str, Any]:
    q: Dict[str, Any] = {}
    if status:
        q["status"] = status
    if type and coll.kind != "bracelet":
        q["type"] = type
    if ids is not None:
        oids = []
        for i in ids:
            try:
                oids.append(PydanticObjectId(i))
            except Exception:
                pass
        q["_id"] = {"$in": oids}
    s = (search or "").strip()
    if s:
        terms = {s}
        if coll.kind == "serial":
            terms.add(normalize_serial(s))
            terms.add(normalize_reference(s))
        elif coll.kind == "dealer_number":
            digits = re.sub(r"\D", "", s)
            if digits:
                terms.add(digits)
        else:
            terms.add(normalize_reference(s))
        ors = []
        for term in terms:
            if not term:
                continue
            rx = {"$regex": re.escape(term), "$options": "i"}
            ors.extend({f: rx} for f in coll.search_fields)
        q["$or"] = ors
    return q


# --------------------------------------------------------------------------------------------
# Reporter notification (spec 2.4)
# --------------------------------------------------------------------------------------------

def report_summary(coll: Collection, d: Dict[str, Any]) -> Tuple[str, str]:
    """(summary, identifier) used in the confirmation response and the Activity entry."""
    if coll.kind == "serial":
        label = TYPE_LABELS.get(d["type"], d["type"])
        what = " ".join(p for p in (d.get("brand"), d.get("model")) if p) or d.get("reference") or ""
        return (f"{label} · {what}" if what else label), (d.get("serial_normalized") or normalize_serial(d.get("serial")))
    return "Scammer number", d.get("e164") or ""


async def notify_reporter(coll: Collection, doc: Any, new_status: str) -> bool:
    """Activity entry + push for the reporter of a draft report that was published / rejected."""
    from app.models.notification import Notification, NotificationType
    from app.models.user import User
    from app.services import notifications as push

    rid = getattr(doc, "reporter_id", None)
    if not rid:
        return False
    try:
        user = await User.get(PydanticObjectId(rid))
    except Exception:
        user = None
    if user is None:
        return False
    d = doc_fields(coll, doc)
    if coll.kind == "serial":
        d["serial_normalized"] = doc.serial_normalized
    else:
        d["e164"] = doc.e164
    summary, ident = report_summary(coll, d)
    if new_status == "published":
        title = "Your report is live"
        body = f"{summary} ({ident}) was reviewed and is now visible in Checks."
    else:
        title = "Your report was reviewed"
        body = f"{summary} ({ident}) was reviewed and will not be published."
    data = {"kind": coll.kind, "report_id": str(doc.id), "status": new_status,
            "summary": summary, "identifier": ident}
    notification = Notification(
        user_id=str(user.id), type=NotificationType.CHECK_REPORT, title=title, body=body,
        reference=ident, data=data,
    )
    await notification.insert()
    try:
        await push.send_push_to_user(
            user, title=title, body=body,
            data={"type": "check_report", "kind": coll.kind, "report_id": str(doc.id),
                  "status": new_status, "notification_id": str(notification.id)},
            notification_type="check_report",
        )
    except Exception as exc:  # the Activity entry exists; a failed push must not fail the save
        logger.error("Checks push to %s failed: %s", rid, exc)
    return True


async def apply_changes(coll: Collection, doc: Any, cleaned: Dict[str, Any]) -> Dict[str, Any]:
    """Write ``cleaned`` onto ``doc``, save, and notify the reporter on draft -> published/rejected."""
    old_status = doc.status.value if hasattr(doc.status, "value") else doc.status
    for k, v in cleaned.items():
        setattr(doc, k, v)
    doc.updated_at = datetime.utcnow()
    await doc.save()
    new_status = cleaned.get("status", old_status)
    if getattr(doc, "reporter_id", None) and old_status == "draft" and new_status in ("published", "rejected"):
        await notify_reporter(coll, doc, new_status)
    return {"old_status": old_status, "new_status": new_status}


# --------------------------------------------------------------------------------------------
# Import parsing + export
# --------------------------------------------------------------------------------------------

MAX_IMPORT_ROWS = 5000


def _header(h: Any) -> str:
    k = re.sub(r"[\s\-]+", "_", str(h or "").strip().lower())
    return FIELD_ALIASES.get(k, k)


def _cell(v: Any) -> Any:
    if isinstance(v, datetime):
        return v.date().isoformat()
    if isinstance(v, date):
        return v.isoformat()
    if isinstance(v, float) and v.is_integer():
        return str(int(v))
    return None if v is None else (v.strip() if isinstance(v, str) else v)


def parse_table(filename: str, content: bytes) -> List[Dict[str, Any]]:
    """CSV or XLSX -> list of {header: value}; row index (spreadsheet row number) in ``_row``."""
    name = (filename or "").lower()
    rows: List[List[Any]] = []
    if name.endswith(".xlsx") or content[:2] == b"PK":
        import openpyxl

        try:
            wb = openpyxl.load_workbook(io.BytesIO(content), read_only=True, data_only=True)
        except Exception:
            raise CheckError("The file is not a valid XLSX file")
        ws = wb.worksheets[0]
        rows = [list(r) for r in ws.iter_rows(values_only=True)]
    else:
        try:
            text = content.decode("utf-8-sig")
        except UnicodeDecodeError:
            text = content.decode("latin-1")
        try:
            dialect = csv.Sniffer().sniff(text[:4096], delimiters=",;\t")
        except csv.Error:
            dialect = csv.excel
        rows = [list(r) for r in csv.reader(io.StringIO(text), dialect)]
    if not rows:
        raise CheckError("The file is empty")
    headers = [_header(h) for h in rows[0]]
    out = []
    for i, r in enumerate(rows[1:], start=2):
        vals = [_cell(v) for v in r]
        if not any(v not in (None, "") for v in vals):
            continue
        d = {h: vals[j] if j < len(vals) else None for j, h in enumerate(headers) if h}
        d["_row"] = i
        out.append(d)
    if len(out) > MAX_IMPORT_ROWS:
        raise CheckError(f"Too many rows (max {MAX_IMPORT_ROWS})")
    return out


def photo_names(doc_id: str, urls: List[str]) -> List[str]:
    """File names used in the photos ZIP of an export (and in the photo_filename column)."""
    names = []
    for n, u in enumerate(urls, start=1):
        m = re.search(r"\.(webp|jpe?g|png|gif)(?:\?|$)", u, re.IGNORECASE)
        names.append(f"{doc_id}_{n}.{(m.group(1).lower() if m else 'webp')}")
    return names


def export_row(coll: Collection, doc: Any) -> Dict[str, Any]:
    d = doc_fields(coll, doc)
    row = {c: d.get(c) for c in coll.columns if c not in ("date", "photo_filename")}
    if coll.kind == "serial":
        row["date"] = d.get("date_of_incident")
    urls = d.get("photos") if coll.kind != "bracelet" else ([d["photo_url"]] if d.get("photo_url") else [])
    row["photo_filename"] = ";".join(photo_names(str(doc.id), urls or []))
    return {c: ("" if row.get(c) is None else row.get(c)) for c in coll.columns}


def export_csv(coll: Collection, docs: List[Any]) -> bytes:
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(coll.columns)
    for doc in docs:
        r = export_row(coll, doc)
        w.writerow([r[c] for c in coll.columns])
    return ("﻿" + buf.getvalue()).encode("utf-8")


def export_xlsx(coll: Collection, docs: List[Any]) -> bytes:
    import openpyxl

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = coll.key
    ws.append(coll.columns)
    for doc in docs:
        r = export_row(coll, doc)
        ws.append([r[c] for c in coll.columns])
    out = io.BytesIO()
    wb.save(out)
    return out.getvalue()
