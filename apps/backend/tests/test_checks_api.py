"""Checks API: app endpoints, privacy, reports, admin CRUD, bulk edit, import/export, notifications."""
import csv
import io
import zipfile

import pytest
import pytest_asyncio
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.models.checks import Bracelet, CheckImportPreview, DealerNumber, SerialReport

PRIVATE_KEYS = {"reporter", "reporter_id", "name", "who_offered", "photos", "photo_thumbnails",
                "email", "status", "views"}


@pytest_asyncio.fixture
async def cdb():
    from beanie import init_beanie
    from mongomock_motor import AsyncMongoMockClient

    from app.models.activity_log import ActivityLog
    from app.models.notification import Notification
    from app.models.user import User
    from app.models.watch import Watch

    client = AsyncMongoMockClient()
    await init_beanie(
        database=client["checks_test"],
        document_models=[User, Watch, Notification, ActivityLog, SerialReport, DealerNumber,
                         Bracelet, CheckImportPreview],
    )
    from app.api.v1.endpoints import market_browse

    market_browse._SEARCH_CACHE.update(at=0.0, entries=[])
    yield client


@pytest_asyncio.fixture
async def users(cdb):
    from app.models.user import User, UserRole

    admin = User(email="admin@x.io", name="Admin", role=UserRole.ADMIN, approved=True, username="adm")
    reporter = User(email="rep@x.io", name="Rita Reporter", approved=True, username="rita", fcm_tokens=["ExponentPushToken[abc]"])
    await admin.insert()
    await reporter.insert()
    return {"admin": admin, "reporter": reporter}


@pytest.fixture
def pushes(monkeypatch):
    sent = []

    async def fake_push(user, title, body, data=None, notification_type=None, category_id=None):
        sent.append({"user": str(user.id), "title": title, "body": body, "data": data})
        return {"success_count": 1, "failure_count": 0}

    monkeypatch.setattr("app.services.notifications.send_push_to_user", fake_push)
    return sent


@pytest.fixture
def client(users, pushes, monkeypatch):
    from app.api.v1.endpoints import checks, checks_admin
    from app.core.deps import get_current_active_user, get_current_admin_user

    async def fake_upload(data, folder):
        return {"url": f"https://cdn.test/{folder}/{len(data)}.webp",
                "thumbnail_url": f"https://cdn.test/{folder}/thumbnails/{len(data)}.webp"}

    monkeypatch.setattr(checks_admin, "UPLOADER", fake_upload)

    async def no_fetch(url):
        return b"img-" + url.encode()

    monkeypatch.setattr(checks_admin, "fetch_photo", no_fetch)

    app = FastAPI()
    app.include_router(checks.router, prefix="/checks")
    app.include_router(checks_admin.router, prefix="/admin/checks")
    app.dependency_overrides[get_current_active_user] = lambda: users["reporter"]
    app.dependency_overrides[get_current_admin_user] = lambda: users["admin"]
    with TestClient(app) as c:
        yield c


async def sr(**kw):
    base = dict(type="stolen", serial="3Y0R9842", serial_normalized="3Y0R9842", reference="116500LN",
                reference_normalized="116500LN", brand="Rolex", model="Daytona", status="published",
                location="Munich, Germany", details="Taken from a car", who_offered="Mr X",
                photos=["https://x/p.webp"], reporter_id="someone")
    base.update(kw)
    d = SerialReport(**base)
    await d.insert()
    return d


async def dn(**kw):
    base = dict(type="scammer", country_code="+852", phone="6123 4567", e164="+85261234567",
                name="Secret Name", country="Hong Kong", details="Never delivered", status="published")
    base.update(kw)
    d = DealerNumber(**base)
    await d.insert()
    return d


def contains_private(obj, extra=()):
    keys = PRIVATE_KEYS | set(extra)
    if isinstance(obj, dict):
        return any(k in keys or contains_private(v, extra) for k, v in obj.items())
    if isinstance(obj, list):
        return any(contains_private(v, extra) for v in obj)
    return False


# --------------------------------------------------------------------------------------------
# Serial check
# --------------------------------------------------------------------------------------------

async def test_serial_no_reports(client, cdb):
    r = client.get("/checks/serial", params={"serial": "ZZ99"})
    assert r.status_code == 200
    body = r.json()
    assert body["matches"] == [] and body["serial_normalized"] == "ZZ99" and body["serial"] == "ZZ99"
    assert body["checked_at"].endswith("Z")


async def test_serial_exact_normalised_match_and_privacy(client, cdb):
    await sr()
    r = client.get("/checks/serial", params={"serial": "no. 3y0r 9842"})
    m = r.json()["matches"]
    assert len(m) == 1 and m[0]["type"] == "stolen" and m[0]["brand"] == "Rolex"
    assert set(m[0]) == {"id", "type", "brand", "model", "reference", "reported_at", "location"}
    assert not contains_private(r.json(), extra=())


