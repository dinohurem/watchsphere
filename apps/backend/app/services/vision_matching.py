"""Image-based variant disambiguation for the WTS/WTB generator.

This is an ADDITIONAL layer on top of the existing text parsing pipeline — it is
deliberately NOT applied to every message. Text parsing always runs first and
keeps full authority:

  * text yields a clear match           -> normal "Matched", no image call
  * text yields nothing                 -> "Not in Database" / "Needs Review"
  * text recognises the reference but
    several catalog variants share it   -> image analysis (this module)
  * text matched but a field is missing
    (e.g. the warranty date)            -> image analysis for that field only

If the image still does not allow a unique assignment the row is NOT promoted to
a match — it stays in "Needs Review". Rows that could only be resolved through
image analysis are reported in their own "Matched via Image" output file.

Only the attachments of the message being analysed are sent to the model; entire
chats are never uploaded.
"""

import asyncio
import base64
import io
import json
import logging
import re
import zipfile
from typing import Any, Optional

from app.core.config import settings

logger = logging.getLogger(__name__)

# --- Tunables -------------------------------------------------------------

MAX_IMAGES_PER_MESSAGE = 3       # dealer posts repeat the same watch; 3 is plenty
MAX_REFERENCE_IMAGES = 4         # one catalog image per candidate variant (step 2 keeps ≤ 4 candidates)
MAX_STEP2_CANDIDATES = 4
# Reasoning models spend completion tokens on thinking; 2,000 left the answer
# empty. Generous budget, the answer itself is a small JSON object.
VISION_MAX_COMPLETION_TOKENS = 8000
MAX_IMAGE_EDGE = 768             # px — downscale before upload to cut tokens
VISION_CONCURRENCY = 4
VISION_TIMEOUT = 90              # seconds per call
# Below this the image did not resolve the ambiguity -> stay in Needs Review.
MIN_VARIANT_CONFIDENCE = 85
MIN_FIELD_CONFIDENCE = 85

IMAGE_EXTENSIONS = (".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif")

# Attachment markers in WhatsApp exports:
#   iOS:     ‎<attached: 00000042-PHOTO-2026-01-01-12-00-00.jpg>
#   Android: IMG-20260101-WA0003.jpg (file attached)
#   German:  IMG-20260101-WA0003.jpg (Datei angehängt)
_ATTACHMENT_RE = re.compile(
    r'([A-Za-z0-9][A-Za-z0-9 _.\-]*\.(?:jpe?g|png|webp|heic|heif))',
    re.IGNORECASE,
)
_ATTACHMENT_LINE_RE = re.compile(
    r'^\s*[‎‏]?<?\s*(?:attached|angeh[äa]ngt)\s*:?\s*'
    r'[A-Za-z0-9][A-Za-z0-9 _.\-]*\.(?:jpe?g|png|webp|heic|heif)\s*>?\s*$'
    r'|^\s*[A-Za-z0-9][A-Za-z0-9 _.\-]*\.(?:jpe?g|png|webp|heic|heif)\s*'
    r'\((?:file attached|Datei angeh[äa]ngt)\)\s*$',
    re.IGNORECASE | re.MULTILINE,
)

# Attributes that can vary inside a single reference. Only these are used for
# disambiguation, and only when the candidates actually disagree on them.
VARIANT_ATTRIBUTES = ("bracelet", "dial", "index")


# --- Media archive --------------------------------------------------------

def load_media_archive(zip_bytes: bytes) -> dict[str, bytes]:
    """Read a WhatsApp 'export with media' .zip into {lowercase filename: bytes}.

    Only image entries are kept; videos/audio/documents are ignored.
    """
    media: dict[str, bytes] = {}
    try:
        with zipfile.ZipFile(io.BytesIO(zip_bytes)) as zf:
            for info in zf.infolist():
                if info.is_dir():
                    continue
                name = info.filename.rsplit("/", 1)[-1]
                if not name.lower().endswith(IMAGE_EXTENSIONS):
                    continue
                try:
                    media[name.lower()] = zf.read(info)
                except Exception:
                    continue
    except zipfile.BadZipFile:
        logger.warning("load_media_archive: uploaded media file is not a valid zip")
        return {}
    logger.info(f"load_media_archive: loaded {len(media)} images from archive")
    return media


