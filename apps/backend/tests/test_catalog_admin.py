"""Catalog admin: edit import semantics, import checks, file-name matching, export, undo.

Spec: "Uploading and editing watches" (§1–§8). The planners are pure, so most tests work on
plain dicts; the undo round-trip runs against the in-memory Mongo stub.
"""
from datetime import datetime

import pytest
import pytest_asyncio

from app.services.catalog_admin import (
    ParsedRows,
    build_image_index,
    build_watch_query,
    classify_upload_path,
    compute_changes,
    export_csv,
    export_record,
    format_summary,
    match_image_names,
    normalize_match_key,
    normalize_row,
    parse_import_text,
    plan_bulk_import,
    plan_edit_import,
    resolve_ws_conflicts,
    trim_strings,
)
from app.services.undo import plan_undo, snapshot_fields

ID_A = "66f1000000000000000000a2"
ID_B = "66f1000000000000000000b7"
ID_C = "66f1000000000000000000c9"


def _watch(wid, ws_code=None, **kw):
    base = {
        "id": wid, "brand": "Patek Philippe", "model": "Calatrava", "reference": None,
        "collection": None, "oem_references": [], "dial": None, "bracelet": None,
        "ws_code": ws_code, "aliases": [], "description": None, "status": "active",
        "cover_image": None, "cover_image_thumbnail": None, "images": [], "image_thumbnails": [],
        "image_paths": [], "featured": False, "trending": False, "is_popular_search": False,
        "discontinued": False, "list_prices": {}, "published_at": datetime(2026, 1, 1),
    }
    base.update(kw)
    return base


def _catalog(*watches):
    return {w["id"]: w for w in watches}


def _rows(*rows):
    return ParsedRows(rows=list(enumerate(rows, start=1)))


# ---------------------------------------------------------------------------------- trimming

class TestTrimming:
    def test_trims_nested_strings(self):
        assert trim_strings({" brand ": "Rolex ", "aliases": [" a ", "b"], "lp": {"HK": " 1 "}}) == {
            "brand": "Rolex", "aliases": ["a", "b"], "lp": {"HK": "1"},
        }

    def test_normalize_row_trims_and_renames(self):
        norm = normalize_row({"id": " x ", "brand": "Rolex ", "image": " http://i ", "popular": "yes"})
        assert norm.row_id == "x"
        assert norm.values == {"brand": "Rolex", "cover_image": "http://i", "is_popular_search": True}

    def test_empty_brand_is_an_error(self):
        assert normalize_row({"brand": "  "}).errors == ["brand cannot be empty"]
        assert normalize_row({"model": None}).errors == ["model cannot be empty"]

    def test_unknown_column_is_a_warning(self):
        norm = normalize_row({"id": "x", "colour": "red"})
        assert norm.errors == [] and "colour" in norm.warnings[0]

    def test_exported_read_only_columns_are_ignored_silently(self):
        norm = normalize_row({"id": "x", "created_at": "2026", "views": 3})
        assert norm.values == {} and norm.warnings == []


# ---------------------------------------------------------------------------------- list prices

class TestListPrices:
    def test_dict_and_columns_merge(self):
        norm = normalize_row({"list_prices": {"hk": 599000, "UK": "12,500"}, "list_price_DE": "69500"})
        assert norm.values["list_prices"] == {"HK": 599000, "GB": 12500, "DE": 69500}

    def test_unknown_country_is_an_error(self):
        assert normalize_row({"list_prices": {"XX": 1}}).errors == ["list_prices: unknown country 'XX'"]
        assert normalize_row({"list_price_XX": 1}).errors == ["list_price_XX: unknown country"]

    def test_merge_per_country_and_clear(self):
        current = _watch(ID_A, list_prices={"HK": 1, "DE": 2})
        norm = normalize_row({"list_prices": {"HK": 5, "DE": None, "SG": 7}})
        assert compute_changes(current, norm.values)["list_prices"] == {"HK": 5, "SG": 7}
        cleared = normalize_row({"list_prices": None})
        assert compute_changes(current, cleared.values)["list_prices"] == {}

    def test_negative_price_rejected(self):
        assert normalize_row({"list_price_HK": -5}).errors