async def test_serial_is_not_a_substring_match(client, cdb):
    await sr(serial="3Y0R9842", serial_normalized="3Y0R9842")
    assert client.get("/checks/serial", params={"serial": "3Y0R98"}).json()["matches"] == []
    assert client.get("/checks/serial", params={"serial": "Y0R9842"}).json()["matches"] == []


async def test_serial_only_published(client, cdb):
    await sr(status="draft")
    await sr(status="rejected")
    assert client.get("/checks/serial", params={"serial": "3Y0R9842"}).json()["matches"] == []


async def test_serial_multi_match_across_references(client, cdb):
    await sr(serial="605", serial_normalized="605", brand="Richard Mille", model="RM 011", reference="RM011")
    await sr(serial="605", serial_normalized="605", brand="Richard Mille", model="RM 035", reference="RM035",
             type="counterfeit")
    m = client.get("/checks/serial", params={"serial": "605"}).json()["matches"]
    assert {x["reference"] for x in m} == {"RM011", "RM035"}
    assert {x["type"] for x in m} == {"stolen", "counterfeit"}


async def test_serial_blank_is_422(client, cdb):
    assert client.get("/checks/serial", params={"serial": " - "}).status_code == 422


async def test_serial_report_detail(client, cdb):
    d = await sr(how_stolen="burglary", date_of_incident="2026-03-01")
    r = client.get(f"/checks/serial-reports/{d.id}")
    assert r.status_code == 200
    b = r.json()
    assert b["how_stolen"] == "burglary" and b["how_stolen_label"] == "Burglary"
    assert b["serial"] == "3Y0R9842" and b["details"] == "Taken from a car"
    assert not contains_private(b)
    assert "reporter_id" not in b and "who_offered" not in b and "photos" not in b


async def test_serial_report_detail_hidden_when_not_published(client, cdb):
    d = await sr(status="draft")
    assert client.get(f"/checks/serial-reports/{d.id}").status_code == 404
    assert client.get("/checks/serial-reports/notanid").status_code == 404


# --------------------------------------------------------------------------------------------
# Phone
# --------------------------------------------------------------------------------------------

async def test_phone_states(client, cdb):
    await dn()
    await dn(type="verified", country_code="+41", phone="079 123 45 67", e164="+41791234567", details=None)
    r = client.get("/checks/phone", params={"country_code": "+852", "number": "6123 4567"})
    assert r.json()["state"] == "scammer" and r.json()["e164"] == "+85261234567" and r.json()["report_id"]
    r = client.get("/checks/phone", params={"country_code": "+41", "number": "0791234567"})
    assert r.json()["state"] == "verified"
    r = client.get("/checks/phone", params={"country_code": "+852", "number": "5123 4567"})
    assert r.json() == {**r.json(), "state": "none", "report_id": None}


async def test_phone_scammer_wins_over_verified(client, cdb):
    await dn(type="verified")
    s = await dn(type="scammer")
    r = client.get("/checks/phone", params={"country_code": "+852", "number": "61234567"}).json()
    assert r["state"] == "scammer" and r["report_id"] == str(s.id)


async def test_phone_unpublished_ignored_and_invalid_422(client, cdb):
    await dn(status="draft")
    assert client.get("/checks/phone", params={"country_code": "+852", "number": "61234567"}).json()["state"] == "none"
    assert client.get("/checks/phone", params={"country_code": "+852", "number": "123"}).status_code == 422


async def test_dealer_number_detail_scammer_only(client, cdb):
    s = await dn()
    v = await dn(type="verified", e164="+41791234567", country_code="+41", phone="791234567")
    d = await dn(status="draft", e164="+85261234568")
    r = client.get(f"/checks/dealer-numbers/{s.id}")
    assert r.status_code == 200
    b = r.json()
    assert set(b) == {"id", "e164", "country_code", "phone", "country", "details", "reported_at"}
    assert "Secret" not in r.text
    assert client.get(f"/checks/dealer-numbers/{v.id}").status_code == 404
    assert client.get(f"/checks/dealer-numbers/{d.id}").status_code == 404


# --------------------------------------------------------------------------------------------
# Bracelets (resolved through the Market alias / catalogue search)
# --------------------------------------------------------------------------------------------

async def watch(ref="126334", model="Datejust 41", aliases=None, ws="WS126334"):
    from app.models.watch import Watch, WatchStatus

    w = Watch(brand="Rolex", model=model, reference=ref, ws_code=ws, status=WatchStatus.ACTIVE,
              dealer_id="d1", aliases=aliases or [])
    await w.insert()
    return w


