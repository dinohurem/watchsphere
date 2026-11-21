"""Dev seed for the Checks feature: every state the mobile Checks screens need.

    python scripts/seed_checks.py mongodb://localhost:27033 [--db watchsphere] [--reset]

The URL is required and must point at localhost / 127.0.0.1 / ::1. Anything else is refused
unless ``--force`` is passed. Never point this at production. Re-running is safe: rows are
matched on their natural key and skipped when they already exist (``--reset`` wipes the three
Checks collections first).

Seeds
  Serials     3Y0R9842 stolen (single match) · 605 stolen x2 across two Richard Mille references ·
              CF778123 counterfeit · FK55021 frankenstein · FP90417 fake papers ·
              ZZ99XX1 has no reports (nothing seeded, use it for the "No reports" screen)
  Numbers     +852 6123 4567 scammer · +41 79 123 45 67 verified · +852 5123 4567 no reports
  Bracelets   126334 Oyster + Jubilee (with photos) · 124300 is in the catalogue with no bracelets
  Draft       one user report (stolen, serial DRAFT0001) from the test user, waiting for review
  Users       Checks tester: checks.tester@watchsphere.com / Checks123! (approved collector)
"""
import argparse
import asyncio
import sys
from pathlib import Path
from urllib.parse import urlparse

sys.path.append(str(Path(__file__).parent.parent))

LOCAL_HOSTS = {"localhost", "127.0.0.1", "::1", "[::1]"}

# Real, reachable placeholder photos (picsum serves a stable image per id).
OYSTER_PHOTO = "https://picsum.photos/id/1011/1600/1200"
OYSTER_THUMB = "https://picsum.photos/id/1011/400/300"
JUBILEE_PHOTO = "https://picsum.photos/id/1015/1600/1200"
JUBILEE_THUMB = "https://picsum.photos/id/1015/400/300"
REPORT_PHOTO = "https://picsum.photos/id/1025/1200/900"


def mongo_hosts(url: str) -> list:
    from pymongo.uri_parser import parse_uri

    try:
        return [h for h, _ in parse_uri(url, warn=False)["nodelist"]]
    except Exception:
        return [urlparse(url).hostname or ""]


def refuse_unless_local(url: str, force: bool) -> None:
    hosts = mongo_hosts(url)
    if not force and (not hosts or any(h.lower() not in LOCAL_HOSTS for h in hosts)):
        sys.exit(f"Refusing to seed {hosts}: not localhost. Pass --force if you really mean it.")