# ---------------------------------------------------------------------------------- edit semantics

class TestEditSemantics:
    def test_present_overwrites_missing_keeps_null_clears(self):
        current = _watch(ID_A, "5811/1G", dial="Blue", bracelet="Leather", collection="Nautilus")
        norm = normalize_row({"dial": "Grey", "bracelet": None})
        changes = compute_changes(current, norm.values)
        assert changes == {"dial": "Grey", "bracelet": None}

    def test_aliases_are_added_not_replaced(self):
        current = _watch(ID_A, aliases=["5811g", "5811 white gold"])
        changes = compute_changes(current, normalize_row({"aliases": ["5811g", "5811/1G new"]}).values)
        assert changes == {"aliases": ["5811g", "5811 white gold", "5811/1G new"]}

    def test_aliases_null_clears(self):
        current = _watch(ID_A, aliases=["x"])
        assert compute_changes(current, normalize_row({"aliases": None}).values) == {"aliases": []}

    def test_old_ws_code_does_not_become_alias(self):
        current = _watch(ID_A, "5811", aliases=[])
        changes = compute_changes(current, normalize_row({"ws_code": "5811/1G"}).values)
        assert changes == {"ws_code": "5811/1G"}

    def test_unchanged_value_is_not_a_change(self):
        current = _watch(ID_A, "5811/1G", discontinued=True)
        assert compute_changes(current, normalize_row({"ws_code": "5811/1G ", "discontinued": "true"}).values) == {}

    def test_activating_sets_published_at(self):
        now = datetime(2026, 11, 8)
        current = _watch(ID_A, status="draft", published_at=None)
        assert compute_changes(current, {"status": "active"}, now) == {"status": "active", "published_at": now}

    def test_image_change_replaces_image_set(self):
        current = _watch(ID_A, cover_image="old", cover_image_thumbnail="old_t", images=["old"])
        changes = compute_changes(current, normalize_row({"image": "new"}).values)
        assert changes["cover_image"] == "new" and changes["images"] == ["new"]
        assert changes["cover_image_thumbnail"] is None


# ---------------------------------------------------------------------------------- planning