async def bracelet(ref="126334", name="Oyster", links=13, order=0, status="published", **kw):
    from app.services.checks_normalize import normalize_reference

    b = Bracelet(reference=ref, reference_normalized=normalize_reference(ref), bracelet=name,
                 full_links=links, sort_order=order, status=status, brand="Rolex", model="Datejust 41",
                 photo_url=f"https://x/{name}.webp", photo_thumb_url=f"https://x/t/{name}.webp", **kw)
    await b.insert()
    return b


async def test_bracelets_two_rows_sorted(client, cdb):
    await watch(aliases=["Blue Jubilee"])
    await bracelet(name="Jubilee", links=12, order=2)
    await bracelet(name="Oyster", links=13, order=1, notes="Easylink")
    await bracelet(name="Draft", status="draft")
    r = client.get("/checks/bracelets", params={"reference": "126334"})
    assert r.status_code == 200
    b = r.json()
    assert b["in_catalogue"] is True and b["reference"] == "126334" and b["brand"] == "Rolex"
    assert b["model"] == "Datejust 41" and b["query"] == "126334"
    assert [x["name"] for x in b["bracelets"]] == ["Oyster", "Jubilee"]
    assert set(b["bracelets"][0]) == {"id", "name", "full_links", "notes", "photo_url", "photo_thumb_url", "sort_order"}


async def test_bracelets_resolved_via_catalogue_alias(client, cdb):
    await watch(aliases=["Blue Jubilee"])
    await bracelet()
    r = client.get("/checks/bracelets", params={"reference": "blue jubilee"})
    assert r.status_code == 200
    assert r.json()["reference"] == "126334" and len(r.json()["bracelets"]) == 1


async def test_bracelets_reference_in_catalogue_without_rows(client, cdb):
    await watch(ref="124300", model="Oyster Perpetual 41", ws="WS124300")
    r = client.get("/checks/bracelets", params={"reference": "124300"})
    assert r.status_code == 200
    assert r.json()["in_catalogue"] is True and r.json()["bracelets"] == []


async def test_bracelets_unknown_reference_404(client, cdb):
    r = client.get("/checks/bracelets", params={"reference": "NOPE999"})
    assert r.status_code == 404 and r.json() == {"detail": "Reference not found"}


async def test_bracelets_not_in_catalogue_but_rows(client, cdb):
    await bracelet(ref="Ref. 999 111")
    r = client.get("/checks/bracelets", params={"reference": "999111"})
    assert r.status_code == 200 and r.json()["in_catalogue"] is False and len(r.json()["bracelets"]) == 1


async def test_bracelets_ambiguous_prefix_is_not_guessed(client, cdb):
    await watch(ref="126334", ws="A")
    await watch(ref="126331", ws="B")
    await bracelet(ref="126334")
    r = client.get("/checks/bracelets", params={"reference": "12633"})
    assert r.status_code == 404  # neither resolved nor exact


# --------------------------------------------------------------------------------------------
# Reports
# --------------------------------------------------------------------------------------------

async def test_report_stolen(client, users, cdb):
    r = client.post("/checks/reports/stolen", json={
        "serial": "3y0r 9842", "reference": "ref. 116500ln", "brand": "Rolex", "model": "Daytona",
        "date_of_incident": "2026-05-04", "location": "Munich", "details": "Car", "photo_urls": ["https://x/a.webp"]})
    assert r.status_code == 201
    b = r.json()
    assert b["kind"] == "serial" and b["status"] == "draft"
    assert b["summary"] == "Stolen · Rolex Daytona"
    assert b["subtitle"] == "3Y0R9842 · Status: Pending review"
    d = await SerialReport.get(b["id"])
    assert d.status.value == "draft" and d.reporter_id == str(users["reporter"].id)
    assert d.type.value == "stolen" and d.serial_normalized == "3Y0R9842" and d.reference_normalized == "116500LN"
    # a draft is invisible in the check
    assert client.get("/checks/serial", params={"serial": "3Y0R9842"}).json()["matches"] == []


async def test_report_counterfeit_types(client, users, cdb):
    for t in ("counterfeit", "frankenstein", "fake_papers"):
        r = client.post("/checks/reports/counterfeit", json={
            "serial": "AB 12", "reference": "5711", "type": t, "who_offered": "Dealer Y"})
        assert r.status_code == 201
        assert r.json()["summary"].startswith({"counterfeit": "Counterfeit", "frankenstein": "Frankenstein",
                                               "fake_papers": "Fake papers"}[t])
        d = await SerialReport.get(r.json()["id"])
        assert d.type.value == t and d.who_offered == "Dealer Y" and d.status.value == "draft"
    assert client.post("/checks/reports/counterfeit", json={
        "serial": "AB 12", "reference": "5711", "type": "stolen"}).status_code == 422


