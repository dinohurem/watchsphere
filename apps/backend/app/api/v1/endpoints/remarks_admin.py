"""Admin CRUD for the generator's remark rules and places (generator spec §6).

Mounted at /api/v1/admin/remarks. The generator reloads these at every run.
"""
from datetime import datetime
from typing import Any, List, Optional

from beanie import PydanticObjectId
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app.core.deps import get_current_admin_user
from app.models.remark_rule import PLACE_KINDS, REMARK_KINDS, REMARK_MODES, RemarkPlace, RemarkRule
from app.models.user import User
from app.services.remark_rules import DEFAULT_CATEGORIES, seed_defaults

router = APIRouter()


class RuleIn(BaseModel):
    remark: Optional[str] = None
    triggers: Optional[List[str]] = None
    category: Optional[str] = None
    kind: Optional[str] = None
    mode: Optional[str] = None
    enabled: Optional[bool] = None
    order: Optional[int] = None


class PlaceIn(BaseModel):
    name: Optional[str] = None
    aliases: Optional[List[str]] = None
    kind: Optional[str] = None
    enabled: Optional[bool] = None
    order: Optional[int] = None


def _clean_list(values: Optional[List[str]]) -> List[str]:
    out: List[str] = []
    for v in values or []:
        v = (v or "").strip()
        if v and v.lower() not in [o.lower() for o in out]:
            out.append(v)
    return out


def _rule_out(r: RemarkRule) -> dict:
    return {"id": str(r.id), "remark": r.remark, "triggers": r.triggers, "category": r.category,
            "kind": r.kind, "mode": r.mode, "enabled": r.enabled, "order": r.order}


def _place_out(p: RemarkPlace) -> dict:
    return {"id": str(p.id), "name": p.name, "aliases": p.aliases, "kind": p.kind,
            "enabled": p.enabled, "order": p.order}


def _validate_rule(data: dict) -> None:
    if "kind" in data and data["kind"] not in REMARK_KINDS:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"kind must be one of {', '.join(REMARK_KINDS)}")
    if "mode" in data:
        data["mode"] = (data["mode"] or "BOTH").upper()
        if data["mode"] not in REMARK_MODES:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, f"mode must be one of {', '.join(REMARK_MODES)}")
    if "remark" in data:
        data["remark"] = (data["remark"] or "").strip()
        if not data["remark"]:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "remark is required")
    if "triggers" in data:
        data["triggers"] = _clean_list(data["triggers"])
    if "category" in data:
        data["category"] = (data["category"] or "").strip()


def _validate_place(data: dict) -> None:
    if "kind" in data and data["kind"] not in PLACE_KINDS:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"kind must be one of {', '.join(PLACE_KINDS)}")
    if "name" in data:
        data["name"] = (data["name"] or "").strip()
        if not data["name"]:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "name is required")
    if "aliases" in data:
        data["aliases"] = _clean_list(data["aliases"])


async def _listing() -> dict:
    await seed_defaults()
    rules = sorted(await RemarkRule.find_all().to_list(), key=lambda r: r.order)
    places = sorted(await RemarkPlace.find_all().to_list(), key=lambda p: p.order)
    categories = list(DEFAULT_CATEGORIES)
    for r in rules:
        if r.kind == "remark" and r.category and r.category not in categories:
            categories.append(r.category)
    return {
        "rules": [_rule_out(r) for r in rules],
        "places": [_place_out(p) for p in places],
        "categories": categories,
        "kinds": list(REMARK_KINDS),
        "modes": list(REMARK_MODES),
    }


@router.get("")
async def list_remarks(_: User = Depends(get_current_admin_user)) -> Any:
    return await _listing()


@router.post("/reset")
async def reset_remarks(_: User = Depends(get_current_admin_user)) -> Any:
    await seed_defaults(replace=True)
    return await _listing()


@router.post("/rules")
async def create_rule(body: RuleIn, admin: User = Depends(get_current_admin_user)) -> Any:
    data = body.model_dump(exclude_none=True)
    data.setdefault("kind", "remark")
    data.setdefault("mode", "BOTH")
    if "remark" not in data:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "remark is required")
    _validate_rule(data)
    if "order" not in data:
        last = await RemarkRule.find_all().sort(-RemarkRule.order).limit(1).to_list()
        data["order"] = (last[0].order + 10) if last else 0
    rule = RemarkRule(**data, updated_by=str(admin.id) if admin.id else None)
    await rule.insert()
    return _rule_out(rule)


@router.put("/rules/{rule_id}")
async def update_rule(rule_id: PydanticObjectId, body: RuleIn, admin: User = Depends(get_current_admin_user)) -> Any:
    rule = await RemarkRule.get(rule_id)
    if not rule:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Remark rule not found")
    data = body.model_dump(exclude_none=True)
    _validate_rule(data)
    for k, v in data.items():
        setattr(rule, k, v)
    rule.updated_at = datetime.utcnow()
    rule.updated_by = str(admin.id) if admin.id else None
    await rule.save()
    return _rule_out(rule)


@router.delete("/rules/{rule_id}")
async def delete_rule(rule_id: PydanticObjectId, _: User = Depends(get_current_admin_user)) -> Any:
    rule = await RemarkRule.get(rule_id)
    if not rule:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Remark rule not found")
    await rule.delete()
    return {"deleted": True}


@router.post("/places")
async def create_place(body: PlaceIn, admin: User = Depends(get_current_admin_user)) -> Any:
    data = body.model_dump(exclude_none=True)
    data.setdefault("kind", "country")
    if "name" not in data:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "name is required")
    _validate_place(data)
    if "order" not in data:
        last = await RemarkPlace.find_all().sort(-RemarkPlace.order).limit(1).to_list()
        data["order"] = (last[0].order + 10) if last else 0
    place = RemarkPlace(**data, updated_by=str(admin.id) if admin.id else None)
    await place.insert()
    return _place_out(place)


@router.put("/places/{place_id}")
async def update_place(place_id: PydanticObjectId, body: PlaceIn, admin: User = Depends(get_current_admin_user)) -> Any:
    place = await RemarkPlace.get(place_id)
    if not place:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Place not found")
    data = body.model_dump(exclude_none=True)
    _validate_place(data)
    for k, v in data.items():
        setattr(place, k, v)
    place.updated_at = datetime.utcnow()
    place.updated_by = str(admin.id) if admin.id else None
    await place.save()
    return _place_out(place)


@router.delete("/places/{place_id}")
async def delete_place(place_id: PydanticObjectId, _: User = Depends(get_current_admin_user)) -> Any:
    place = await RemarkPlace.get(place_id)
    if not place:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Place not found")
    await place.delete()
    return {"deleted": True}