class TestPlanEditImport:
    def test_pdf_example(self):
        catalog = _catalog(_watch(ID_A, "5811"), _watch(ID_B, "5711"))
        parsed = parse_import_text(
            '{"id": "%s", "ws_code": "5811/1G", "aliases": ["5811g"], "list_prices": {"HK": 599000, "DE": 69500}}\n'
            '{"id": "%s", "discontinued": true}\n' % (ID_A, ID_B)
        )
        plan = plan_edit_import(parsed, catalog)
        assert plan["summary"] == "2 watches · 1 WS code changed · 0 errors"
        changes = {p["id"]: p["changes"] for p in plan["plans"]}
        assert changes[ID_A] == {"ws_code": "5811/1G", "aliases": ["5811g"], "list_prices": {"HK": 599000, "DE": 69500}}
        assert changes[ID_B] == {"discontinued": True}

    def test_errors_are_skipped_and_listed(self):
        catalog = _catalog(_watch(ID_A, "5811"))
        parsed = parse_import_text('{"id": "%s", "dial": "Blue"}\n{"id": "nope"}\nnot json\n{"dial": "x"}\n' % ID_A)
        plan = plan_edit_import(parsed, catalog)
        assert plan["updated"] == 1 and plan["errors"] == 3
        errors = {r["line"]: r["errors"] for r in plan["results"] if r["action"] == "error"}
        assert "no watch with id nope" in errors[2]
        assert errors[3][0].startswith("invalid JSON")
        assert "missing id" in errors[4]

    def test_duplicate_ws_code_vs_db_rejects_row(self):
        catalog = _catalog(_watch(ID_A, "5811"), _watch(ID_B, "5711/1A"))
        plan = plan_edit_import(_rows({"id": ID_A, "ws_code": "5711/1a"}), catalog)
        assert plan["errors"] == 1 and plan["plans"] == []
        assert "already used by watch" in plan["results"][0]["errors"][0]

    def test_duplicate_ws_code_within_file_first_wins(self):
        catalog = _catalog(_watch(ID_A, "1"), _watch(ID_B, "2"))
        plan = plan_edit_import(_rows({"id": ID_A, "ws_code": "X"}, {"id": ID_B, "ws_code": "X"}), catalog)
        assert [p["id"] for p in plan["plans"]] == [ID_A]
        assert "also set on line 1" in plan["results"][1]["errors"][0]

    def test_swapping_ws_codes_is_allowed(self):
        catalog = _catalog(_watch(ID_A, "1"), _watch(ID_B, "2"))
        plan = plan_edit_import(_rows({"id": ID_A, "ws_code": "2"}, {"id": ID_B, "ws_code": "1"}), catalog)
        assert plan["errors"] == 0 and plan["ws_codes_changed"] == 2

    def test_same_id_twice_rejects_second(self):
        catalog = _catalog(_watch(ID_A, "1"))
        plan = plan_edit_import(_rows({"id": ID_A, "dial": "a"}, {"id": ID_A, "dial": "b"}), catalog)
        assert plan["updated"] == 1 and plan["errors"] == 1

    def test_alias_used_by_other_watch_is_a_warning(self):
        catalog = _catalog(_watch(ID_A, "1"), _watch(ID_B, "5711", aliases=["Nautilus Blue"]))
        plan = plan_edit_import(_rows({"id": ID_A, "aliases": ["nautilus blue", "5711"]}), catalog)
        assert plan["updated"] == 1 and plan["errors"] == 0
        assert len(plan["results"][0]["warnings"]) == 2

    def test_summary_wording(self):
        assert format_summary(312, 280, 3) == "312 watches · 280 WS codes changed · 3 errors"
        assert format_summary(1, 1, 1) == "1 watch · 1 WS code changed · 1 error"


class TestResolveWsConflicts:
    def test_pre_existing_db_duplicates_are_not_blamed_on_the_file(self):
        current = {"a": "X", "b": "X", "c": "Y"}
        assert resolve_ws_conflicts(current, {"c": (1, "Z")}) == {}

    def test_moving_onto_taken_code_rejected(self):
        assert list(resolve_ws_conflicts({"a": "X", "b": "Y"}, {"a": (4, "y")})) == [4]


# ---------------------------------------------------------------------------------- CSV

class TestCsv:
    def test_empty_cell_missing_null_clears_lists_split(self):
        text = "id;dial;bracelet;aliases;list_price_HK\n%s;;null;a | b ;599000\n" % ID_A
        parsed = parse_import_text(text)
        assert parsed.rows == [(2, {"id": ID_A, "bracelet": None, "aliases": "a | b", "list_price_HK": "599000"})]
        norm = normalize_row(parsed.rows[0][1])
        assert norm.values == {"bracelet": None, "aliases": ["a", "b"], "list_prices": {"HK": 599000}}

    def test_export_csv_round_trips_through_edit_import(self):
        w = _watch(ID_A, "5811/1G", aliases=["a", "b"], list_prices={"DE": 69500, "HK": 599000}, discontinued=True)
        text = "".join(export_csv([w]))
        plan = plan_edit_import(parse_import_text(text), _catalog(w))
        assert plan["errors"] == 0 and plan["updated"] == 0 and plan["unchanged"] == 1

    def test_export_jsonl_round_trips(self):
        w = _watch(ID_A, "5811/1G", aliases=["a"], list_prices={"HK": 1}, cover_image="http://x")
        import json
        plan = plan_edit_import(parse_import_text(json.dumps(export_record(w))), _catalog(w))
        assert plan["errors"] == 0 and plan["unchanged"] == 1 and plan["results"][0]["warnings"] == []

    def test_export_record_fields(self):
        rec = export_record(_watch(ID_A, "1", status="draft", is_popular_search=True, cover_image="u"))
        assert rec["id"] == ID_A and rec["status"] == "draft" and rec["popular"] is True and rec["image"] == "u"
        assert set(rec) >= {"featured", "trending", "discontinued", "list_prices"}