async def test_report_scammer(client, users, cdb):
    r = client.post("/checks/reports/scammer", json={"country_code": "+852", "phone": "6123 4567", "details": "Took money"})
    assert r.status_code == 201
    assert r.json() == {**r.json(), "kind": "dealer_number", "status": "draft"}
    assert r.json()["subtitle"] == "+85261234567 · Status: Pending review"
    d = await DealerNumber.get(r.json()["id"])
    assert d.type.value == "scammer" and d.reporter_id == str(users["reporter"].id)


async def test_report_validation(client, cdb):
    assert client.post("/checks/reports/stolen", json={"serial": "", "reference": "x"}).status_code == 422
    assert client.post("/checks/reports/stolen", json={"serial": "1", "reference": "  "}).status_code == 422
    assert client.post("/checks/reports/stolen", json={"serial": "1", "reference": "1", "date_of_incident": "yesterday"}).status_code == 422
    assert client.post("/checks/reports/stolen", json={"serial": "1", "reference": "1", "photo_urls": ["file:///etc"]}).status_code == 422
    assert client.post("/checks/reports/scammer", json={"country_code": "+852", "phone": "12", "details": "x"}).status_code == 422
    assert client.post("/checks/reports/scammer", json={"country_code": "+852", "phone": "61234567", "details": ""}).status_code == 422


async def test_config(client, cdb):
    b = client.get("/checks/config").json()
    assert len(b["how_stolen_options"]) == 13
    assert {"value": "armed_robbery", "label": "Armed robbery"} in b["how_stolen_options"]
    assert "support_whatsapp" in b and b["countries"][0]["country_code"] == "+852"


# --------------------------------------------------------------------------------------------
# Admin CRUD, filters, privacy of internals only on admin
# --------------------------------------------------------------------------------------------

async def test_admin_crud_serial_report(client, cdb):
    r = client.post("/admin/checks/serial-reports", json={
        "type": "Fake papers", "serial": "s/n 12-34", "reference": "Ref 5711/1A", "brand": "Patek",
        "status": "published"})
    assert r.status_code == 201
    b = r.json()
    assert b["type"] == "fake_papers" and b["serial_normalized"] == "1234" and b["reference_normalized"] == "5711/1A"
    assert b["views"] == 0 and b["reporter"] is None
    iid = b["id"]
    g = client.get(f"/admin/checks/serial-reports/{iid}")
    assert g.status_code == 200 and g.json()["serial"] == "s/n 12-34"
    p = client.patch(f"/admin/checks/serial-reports/{iid}", json={"serial": "9999", "type": "stolen",
                                                                   "how_stolen": "Armed robbery"})
    assert p.json()["serial_normalized"] == "9999" and p.json()["how_stolen"] == "armed_robbery"
    assert p.json()["how_stolen_label"] == "Armed robbery"
    assert client.delete(f"/admin/checks/serial-reports/{iid}").json() == {"deleted": 1}
    assert client.get(f"/admin/checks/serial-reports/{iid}").status_code == 404


async def test_admin_validation_and_unknown_collection(client, cdb):
    assert client.post("/admin/checks/serial-reports", json={"type": "stolen", "serial": "1"}).status_code == 422
    assert client.post("/admin/checks/serial-reports", json={"type": "bogus", "serial": "1", "reference": "2"}).status_code == 422
    assert client.post("/admin/checks/dealer-numbers", json={"type": "verified", "country_code": "+852", "phone": "1"}).status_code == 422
    assert client.post("/admin/checks/bracelets", json={"reference": "1", "bracelet": "Oyster"}).status_code == 422
    assert client.post("/admin/checks/bracelets", json={"reference": "1", "bracelet": "O", "full_links": 1, "status": "rejected"}).status_code == 422
    assert client.get("/admin/checks/watches").status_code == 404


async def test_admin_dealer_number_and_bracelet_crud(client, cdb):
    r = client.post("/admin/checks/dealer-numbers", json={
        "type": "verified", "country_code": "+852", "phone": "(6123) 4567", "name": "Acme", "country": "Hong Kong"})
    assert r.status_code == 201 and r.json()["e164"] == "+85261234567"
    iid = r.json()["id"]
    p = client.patch(f"/admin/checks/dealer-numbers/{iid}", json={"country_code": "+41", "phone": "079 123 45 67"})
    assert p.json()["e164"] == "+41791234567"
    r = client.post("/admin/checks/bracelets", json={"reference": "126334", "bracelet": "Oyster", "full_links": "13",
                                                      "sort_order": 1, "photo_url": "https://x/o.webp"})
    assert r.status_code == 201 and r.json()["full_links"] == 13 and r.json()["reference_normalized"] == "126334"