def extract_attachment_names(content: str) -> list[str]:
    """Return the attachment filenames referenced by a WhatsApp message."""
    if not content:
        return []
    names: list[str] = []
    for m in _ATTACHMENT_RE.finditer(content):
        name = m.group(1).strip()
        if name.lower() not in [n.lower() for n in names]:
            names.append(name)
    return names


def strip_attachment_markers(content: str) -> str:
    """Remove attachment-only lines so the listing text parses cleanly."""
    if not content:
        return content
    return _ATTACHMENT_LINE_RE.sub('', content)


def _encode_image(raw: bytes) -> Optional[str]:
    """Downscale + JPEG-encode an image and return a data URL, or None."""
    try:
        from PIL import Image
    except Exception:
        # Without Pillow, fall back to shipping the original bytes as-is.
        return "data:image/jpeg;base64," + base64.b64encode(raw).decode("ascii")

    try:
        img = Image.open(io.BytesIO(raw))
        img = img.convert("RGB")
        img.thumbnail((MAX_IMAGE_EDGE, MAX_IMAGE_EDGE))
        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=80)
        return "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode("ascii")
    except Exception as e:
        logger.debug(f"_encode_image: skipping unreadable image ({e})")
        return None


def message_images(attachments: list[str], media: dict[str, bytes]) -> list[str]:
    """Resolve a message's attachment names to data URLs from the media archive."""
    urls: list[str] = []
    for name in attachments[:MAX_IMAGES_PER_MESSAGE]:
        raw = media.get(name.lower())
        if raw is None:
            continue
        url = _encode_image(raw)
        if url:
            urls.append(url)
    return urls


# --- Variant metadata -----------------------------------------------------

def _attr(watch: dict, key: str) -> str:
    return (watch.get(key) or "").strip()


def variable_attributes(candidates: list[dict]) -> list[str]:
    """Which attributes actually vary across these same-reference candidates.

    A missing value does NOT mean incomplete data — for a Day-Date the bracelet
    is always President, so no bracelet is stored at all. Such an attribute is
    fixed and must not be used for disambiguation.
    """
    variable: list[str] = []
    for attr in VARIANT_ATTRIBUTES:
        values = {_attr(c, attr).lower() for c in candidates}
        values.discard("")
        if len(values) > 1:
            variable.append(attr)
    return variable


def candidate_payload(candidates: list[dict], variable: list[str]) -> list[dict]:
    """Compact, model-friendly description of each candidate variant."""
    payload = []
    for c in candidates:
        entry: dict[str, Any] = {
            "ws_code": c.get("ws_code") or "",
            "brand": c.get("brand") or "",
            "model": c.get("model") or "",
            "reference": c.get("reference") or "",
        }
        for attr in VARIANT_ATTRIBUTES:
            value = _attr(c, attr)
            if value:
                entry[attr] = value
            elif attr in variable:
                entry[attr] = "(not specified)"
            # attribute fixed for this reference -> omitted on purpose
        payload.append(entry)
    return payload


def reference_images(candidates: list[dict]) -> list[tuple[str, str]]:
    """(ws_code, image_url) pairs of catalog reference photos for comparison."""
    pairs: list[tuple[str, str]] = []
    for c in candidates:
        url = (c.get("cover_image") or "").strip()
        if not url:
            images = c.get("images") or []
            url = (images[0] if images else "").strip()
        if url.startswith("http") and c.get("ws_code"):
            pairs.append((c["ws_code"], url))
        if len(pairs) >= MAX_REFERENCE_IMAGES:
            break
    return pairs


# --- OpenAI calls ---------------------------------------------------------

def create_client():
    """AsyncOpenAI client for the vision layer, or None when AI is disabled."""
    if not settings.OPENAI_API_KEY:
        return None
    from openai import AsyncOpenAI
    return AsyncOpenAI(api_key=settings.OPENAI_API_KEY, timeout=float(VISION_TIMEOUT))