# ---------------------------------------------------------------------------------- bulk import

class TestPlanBulkImport:
    def test_same_reference_is_not_a_duplicate(self):
        catalog = _catalog(_watch(ID_A, "RM67-02 Italy", reference="RM67-02"))
        plan = plan_bulk_import(_rows({"brand": "Richard Mille", "model": "RM67-02", "reference": "RM67-02", "ws_code": "RM67-02 France"}), catalog)
        assert plan["created"] == 1 and plan["skipped"] == 0

    def test_ws_code_or_oem_duplicate_is_skipped(self):
        catalog = _catalog(_watch(ID_A, "126610LN", oem_references=["126610LN-0001"]))
        plan = plan_bulk_import(_rows(
            {"brand": "Rolex", "model": "Sub", "ws_code": "126610ln"},
            {"brand": "Rolex", "model": "Sub", "oem_references": ["126610LN/0001"]},
        ), catalog)
        assert plan["skipped"] == 2 and plan["created"] == 0

    def test_duplicate_within_file_rejected(self):
        plan = plan_bulk_import(_rows(
            {"brand": "Rolex", "model": "Sub", "ws_code": "A"},
            {"brand": "Rolex", "model": "Sub", "ws_code": " a "},
        ), {})
        assert plan["created"] == 1 and plan["errors"] == 1

    def test_trims_and_accepts_list_prices(self):
        plan = plan_bulk_import(_rows({"brand": "Rolex ", "model": " Sub", "list_price_HK": "100", "discontinued": True}), {})
        fields = plan["creates"][0]["fields"]
        assert fields["brand"] == "Rolex" and fields["model"] == "Sub"
        assert fields["list_prices"] == {"HK": 100} and fields["discontinued"] is True

    def test_update_mode_adds_aliases(self):
        catalog = _catalog(_watch(ID_A, "A", aliases=["x"]))
        plan = plan_bulk_import(_rows({"brand": "Rolex", "model": "Sub", "ws_code": "A", "aliases": ["y"]}), catalog, "update")
        assert plan["updates"][0]["changes"]["aliases"] == ["x", "y"]

    def test_missing_brand_is_error(self):
        plan = plan_bulk_import(_rows({"model": "Sub"}), {})
        assert plan["errors"] == 1


# ---------------------------------------------------------------------------------- images

class TestImageMatching:
    def _index(self):
        watches = [
            _watch(ID_A, "5811/1G", oem_references=["5811/1G-001"]),
            _watch(ID_B, "126610LN", oem_references=["126610LN-0001"]),
            _watch(ID_C, "RM67", oem_references=["126610LN-0001"]),
        ]
        return build_image_index(watches)

    def test_normalize_key(self):
        assert normalize_match_key("5811/1G") == normalize_match_key("5811_1g") == normalize_match_key("5811-1G")

    def test_classify(self):
        assert classify_upload_path("__MACOSX/x/._a.png")[0] == "ignore"
        assert classify_upload_path("photos/._a.png")[0] == "ignore"
        assert classify_upload_path("notes.txt")[0] == "not_image"
        assert classify_upload_path("dir/5811-1G.JPG") == ("image", "5811-1G")

    def test_match_by_id_ws_code_and_oem(self):
        out = match_image_names([f"{ID_A}.png", "126610ln.webp", "5811_1G-001.jpg"], self._index())
        assert [(m["watch_id"], m["matched_by"]) for m in out["matched"]] == [(ID_A, "id"), (ID_B, "ws_code")]
        # third file hits ID_A again → one image per watch
        assert out["unmatched"][0]["file"] == "5811_1G-001.jpg"

    def test_ambiguous_and_unknown_are_unmatched(self):
        out = match_image_names(["126610LN-0001.png", "nothing.png", "__MACOSX/._x.png"], self._index())
        reasons = {u["file"]: u["reason"] for u in out["unmatched"]}
        assert reasons["126610LN-0001.png"].startswith("matches 2 watches")
        assert "no watch" in reasons["nothing.png"]
        assert out["ignored"][0]["file"] == "__MACOSX/._x.png"

    def test_already_matched_in_earlier_chunk(self):
        out = match_image_names(["5811-1G.png"], self._index(), already_matched={ID_A: "an earlier upload"})
        assert out["matched"] == [] and "earlier upload" in out["unmatched"][0]["reason"]