async def test_admin_list_search_filter_paginate(client, users, cdb):
    for i in range(5):
        await sr(serial=f"AAA{i}", serial_normalized=f"AAA{i}", reference_normalized="X",
                 reporter_id=str(users["reporter"].id) if i == 0 else None)
    await sr(serial="ZZZ 1", serial_normalized="ZZZ1", type="counterfeit", status="draft")
    r = client.get("/admin/checks/serial-reports", params={"page_size": 2, "page": 3}).json()
    assert r["total"] == 6 and r["page"] == 3 and r["page_size"] == 2 and len(r["items"]) == 2
    assert client.get("/admin/checks/serial-reports", params={"status": "draft"}).json()["total"] == 1
    assert client.get("/admin/checks/serial-reports", params={"type": "counterfeit"}).json()["total"] == 1
    assert client.get("/admin/checks/serial-reports", params={"search": "zzz-1"}).json()["total"] == 1
    items = client.get("/admin/checks/serial-reports", params={"search": "AAA0"}).json()["items"]
    assert items[0]["reporter"] == {"id": str(users["reporter"].id), "name": "Rita Reporter", "email": "rep@x.io"}
    assert client.get("/admin/checks/serial-reports", params={"search": "AAA"}).json()["total"] == 5


async def test_draft_counts(client, cdb):
    await sr(status="draft")
    await sr(status="draft", serial="2", serial_normalized="2")
    await sr(status="published", serial="3", serial_normalized="3")
    await dn(status="draft")
    assert client.get("/admin/checks/draft-counts").json() == {"serial_reports": 2, "dealer_numbers": 1}


# --------------------------------------------------------------------------------------------
# Publish / reject notifications
# --------------------------------------------------------------------------------------------

async def test_publish_creates_activity_and_push(client, users, pushes, cdb):
    from app.models.notification import Notification

    d = await sr(status="draft", reporter_id=str(users["reporter"].id))
    p = client.patch(f"/admin/checks/serial-reports/{d.id}", json={"status": "published", "how_stolen": "burglary"})
    assert p.status_code == 200 and p.json()["status"] == "published"
    notes = await Notification.find({"user_id": str(users["reporter"].id)}).to_list()
    assert len(notes) == 1 and notes[0].type.value == "check_report"
    assert notes[0].data["status"] == "published" and notes[0].data["report_id"] == str(d.id)
    assert notes[0].data["kind"] == "serial"
    assert len(pushes) == 1 and pushes[0]["user"] == str(users["reporter"].id)
    assert pushes[0]["data"]["type"] == "check_report"
    # saving again does not notify again
    client.patch(f"/admin/checks/serial-reports/{d.id}", json={"details": "more"})
    assert len(pushes) == 1


async def test_reject_via_bulk_edit_notifies_and_no_reporter_does_not(client, users, pushes, cdb):
    from app.models.notification import Notification

    a = await dn(status="draft", reporter_id=str(users["reporter"].id))
    b = await dn(status="draft", e164="+85261234568", phone="6123 4568")
    r = client.post("/admin/checks/dealer-numbers/bulk-edit", json={"ids": [str(a.id), str(b.id)], "set": {"status": "rejected"}})
    assert r.json() == {"updated": 2}
    notes = await Notification.find({}).to_list()
    assert len(notes) == 1 and notes[0].data["status"] == "rejected" and notes[0].data["kind"] == "dealer_number"
    assert len(pushes) == 1


async def test_published_rows_never_notify(client, users, pushes, cdb):
    d = await sr(status="published", reporter_id=str(users["reporter"].id))
    client.patch(f"/admin/checks/serial-reports/{d.id}", json={"status": "rejected"})
    assert pushes == []


# --------------------------------------------------------------------------------------------
# Bulk edit / delete
# --------------------------------------------------------------------------------------------

async def test_bulk_edit_type_status_and_field(client, cdb):
    a, b = await sr(serial="1", serial_normalized="1"), await sr(serial="2", serial_normalized="2")
    r = client.post("/admin/checks/serial-reports/bulk-edit", json={
        "ids": [str(a.id), str(b.id)], "set": {"type": "frankenstein", "status": "draft", "location": "Zurich"}})
    assert r.json() == {"updated": 2}
    for i in (a.id, b.id):
        d = await SerialReport.get(i)
        assert d.type.value == "frankenstein" and d.status.value == "draft" and d.location == "Zurich"