def _parse_json_response(content: str) -> Optional[dict]:
    content = (content or "").strip()
    if content.startswith("```"):
        content = content.split("\n", 1)[1] if "\n" in content else content[3:]
        if content.endswith("```"):
            content = content[:-3]
        content = content.strip()
    try:
        parsed = json.loads(content)
        return parsed if isinstance(parsed, dict) else None
    except json.JSONDecodeError:
        logger.debug(f"vision: unparsable response: {content[:200]}")
        return None


_VARIANT_PROMPT = """You are a luxury-watch variant identifier working ONLY with the WatchSphere catalog.

The dealer message below names a reference that exists in the catalog as SEVERAL
variants. The text alone cannot decide which one it is. Use the attached photo(s)
of THIS listing to pick the right variant.

Rules:
- Only these attributes vary within this reference: {variable}. Judge on those alone.
- An attribute that is absent from a candidate is FIXED for this reference (e.g. a
  Day-Date bracelet is always President). Never treat it as missing data and never
  use it to choose.
- Compare the listing photo(s) against the catalog reference photo(s) when provided.
- If the photo does not settle it beyond doubt, return ws_code null. A wrong match
  is far worse than no match.

Listing text:
{text}

Candidate variants (JSON):
{candidates}

Answer with JSON only:
{{"ws_code": "<exact ws_code of one candidate, or null>", "confidence": <0-100>,
  "observed": {{"bracelet": "<or null>", "dial": "<or null>", "index": "<or null>"}},
  "reason": "<one short sentence>"}}"""


_FIELD_PROMPT = """You are reading dealer photos for a luxury-watch listing that is already matched
to the WatchSphere catalog as {ws_code}. The text is missing information that may be
visible in the photo(s) — typically the warranty card / certificate date.

Extract ONLY what is clearly legible. Guessing is not acceptable — return null instead.

Listing text:
{text}

Answer with JSON only:
{{"month_year": "<MM/YY as printed on the warranty card, or null>",
  "confidence": <0-100>, "source": "<where you read it>"}}"""


def _is_reasoning_model(name: str) -> bool:
    n = (name or "").lower()
    return n.startswith(("gpt-5", "gpt-6", "o1", "o3", "o4"))


async def _vision_call(client, prompt: str, images: list[str],
                       reference_pairs: list[tuple[str, str]]) -> Optional[dict]:
    parts: list[dict] = [{"type": "text", "text": prompt}]
    parts.append({"type": "text", "text": "Photos of the listing being analysed:"})
    for url in images:
        parts.append({"type": "image_url", "image_url": {"url": url}})
    for ws_code, url in reference_pairs:
        parts.append({"type": "text", "text": f"Catalog reference photo for {ws_code}:"})
        parts.append({"type": "image_url", "image_url": {"url": url}})

    kwargs: dict[str, Any] = {
        "model": settings.OPENAI_VISION_MODEL,
        "messages": [{"role": "user", "content": parts}],
        "max_completion_tokens": VISION_MAX_COMPLETION_TOKENS,
    }
    if not _is_reasoning_model(settings.OPENAI_VISION_MODEL):
        kwargs["temperature"] = 0.1
    try:
        response = await client.chat.completions.create(**kwargs)
    except Exception as e:
        logger.warning(f"vision: OpenAI call failed: {type(e).__name__}: {e}")
        return None

    choice = response.choices[0]
    content = choice.message.content or ""
    if not content.strip():
        logger.warning(f"vision: empty answer (finish_reason={getattr(choice, 'finish_reason', None)})")
        return None
    return _parse_json_response(content)


_DESCRIBE_PROMPT = """You are looking at dealer photo(s) of ONE luxury watch listing.
Describe only what is clearly visible. Use null for anything you cannot see.

Listing text:
{text}

Answer with JSON only:
{{"dial_colour": "<e.g. blue, black, green, white, silver, champagne, or null>",
  "dial_details": ["<any of: diamonds, baguette, roman, arabic, index, motif/fluted, ombre, meteorite, mother of pearl>"],
  "bracelet": "<jubilee | oyster | president | leather | rubber | other | null>",
  "bezel": "<fluted | smooth | diamond | ceramic colour(s) | null>",
  "card_reference": "<reference printed on a warranty card, or null>",
  "card_date": "<MM/YY printed on a warranty card, or null>",
  "is_watch_photo": <true|false>}}"""