# ---------------------------------------------------------------------------------- filters

class TestWatchQuery:
    def test_empty(self):
        assert build_watch_query() == {}

    def test_combines_with_and(self):
        q = build_watch_query(status="draft", brand="Rolex", no_image=True, no_list_price=True)
        assert q["$and"][0] == {"status": "draft"} and len(q["$and"]) == 4

    def test_ids_skip_invalid(self):
        q = build_watch_query(ids=[ID_A, "bad"])
        assert len(q["_id"]["$in"]) == 1


# ---------------------------------------------------------------------------------- undo

class TestUndoPure:
    def test_snapshot_is_a_copy(self):
        current = {"aliases": ["a"], "list_prices": {"HK": 1}}
        snap = snapshot_fields(current, ["aliases", "list_prices", "missing"])
        current["aliases"].append("b")
        assert snap == {"aliases": ["a"], "list_prices": {"HK": 1}, "missing": None}

    def test_plan_undo_newest_first(self):
        assert [e["seq"] for e in plan_undo([{"seq": 1}, {"seq": 3}, {"seq": 2}])] == [3, 2, 1]


@pytest_asyncio.fixture
async def catalog_db():
    from beanie import init_beanie
    from mongomock_motor import AsyncMongoMockClient

    from app.models.change_batch import ChangeBatch, ChangeBatchEntry
    from app.models.watch import Watch

    client = AsyncMongoMockClient()
    await init_beanie(database=client["catalog_test"], document_models=[Watch, ChangeBatch, ChangeBatchEntry])
    yield client


@pytest.mark.asyncio
async def test_undo_round_trip(catalog_db):
    from app.models.watch import Watch
    from app.services.catalog_admin import load_catalog, write_update_plans
    from app.services.undo import ChangeBatchRecorder, undo_batch

    a = Watch(brand="Patek", model="Calatrava", ws_code="5811", aliases=["x"], dealer_id="d",
              cover_image="old.webp", images=["old.webp"])
    b = Watch(brand="Rolex", model="Sub", ws_code="126610LN", dealer_id="d")
    await a.insert()
    await b.insert()

    # 1) edit import
    catalog = await load_catalog()
    plan = plan_edit_import(_rows(
        {"id": str(a.id), "ws_code": "5811/1G", "aliases": ["5811g"], "image": "new.webp", "list_prices": {"HK": 1}},
    ), catalog)
    rec = ChangeBatchRecorder("edit_import", plan["summary"])
    await write_update_plans(plan["plans"], catalog, rec)
    edited = await Watch.get(a.id)
    assert edited.ws_code == "5811/1G" and edited.aliases == ["x", "5811g"] and edited.cover_image == "new.webp"

    # 2) delete b, 3) create c
    del_rec = ChangeBatchRecorder("bulk_action", "delete")
    del_rec.record_delete(b)
    await del_rec.save()
    await b.delete()
    c = Watch(brand="New", model="One", dealer_id="d")
    await c.insert()
    create_rec = ChangeBatchRecorder("bulk_import", "create")
    create_rec.record_create(str(c.id))
    await create_rec.save()

    await undo_batch(str(create_rec.batch.id))
    assert await Watch.get(c.id) is None

    await undo_batch(str(del_rec.batch.id))
    restored_b = await Watch.get(b.id)
    assert restored_b is not None and restored_b.ws_code == "126610LN"

    result = await undo_batch(str(rec.batch.id))
    assert result["restored"] == 1
    back = await Watch.get(a.id)
    assert back.ws_code == "5811" and back.aliases == ["x"] and back.cover_image == "old.webp"
    assert back.images == ["old.webp"] and back.list_prices == {}

    with pytest.raises(ValueError):
        await undo_batch(str(rec.batch.id))