async def test_bulk_edit_rejects_bad_fields_and_values(client, cdb):
    a = await sr()
    assert client.post("/admin/checks/serial-reports/bulk-edit", json={"ids": [str(a.id)], "set": {"reporter_id": "x"}}).status_code == 422
    assert client.post("/admin/checks/serial-reports/bulk-edit", json={"ids": [str(a.id)], "set": {"status": "nope"}}).status_code == 422
    assert (await SerialReport.get(a.id)).status.value == "published"


async def test_bulk_delete(client, cdb):
    a, b, c = await sr(serial="1", serial_normalized="1"), await sr(serial="2", serial_normalized="2"), await sr(serial="3", serial_normalized="3")
    r = client.post("/admin/checks/serial-reports/bulk-delete", json={"ids": [str(a.id), str(b.id)]})
    assert r.json() == {"deleted": 2}
    assert await SerialReport.find({}).count() == 1


async def test_admin_activity_log_written(client, cdb):
    from app.models.activity_log import ActivityLog

    client.post("/admin/checks/bracelets", json={"reference": "1", "bracelet": "O", "full_links": 1})
    logs = await ActivityLog.find({}).to_list()
    assert len(logs) == 1 and logs[0].metadata["collection"] == "bracelets" and logs[0].platform == "admin"


# --------------------------------------------------------------------------------------------
# Import
# --------------------------------------------------------------------------------------------

def to_csv(rows, cols):
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(cols)
    w.writerows(rows)
    return buf.getvalue().encode()


def to_xlsx(rows, cols):
    import openpyxl

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.append(cols)
    for r in rows:
        ws.append(r)
    out = io.BytesIO()
    wb.save(out)
    return out.getvalue()


def make_zip(files):
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as z:
        for n, d in files.items():
            z.writestr(n, d)
    return buf.getvalue()


SERIAL_COLS = ["type", "serial", "brand", "model", "reference", "how_stolen", "date", "location",
               "who_offered", "details", "status", "photo_filename"]


def preview(client, coll, content, name="f.csv", zip_bytes=None):
    files = {"file": (name, content)}
    if zip_bytes is not None:
        files["photos"] = ("photos.zip", zip_bytes, "application/zip")
    return client.post(f"/admin/checks/{coll}/import/preview", files=files)


async def test_import_serial_reports_csv_new_invalid_and_commit(client, cdb):
    content = to_csv([
        ["stolen", "3Y0R 9842", "Rolex", "Daytona", "116500LN", "Burglary", "2026-01-02", "Munich", "", "Story", "published", ""],
        ["counterfeit", "8V7K2310", "", "", "5711", "", "", "", "Mr X", "", "", ""],
        ["bogus", "1", "", "", "2", "", "", "", "", "", "", ""],
        ["stolen", "", "", "", "2", "", "", "", "", "", "", ""],
        ["stolen", "3y0r9842", "Rolex", "Daytona", "ref 116500LN", "", "", "", "", "", "", ""],
    ], SERIAL_COLS)
    r = preview(client, "serial-reports", content)
    assert r.status_code == 200
    rows = r.json()["rows"]
    assert [x["status"] for x in rows] == ["new", "new", "invalid", "invalid", "duplicate"]
    assert [x["row"] for x in rows] == [2, 3, 4, 5, 6]
    assert rows[0]["data"]["serial_normalized"] == "3Y0R9842" and rows[0]["data"]["how_stolen"] == "burglary"
    assert "Same as row 2" in rows[4]["message"]
    token = r.json()["token"]
    assert await SerialReport.find({}).count() == 0  # preview writes nothing
    c = client.post("/admin/checks/serial-reports/import/commit", json={"token": token, "duplicates": "skip"})
    assert c.json() == {"created": 2, "updated": 0, "skipped": 3}
    docs = await SerialReport.find({}).to_list()
    assert {d.status.value for d in docs} == {"published"}  # blank status defaults to published
    assert client.post("/admin/checks/serial-reports/import/commit", json={"token": token}).status_code == 404


async def test_import_xlsx_duplicates_update_existing(client, cdb):
    existing = await sr(serial="3Y0R9842", serial_normalized="3Y0R9842", location="Old", details="Old story")
    content = to_xlsx([["stolen", "3y0r 9842", "Rolex", "Daytona", "116500LN", "", None, "Zurich", "", None, "", ""],
                       ["stolen", "NEW1", "Omega", "", "311.30", "", None, "", "", None, "draft", ""]], SERIAL_COLS)
    r = preview(client, "serial-reports", content, name="f.xlsx")
    rows = r.json()["rows"]
    assert rows[0]["status"] == "duplicate" and rows[0]["existing_id"] == str(existing.id)
    assert rows[1]["status"] == "new"
    skip = client.post("/admin/checks/serial-reports/import/commit", json={"token": r.json()["token"], "duplicates": "skip"})
    assert skip.json() == {"created": 1, "updated": 0, "skipped": 1}
    assert (await SerialReport.get(existing.id)).location == "Old"

    await SerialReport.find({"serial_normalized": "NEW1"}).delete()
    r = preview(client, "serial-reports", content, name="f.xlsx")
    c = client.post("/admin/checks/serial-reports/import/commit", json={"token": r.json()["token"], "duplicates": "update"})
    assert c.json() == {"created": 1, "updated": 1, "skipped": 0}
    d = await SerialReport.get(existing.id)
    assert d.location == "Zurich" and d.details == "Old story" and d.status.value == "published"  # blanks keep values