async def main(args) -> None:
    refuse_unless_local(args.mongodb_url, args.force)

    from beanie import init_beanie
    from motor.motor_asyncio import AsyncIOMotorClient

    from app.core.security import get_password_hash
    from app.models.checks import Bracelet, CheckImportPreview, DealerNumber, SerialReport
    from app.models.user import User, UserRole
    from app.models.watch import Watch, WatchStatus
    from app.services.checks_normalize import normalize_reference
    from app.services.checks_service import COLLECTIONS, SERIAL_REPORTS, DEALER_NUMBERS, BRACELETS

    client = AsyncIOMotorClient(args.mongodb_url)
    await init_beanie(database=client[args.db], document_models=[
        User, Watch, SerialReport, DealerNumber, Bracelet, CheckImportPreview])

    if args.reset:
        for m in (SerialReport, DealerNumber, Bracelet, CheckImportPreview):
            await m.find({}).delete()

    created = {"serial": 0, "number": 0, "bracelet": 0, "other": 0}

    async def put(coll_key: str, finder: dict, data: dict, kind: str, **extra) -> None:
        coll = COLLECTIONS[coll_key]
        if await coll.model.find_one(finder):
            return
        await coll.model(**coll.clean(data), **extra).insert()
        created[kind] += 1

    # --- Test user -------------------------------------------------------------------------
    user = await User.find_one(User.email == "checks.tester@watchsphere.com")
    if user is None:
        user = User(email="checks.tester@watchsphere.com", name="Checks Tester",
                    hashed_password=get_password_hash("Checks123!"), role=UserRole.COLLECTOR,
                    verified=True, approved=True, is_active=True, username="checks_tester")
        await user.insert()
        created["other"] += 1
    admin = await User.find_one(User.role == UserRole.ADMIN)

    # --- Catalogue references the bracelet check resolves ------------------------------------
    for ref, model, ws, aliases in (
        ("126334", "Datejust 41", "WSCK126334", ["Blue Jubilee 41", "Wimbledon 41"]),
        ("124300", "Oyster Perpetual 41", "WSCK124300", []),
    ):
        if not await Watch.find_one({"reference": ref}):
            await Watch(brand="Rolex", model=model, reference=ref, ws_code=ws, aliases=aliases,
                        status=WatchStatus.ACTIVE, dealer_id=str(admin.id) if admin else "seed",
                        dealer_name="Seed").insert()
            created["other"] += 1

    # --- Serial reports ----------------------------------------------------------------------
    def serial(type_, serial_, brand, model, ref, **kw):
        return {"type": type_, "serial": serial_, "brand": brand, "model": model, "reference": ref,
                "status": "published", **kw}

    rows = [
        serial("stolen", "3Y0R 9842", "Rolex", "Daytona", "116500LN", how_stolen="burglary",
               date_of_incident="2026-02-14", location="Munich, Germany",
               details="Taken from a locked car outside a dealer fair. Police report filed.",
               who_offered="Internal note: seen on a forum", photos=[REPORT_PHOTO]),
        serial("stolen", "605", "Richard Mille", "RM 011", "RM011", how_stolen="armed_robbery",
               date_of_incident="2025-11-03", location="Paris, France",
               details="Armed robbery in front of a boutique."),
        serial("stolen", "No. 605", "Richard Mille", "RM 035", "RM035", how_stolen="scam_paid_never_delivered",
               date_of_incident="2026-01-20", location="Hong Kong",
               details="Buyer paid in full, the watch never arrived."),
        serial("counterfeit", "CF778123", "Rolex", "Submariner", "126610LN",
               who_offered="Internal: Mr X, +44 700 000", details="Movement and dial do not match a genuine piece."),
        serial("frankenstein", "FK55021", "Audemars Piguet", "Royal Oak", "15500ST",
               details="Genuine case with an aftermarket dial and hands."),
        serial("fake_papers", "FP90417", "Patek Philippe", "Nautilus", "5711/1A",
               details="Watch is genuine but the warranty card is forged."),
    ]
    for r in rows:
        await put(SERIAL_REPORTS, {"serial_normalized": COLLECTIONS[SERIAL_REPORTS].clean(r)["serial_normalized"],
                                   "reference_normalized": normalize_reference(r["reference"]),
                                   "type": r["type"]}, r, "serial")

    # --- User report waiting for review ------------------------------------------------------
    draft = {"type": "stolen", "serial": "DRAFT0001", "brand": "Omega", "model": "Speedmaster",
             "reference": "310.30.42.50.01.001", "location": "Zurich", "details": "Reported from the app.",
             "status": "draft"}
    await put(SERIAL_REPORTS, {"serial_normalized": "DRAFT0001"}, draft, "serial", reporter_id=str(user.id))

    # --- Dealer numbers ----------------------------------------------------------------------
    numbers = [
        {"type": "scammer", "country_code": "+852", "phone": "6123 4567", "name": "Internal: Chan Ltd",
         "country": "Hong Kong", "details": "Took deposits for watches and stopped answering.", "status": "published"},
        {"type": "verified", "country_code": "+41", "phone": "79 123 45 67", "name": "Internal: Uhren AG",
         "country": "Switzerland", "status": "published"},
    ]
    for n in numbers:
        cleaned = COLLECTIONS[DEALER_NUMBERS].clean(n)
        await put(DEALER_NUMBERS, {"e164": cleaned["e164"], "type": cleaned["type"]}, n, "number")

    # --- Bracelets ---------------------------------------------------------------------------
    for b in (
        {"brand": "Rolex", "model": "Datejust 41", "reference": "126334", "bracelet": "Oyster", "full_links": 13,
         "notes": "Counts full links only. Easylink not included.", "photo_url": OYSTER_PHOTO,
         "photo_thumb_url": OYSTER_THUMB, "sort_order": 1, "status": "published"},
        {"brand": "Rolex", "model": "Datejust 41", "reference": "126334", "bracelet": "Jubilee", "full_links": 14,
         "notes": "Later production years have one more link.", "photo_url": JUBILEE_PHOTO,
         "photo_thumb_url": JUBILEE_THUMB, "sort_order": 2, "status": "published"},
    ):
        await put(BRACELETS, {"reference_normalized": "126334", "bracelet": b["bracelet"]}, b, "bracelet")

    print(f"Seeded {args.db} on {mongo_hosts(args.mongodb_url)}: {created}")
    print("Test user: checks.tester@watchsphere.com / Checks123!")
    client.close()


if __name__ == "__main__":
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("mongodb_url", help="e.g. mongodb://localhost:27033")
    p.add_argument("--db", default="watchsphere", help="database name (default: watchsphere)")
    p.add_argument("--reset", action="store_true", help="wipe the Checks collections first")
    p.add_argument("--force", action="store_true", help="allow a non-localhost MongoDB (dangerous)")
    asyncio.run(main(p.parse_args()))
