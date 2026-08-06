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
MAX_REFERENCE_IMAGES = 4         # one catalog image per candidate variant
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


async def _vision_call(client, prompt: str, images: list[str],
                       reference_pairs: list[tuple[str, str]]) -> Optional[dict]:
    parts: list[dict] = [{"type": "text", "text": prompt}]
    parts.append({"type": "text", "text": "Photos of the listing being analysed:"})
    for url in images:
        parts.append({"type": "image_url", "image_url": {"url": url}})
    for ws_code, url in reference_pairs:
        parts.append({"type": "text", "text": f"Catalog reference photo for {ws_code}:"})
        parts.append({"type": "image_url", "image_url": {"url": url}})

    try:
        response = await client.chat.completions.create(
            model=settings.OPENAI_VISION_MODEL,
            messages=[{"role": "user", "content": parts}],
            temperature=0.1,
            max_tokens=600,
        )
    except Exception as e:
        logger.warning(f"vision: OpenAI call failed: {type(e).__name__}: {e}")
        return None

    return _parse_json_response(response.choices[0].message.content)


async def disambiguate_variant(
    client,
    text: str,
    images: list[str],
    candidates: list[dict],
) -> Optional[dict]:
    """Pick the right same-reference variant from the listing photo(s).

    Returns {"ws_code", "confidence", "observed", "reason"} or None when the
    image analysis could not decide — in which case the caller must keep the row
    in Needs Review.
    """
    variable = variable_attributes(candidates)
    if not variable:
        # Nothing actually varies between the candidates in the data we hold —
        # an image cannot resolve it either.
        return None

    prompt = _VARIANT_PROMPT.format(
        variable=", ".join(variable),
        text=(text or "")[:400],
        candidates=json.dumps(candidate_payload(candidates, variable), indent=1),
    )
    result = await _vision_call(client, prompt, images, reference_images(candidates))
    if not result:
        return None

    ws_code = (result.get("ws_code") or "").strip()
    confidence = result.get("confidence") or 0
    valid = {(c.get("ws_code") or "").lower() for c in candidates}
    if not ws_code or ws_code.lower() not in valid:
        return None
    if not isinstance(confidence, (int, float)) or confidence < MIN_VARIANT_CONFIDENCE:
        return None

    return {
        "ws_code": ws_code,
        "confidence": int(confidence),
        "observed": result.get("observed") or {},
        "reason": result.get("reason") or "",
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