async def test_import_dealer_numbers_invalid_phone_and_conflict(client, cdb):
    await dn(type="verified", e164="+85261234567", status="published", name="Acme")
    cols = ["type", "country_code", "phone", "name", "country", "details", "status"]
    content = to_csv([
        ["scammer", "+852", "6123 4567", "", "Hong Kong", "Fraud", "published"],   # conflict with existing verified
        ["verified", "+852", "5123 4567", "Good Co", "Hong Kong", "", "published"],  # new
        ["verified", "+852", "123", "Bad", "", "", "published"],                    # invalid
        ["scammer", "+41", "79 123 45 67", "", "", "Bad", ""],                      # new
        ["verified", "+41", "079 123 45 67", "", "", "", ""],                       # conflict with row 5 in file
        ["verified", "+852", "6123 4567", "Acme", "", "", ""],                      # duplicate of existing
    ], cols)
    r = preview(client, "dealer-numbers", content)
    st = [x["status"] for x in r.json()["rows"]]
    assert st == ["conflict", "new", "invalid", "new", "conflict", "duplicate"]
    assert "Not a valid phone" in r.json()["rows"][2]["message"]
    assert "verified" in r.json()["rows"][0]["message"]
    token = r.json()["token"]
    c = client.post("/admin/checks/dealer-numbers/import/commit", json={"token": token})
    assert c.json() == {"created": 2, "updated": 0, "skipped": 4}  # conflicts skipped by default


async def test_import_conflicts_can_be_imported_and_rows_skipped(client, cdb):
    await dn(type="verified")
    cols = ["type", "country_code", "phone", "details"]
    content = to_csv([["scammer", "+852", "6123 4567", "x"], ["scammer", "+852", "5123 4567", "y"]], cols)
    r = preview(client, "dealer-numbers", content)
    c = client.post("/admin/checks/dealer-numbers/import/commit", json={
        "token": r.json()["token"], "conflicts": "import", "skip_rows": [3]})
    assert c.json() == {"created": 1, "updated": 0, "skipped": 1}
    assert await DealerNumber.find({"type": "scammer"}).count() == 1


async def test_import_bracelets_with_photos_zip(client, cdb):
    cols = ["brand", "model", "reference", "bracelet", "full_links", "notes", "sort_order", "status", "photo_filename"]
    content = to_csv([
        ["Rolex", "Datejust 41", "126334", "Oyster", "13", "Easylink", "1", "published", "oyster.jpg"],
        ["Rolex", "Datejust 41", "126334", "Jubilee", "12", "", "2", "published", "missing.jpg"],
        ["Rolex", "Datejust 41", "126334", "oyster", "13", "", "1", "", ""],
        ["Rolex", "Datejust 41", "126334", "President", "x", "", "", "", ""],
    ], cols)
    z = make_zip({"photos/oyster.jpg": b"abc", "__MACOSX/._oyster.jpg": b"x"})
    r = preview(client, "bracelets", content, zip_bytes=z)
    assert r.status_code == 200
    rows = r.json()["rows"]
    assert [x["status"] for x in rows] == ["new", "new", "duplicate", "invalid"]
    assert rows[0]["data"]["photo_url"].startswith("https://cdn.test/checks/")
    assert "Photo not found in ZIP: missing.jpg" in rows[1]["message"]
    c = client.post("/admin/checks/bracelets/import/commit", json={"token": r.json()["token"]})
    assert c.json() == {"created": 2, "updated": 0, "skipped": 2}
    oyster = await Bracelet.find_one({"bracelet": "Oyster"})
    assert oyster.photo_url and oyster.photo_thumb_url and oyster.full_links == 13 and oyster.sort_order == 1


async def test_import_bad_files(client, cdb):
    assert preview(client, "serial-reports", b"", name="e.csv").status_code == 422
    assert preview(client, "serial-reports", to_csv([], SERIAL_COLS)).status_code == 422
    r = preview(client, "serial-reports", to_csv([["stolen", "1", "", "", "2", "", "", "", "", "", "", "a.jpg"]], SERIAL_COLS),
                zip_bytes=b"not a zip")
    assert r.status_code == 422
    assert client.post("/admin/checks/serial-reports/import/commit", json={"token": "bad"}).status_code == 404


