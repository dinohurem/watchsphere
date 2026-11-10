"""Search normalisation / alias resolution and the Model-button rule (redesign v3 §0.3, §4)."""

from app.api.v1.endpoints.market_browse import (
    build_search_entry,
    compact,
    model_button_visible,
    normalize_text,
    score_entry,
)
from app.core.deps import is_pending_allowed_path

BRANDS = {"pp": "Patek Philippe", "ap": "Audemars Piguet"}
DESCRIPTORS = {"jub": "Jubilee"}


def entry(**kw):
    base = {"_id": "1", "brand": "Rolex", "model": "GMT-Master II", "collection": "GMT-Master 2",
            "ws_code": "126710BLRO Jub", "reference": "126710BLRO",
            "oem_references": ["126710BLRO-0001"], "aliases": ["Pepsi Jubilee", "Pepsi"],
            "dial": "Black", "bracelet": "Jubilee"}
    base.update(kw)
    return build_search_entry(base)


def test_normalize_text_case_space_accent():
    assert normalize_text("  Pepsi-JUBILÉE ") == "pepsi jubilee"
    assert compact("126518 LN") == "126518ln"
    assert compact("Grün Ombré") == "grunombre"
    assert normalize_text(None) == ""


def test_exact_alias_and_code():
    e = entry()
    assert score_entry("pepsi jubilee", e) == 100
    assert score_entry("PEPSIJUBILEE", e) == 100
    assert score_entry("126710 blro", e) == 100
    assert score_entry("126710blro-0001", e) == 100


def test_code_prefix():
    assert score_entry("12671", entry()) == 80
    assert score_entry("12", entry()) == 50   # too short for a prefix hit; plain token match


def test_alias_phrase_inside_alias():
    pikachu = entry(model="Cosmograph Daytona", collection="Daytona", ws_code="126518LN Pikachu",
                    reference="126518LN", oem_references=[], aliases=["Daytona Pikachu"])
    assert score_entry("pikachu", pikachu) == 70
    assert score_entry("Daytona Pikachu", pikachu) == 100
    assert score_entry("pikachu daytona", pikachu) == 50   # all tokens, any order


def test_all_tokens_with_brand_and_descriptor_aliases():
    naut = entry(brand="Patek Philippe", model="Nautilus", collection="Nautilus",
                 ws_code="5811/1G", reference="5811/1G", oem_references=[], aliases=[],
                 dial="Blue", bracelet="Bracelet")
    assert score_entry("pp nautilus", naut, BRANDS, DESCRIPTORS) == 50
    assert score_entry("ap nautilus", naut, BRANDS, DESCRIPTORS) == 0
    gmt = entry(aliases=[])
    assert score_entry("rolex gmt jub", gmt, BRANDS, DESCRIPTORS) == 50
    assert score_entry("rolex submariner", gmt, BRANDS, DESCRIPTORS) == 0


def test_empty_query():
    assert score_entry("  ", entry()) == 0


def test_model_button_rule():
    assert not model_button_visible(["Cosmograph Daytona", "Cosmograph Daytona"])
    assert not model_button_visible(["Cosmograph Daytona", None, ""])
    assert model_button_visible(["Day-Date 36", "Day-Date 40"])
    assert not model_button_visible(["Day-Date 40", "day-date  40"])   # same model, other spelling
    assert not model_button_visible([])


def test_pending_allowlist():
    assert is_pending_allowed_path("/api/v1/auth/me")
    assert is_pending_allowed_path("/api/v1/profile/me")
    assert is_pending_allowed_path("/api/v1/profile/me/")
    assert is_pending_allowed_path("/api/v1/support/tickets")
    assert is_pending_allowed_path("/api/v1/fx/rates")
    assert not is_pending_allowed_path("/api/v1/profile/watchlist")
    assert not is_pending_allowed_path("/api/v1/market/cards")
    assert not is_pending_allowed_path("/api/v1/authx")