_COLOUR_WORDS = ("black", "blue", "green", "white", "silver", "grey", "gray", "champagne", "gold",
                 "brown", "chocolate", "pink", "red", "purple", "yellow", "turquoise", "slate",
                 "rhodium", "mother of pearl", "meteorite", "olive", "ice blue")


def _fold(s: Any) -> str:
    import unicodedata
    t = unicodedata.normalize("NFKD", str(s or ""))
    return "".join(c for c in t if not unicodedata.combining(c)).lower()


def _digits(ref: str) -> str:
    s = re.sub(r"\s+", "", (ref or "").lower())
    s = re.split(r"[.\-]", s, maxsplit=1)[0]
    return re.sub(r"\D", "", s)


def filter_candidates_by_description(description: dict, candidates: list[dict]) -> list[dict]:
    """Step 1 of §5: keep the candidates whose catalog dial / bracelet fields fit
    what the photo shows. Best first, at most MAX_STEP2_CANDIDATES. Candidates
    without data for an attribute are not penalised for it."""
    if not description:
        return candidates[:MAX_STEP2_CANDIDATES]
    seen_colour = _fold(description.get("dial_colour"))
    seen_colour_words = [c for c in _COLOUR_WORDS if c in seen_colour]
    seen_bracelet = _fold(description.get("bracelet"))
    seen_details = " ".join(_fold(d) for d in (description.get("dial_details") or []))

    scored: list[tuple[int, int, dict]] = []
    for i, c in enumerate(candidates):
        hay = " ".join(_fold(c.get(k)) for k in ("ws_code", "dial", "bracelet", "index", "model"))
        hay += " " + " ".join(_fold(a) for a in c.get("aliases") or [])
        hay = hay.replace(" jub", " jubilee").replace(" oys", " oyster")
        score = 0
        dial = _fold(c.get("dial")) + " " + _fold(c.get("ws_code"))
        if seen_colour_words:
            cand_colours = [w for w in _COLOUR_WORDS if w in dial]
            if cand_colours:
                if any(w in dial for w in seen_colour_words):
                    score += 10
                else:
                    continue  # the photo shows another dial colour
        if seen_bracelet and seen_bracelet not in ("other", "null"):
            cand_br = _fold(c.get("bracelet")) + " " + hay
            if any(b in cand_br for b in ("jubilee", "oyster", "president", "leather", "rubber")):
                if seen_bracelet in cand_br:
                    score += 6
                else:
                    continue  # the photo shows another bracelet
        for detail in ("diamond", "baguette", "roman", "motif", "fluted", "ombre", "meteorite", "mother of pearl"):
            if detail in seen_details and detail in hay:
                score += 4
        scored.append((score, -i, c))
    scored.sort(key=lambda x: (x[0], x[1]), reverse=True)
    return [c for _s, _i, c in scored][:MAX_STEP2_CANDIDATES]


async def describe_listing_photo(client, text: str, images: list[str]) -> Optional[dict]:
    """Step 1 of §5: what the photo shows (dial, bracelet, bezel, warranty card)."""
    result = await _vision_call(client, _DESCRIBE_PROMPT.format(text=(text or "")[:400]), images, [])
    return result if isinstance(result, dict) else None


