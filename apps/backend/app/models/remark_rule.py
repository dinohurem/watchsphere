"""Remark rules for the WTS/WTB generator (generator spec §6, appendix A).

Remarks and their triggers live in the database so an admin can edit them; the
generator loads them at the start of every run. Remarks that carry a number
(links, Serviced + year, LC number, discount %, Wood Card with W + month) are
built into the generator code and are not stored here.
"""
from datetime import datetime
from typing import List, Optional

from beanie import Document
from pydantic import Field

REMARK_KINDS = ("remark", "aftermarket", "aftermarket_exception")
REMARK_MODES = ("BOTH", "WTS", "WTB")
PLACE_KINDS = ("country", "city")


class RemarkRule(Document):
    """One remark as shown in the app plus the dealer phrases that trigger it.

    kind:
      remark                — normal remark written to the Bemerkungen column
      aftermarket           — trigger means the listing is never imported
      aftermarket_exception — phrase that looks aftermarket but is not
                              ("original diamond", "aftermarket stickers")
    mode: BOTH, WTS or WTB — which listings the remark applies to.
    """

    remark: str
    triggers: List[str] = Field(default_factory=list)
    category: str = ""
    kind: str = "remark"
    mode: str = "BOTH"
    enabled: bool = True
    order: int = 0
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    updated_by: Optional[str] = None

    class Settings:
        name = "remark_rules"
        indexes = ["kind", "order"]


class RemarkPlace(Document):
    """A country or city that may follow "Watch in" / "Need in" / "ready in".

    name is written out in the remark ("Watch in Dubai"); aliases are the
    spellings dealers use ("dxb", "uae").
    """

    name: str
    aliases: List[str] = Field(default_factory=list)
    kind: str = "country"
    enabled: bool = True
    order: int = 0
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    updated_by: Optional[str] = None

    class Settings:
        name = "remark_places"
        indexes = ["order"]