async def test_import_commit_wrong_collection(client, cdb):
    r = preview(client, "serial-reports", to_csv([["stolen", "1", "", "", "2", "", "", "", "", "", "", ""]], SERIAL_COLS))
    assert client.post("/admin/checks/bracelets/import/commit", json={"token": r.json()["token"]}).status_code == 404


async def test_import_update_publishing_draft_report_notifies(client, users, pushes, cdb):
    d = await sr(status="draft", reporter_id=str(users["reporter"].id))
    content = to_csv([["stolen", "3Y0R9842", "", "", "116500LN", "", "", "", "", "", "published", ""]], SERIAL_COLS)
    r = preview(client, "serial-reports", content)
    client.post("/admin/checks/serial-reports/import/commit", json={"token": r.json()["token"], "duplicates": "update"})
    assert (await SerialReport.get(d.id)).status.value == "published"
    assert len(pushes) == 1


# --------------------------------------------------------------------------------------------
# Export + round trip
# --------------------------------------------------------------------------------------------

async def test_export_columns_filters_and_round_trip(client, cdb):
    await sr(how_stolen="burglary", date_of_incident="2026-01-02", photos=[])
    await sr(serial="Q1", serial_normalized="Q1", type="counterfeit", status="draft", who_offered="Z", reference="5711", reference_normalized="5711")
    r = client.get("/admin/checks/serial-reports/export", params={"format": "csv"})
    assert r.status_code == 200 and "text/csv" in r.headers["content-type"]
    rows = list(csv.reader(io.StringIO(r.content.decode("utf-8-sig"))))
    assert rows[0] == SERIAL_COLS and len(rows) == 3
    only = client.get("/admin/checks/serial-reports/export", params={"status": "draft"})
    assert len(list(csv.reader(io.StringIO(only.content.decode("utf-8-sig"))))) == 2

    # re-import the exported file with "update existing": everything is a duplicate, nothing breaks
    p = preview(client, "serial-reports", r.content)
    assert [x["status"] for x in p.json()["rows"]] == ["duplicate", "duplicate"]
    c = client.post("/admin/checks/serial-reports/import/commit", json={"token": p.json()["token"], "duplicates": "update"})
    assert c.json() == {"created": 0, "updated": 2, "skipped": 0}
    assert await SerialReport.find({}).count() == 2
    d = await SerialReport.find_one({"serial_normalized": "Q1"})
    assert d.status.value == "draft" and d.who_offered == "Z"


async def test_export_xlsx_all_collections_columns(client, cdb):
    import openpyxl

    await dn()
    await bracelet()
    for coll, cols in (("dealer-numbers", ["type", "country_code", "phone", "name", "country", "details", "status", "photo_filename"]),
                       ("bracelets", ["brand", "model", "reference", "bracelet", "full_links", "notes", "sort_order", "status", "photo_filename"]),
                       ("serial-reports", SERIAL_COLS)):
        r = client.get(f"/admin/checks/{coll}/export", params={"format": "xlsx"})
        assert r.status_code == 200
        ws = openpyxl.load_workbook(io.BytesIO(r.content)).worksheets[0]
        assert [c.value for c in ws[1]] == cols
    r = client.get("/admin/checks/bracelets/export", params={"format": "xlsx"})
    ws = openpyxl.load_workbook(io.BytesIO(r.content)).worksheets[0]
    assert ws.max_row == 2


async def test_export_photos_zip_matches_photo_filename_column(client, cdb):
    d = await sr(photos=["https://x/a.webp", "https://x/b.jpg"])
    r = client.get("/admin/checks/serial-reports/export-photos")
    assert r.status_code == 200 and r.headers["content-type"] == "application/zip"
    names = zipfile.ZipFile(io.BytesIO(r.content)).namelist()
    assert names == [f"{d.id}_1.webp", f"{d.id}_2.jpg"]
    csv_rows = list(csv.reader(io.StringIO(client.get("/admin/checks/serial-reports/export").content.decode("utf-8-sig"))))
    assert csv_rows[1][-1] == ";".join(names)


async def test_export_round_trip_dealer_numbers_and_bracelets(client, cdb):
    await dn(type="verified", details=None)
    await bracelet(notes="Easylink")
    for coll in ("dealer-numbers", "bracelets"):
        r = client.get(f"/admin/checks/{coll}/export")
        p = preview(client, coll, r.content)
        assert [x["status"] for x in p.json()["rows"]] == ["duplicate"]