async def disambiguate_variant(
    client,
    text: str,
    images: list[str],
    candidates: list[dict],
) -> Optional[dict]:
    """Pick the right same-reference variant from the listing photo(s).

    Two steps (§5): the photo is described first and the description filters the
    candidates on their catalog dial / bracelet fields (2–4 left); then the photo
    is compared with the catalog images of only those candidates. A photo that
    shows another watch (other reference on the warranty card, a dial no candidate
    has) never produces a match.

    Returns {"ws_code", "confidence", "observed", "reason", "card_month_year"} or
    None when the image analysis could not decide — the caller keeps the row in
    Needs Review.
    """
    variable = variable_attributes(candidates)
    if not variable:
        return None

    description = await describe_listing_photo(client, text, images)
    if description is not None and description.get("is_watch_photo") is False:
        return None
    card_ref = (description or {}).get("card_reference")
    if card_ref:
        card_digits = _digits(str(card_ref))
        cand_digits = {_digits(c.get("reference") or c.get("ws_code") or "") for c in candidates}
        if card_digits and cand_digits and card_digits not in cand_digits:
            logger.info(f"vision: warranty card shows {card_ref}, not one of the candidates — wrong photo")
            return None

    shortlist = filter_candidates_by_description(description or {}, candidates)
    if not shortlist:
        return None
    if len(shortlist) == 1 and description:
        # The description alone settled it; confirm against the catalog photo.
        pass
    variable = variable_attributes(shortlist) or variable

    prompt = _VARIANT_PROMPT.format(
        variable=", ".join(variable),
        text=(text or "")[:400],
        candidates=json.dumps(candidate_payload(shortlist, variable), indent=1),
    )
    result = await _vision_call(client, prompt, images, reference_images(shortlist))
    if not result:
        return None

    ws_code = (result.get("ws_code") or "").strip()
    confidence = result.get("confidence") or 0
    valid = {(c.get("ws_code") or "").lower() for c in shortlist}
    if not ws_code or ws_code.lower() not in valid:
        return None
    if not isinstance(confidence, (int, float)) or confidence < MIN_VARIANT_CONFIDENCE:
        return None
    # The pick must agree with the step-1 description.
    picked = next(c for c in shortlist if (c.get("ws_code") or "").lower() == ws_code.lower())
    if description and not filter_candidates_by_description(description, [picked]):
        return None

    card_date = (description or {}).get("card_date") or ""
    card_my = None
    m = re.fullmatch(r"\s*(\d{1,2})\s*/\s*(\d{2,4})\s*", str(card_date))
    if m and 1 <= int(m.group(1)) <= 12:
        card_my = f"{int(m.group(1)):02d}/{m.group(2)[-2:]}"

    observed = result.get("observed") or {}
    if description:
        observed = {**{k: description.get(k) for k in ("dial_colour", "bracelet", "bezel") if description.get(k)},
                    **{k: v for k, v in observed.items() if v}}
    return {
        "ws_code": picked.get("ws_code") or ws_code,
        "confidence": int(confidence),
        "observed": observed,
        "reason": result.get("reason") or "",
        "card_month_year": card_my,
    }


async def extract_missing_month_year(
    client,
    text: str,
    images: list[str],
    ws_code: str,
) -> Optional[dict]:
    """Read the warranty-card date off the photo(s) for an already-matched row."""
    prompt = _FIELD_PROMPT.format(ws_code=ws_code or "?", text=(text or "")[:400])
    result = await _vision_call(client, prompt, images, [])
    if not result:
        return None

    month_year = (result.get("month_year") or "").strip()
    confidence = result.get("confidence") or 0
    if not re.fullmatch(r'\d{1,2}/\d{2,4}', month_year):
        return None
    if not isinstance(confidence, (int, float)) or confidence < MIN_FIELD_CONFIDENCE:
        return None

    month, _, year = month_year.partition("/")
    if not (1 <= int(month) <= 12):
        return None
    year = year[-2:]
    return {
        "month_year": f"{int(month):02d}/{year}",
        "confidence": int(confidence),
        "source": result.get("source") or "image",
    }


async def gather_limited(tasks: list) -> list:
    """Run coroutine factories with a bounded concurrency."""
    semaphore = asyncio.Semaphore(VISION_CONCURRENCY)

    async def _run(factory):
        async with semaphore:
            try:
                return await factory()
            except Exception as e:
                logger.warning(f"vision: task failed: {type(e).__name__}: {e}")
                return None

    return await asyncio.gather(*[_run(t) for t in tasks])