# ---------------------------------------------------------------------------------- endpoints

@pytest.fixture
def catalog_api(catalog_db, admin_user):
    from fastapi import FastAPI
    from fastapi.testclient import TestClient

    from app.api.v1.endpoints import catalog_admin, market
    from app.core.deps import get_current_admin_user

    application = FastAPI()
    application.include_router(catalog_admin.router, prefix="/catalog-admin")
    application.include_router(market.router, prefix="/market")
    application.dependency_overrides[get_current_admin_user] = lambda: admin_user
    with TestClient(application) as client:
        yield client


def test_endpoints_end_to_end(catalog_api):
    # Bulk import (CSV) creates two editions with the same reference.
    csv_text = "brand,model,reference,ws_code,list_price_HK,status\nRichard Mille ,RM67-02,RM67-02,RM67-02 Italy,100,draft\nRichard Mille,RM67-02,RM67-02,RM67-02 France,,active\n"
    r = catalog_api.post("/market/admin/import", json={"text": csv_text, "dry_run": False})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["created"] == 2 and body["batch_id"]

    listing = catalog_api.get("/market/admin/all", params={"no_list_price": True}).json()
    assert [w["ws_code"] for w in listing] == ["RM67-02 France"]
    assert catalog_api.get("/market/admin/count", params={"status_filter": "draft"}).json()["total"] == 1
    assert catalog_api.get("/catalog-admin/brands").json() == ["Richard Mille"]

    all_watches = catalog_api.get("/market/admin/all").json()
    ids = [w["id"] for w in all_watches]

    # Export → edit → re-import.
    exported = catalog_api.post("/catalog-admin/watches/export", json={"format": "jsonl"}).text
    assert exported.count("\n") == 2 and '"list_prices": {"HK": 100}' in exported
    edit = '{"id": "%s", "ws_code": "RM67-02 France"}\n{"id": "%s", "discontinued": true}\n' % (ids[0], ids[1])
    dry = catalog_api.post("/catalog-admin/watches/edit-import", json={"text": edit, "dry_run": True}).json()
    assert dry["errors"] == 1 and dry["updated"] == 1 and dry["batch_id"] is None

    # Bulk action + undo.
    r = catalog_api.post("/catalog-admin/watches/bulk-action", json={
        "action": "set_status", "value": "active", "selection": {"mode": "all"}})
    assert r.json()["affected"] == 1
    assert catalog_api.get("/market/admin/count", params={"status_filter": "draft"}).json()["total"] == 0
    undo = catalog_api.post(f"/catalog-admin/batches/{r.json()['batch_id']}/undo")
    assert undo.status_code == 200 and undo.json()["restored"] == 1
    assert catalog_api.get("/market/admin/count", params={"status_filter": "draft"}).json()["total"] == 1

    r = catalog_api.post("/catalog-admin/watches/bulk-action", json={
        "action": "delete", "selection": {"mode": "ids", "ids": ids}})
    assert r.json()["affected"] == 2
    assert catalog_api.get("/market/admin/count").json()["total"] == 0
    catalog_api.post(f"/catalog-admin/batches/{r.json()['batch_id']}/undo")
    assert catalog_api.get("/market/admin/count").json()["total"] == 2

    batches = catalog_api.get("/catalog-admin/batches").json()
    assert len(batches) == 3 and batches[0]["undone_at"]

    # Image matching dry run (no storage needed).
    files = [
        ("files", ("rm67-02_france.png", b"x", "image/png")),
        ("files", ("unknown.png", b"x", "image/png")),
        ("files", ("._junk.png", b"x", "image/png")),
    ]
    r = catalog_api.post("/catalog-admin/watches/images", files=files, data={"dry_run": "true"})
    out = r.json()
    assert [m["ws_code"] for m in out["matched"]] == ["RM67-02 France"]
    assert [u["file"] for u in out["unmatched"]] == ["unknown.png"] and len(out["ignored"]) == 1
