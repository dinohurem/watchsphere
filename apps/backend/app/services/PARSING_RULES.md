# WatchSphere WhatsApp Chat Parsing Rules

**Source of truth**: `apps/backend/app/services/wtb_wts_service.py`
**Purpose**: AI prompt context for GPT-5.2 matching, specification for the parsing codebase, and reference for developers.
**Last updated**: 2026-04-13

---

## Table of Contents

1. [WhatsApp Export Format](#1-whatsapp-export-format)
2. [Post Type Detection (WTS vs WTB)](#2-post-type-detection-wts-vs-wtb)
3. [Brand Detection](#3-brand-detection)
4. [Reference Extraction](#4-reference-extraction)
5. [Reference Matching Pipeline](#5-reference-matching-pipeline)
6. [Descriptor Aliases](#6-descriptor-aliases)
7. [Year/Date Parsing](#7-yeardate-parsing)
8. [Price Parsing](#8-price-parsing)
9. [Condition Detection](#9-condition-detection)
10. [Stock List Processing](#10-stock-list-processing)
11. [Phone Number Extraction & Country Detection](#11-phone-number-extraction--country-detection)
12. [Known Edge Cases & Gotchas](#12-known-edge-cases--gotchas)
13. [AI Matching Pass](#13-ai-matching-pass)
14. [Deduplication](#14-deduplication)

---

## 1. WhatsApp Export Format

### 1.1 Message Header Patterns

Three regex variants handle German (iOS), international (Android), and German (Android) exports:

| # | Pattern | Example |
|---|---------|---------|
| 1 | `\[DD.MM.YY, HH:MM:SS\] sender: content` | `[05.03.26, 16:38:28] +852 6547 2648 WS: *5/3/2026 Stock List*` |
| 2 | `DD/MM/YY, HH:MM - sender: content` | `3/15/26, 14:07:34 - +852 6547 2648 WS: hello` |
| 3 | `DD.MM.YY, HH:MM - sender: content` | `05.03.26, 16:38:28 - +852 6547 2648 WS: hello` |

Exact regex patterns:

```
Pattern 1: \[(\d{1,2}\.\d{1,2}\.\d{2,4}),\s*(\d{1,2}:\d{2}(?::\d{2})?)\]\s*([^:]+):\s*(.*)
Pattern 2: (\d{1,2}/\d{1,2}/\d{2,4}),\s*(\d{1,2}:\d{2}(?::\d{2})?)\s*-\s*([^:]+):\s*(.*)
Pattern 3: (\d{1,2}\.\d{1,2}\.\d{2,4}),\s*(\d{1,2}:\d{2}(?::\d{2})?)\s*-\s*([^:]+):\s*(.*)
```

Timestamp parsing supports both 2-digit and 4-digit years, and both `HH:MM` and `HH:MM:SS` time formats. The date separator `/` is normalized to `.` internally. Fallback: `datetime.utcnow()` if no format matches.

### 1.2 Invisible Unicode Characters

WhatsApp iOS exports prepend invisible characters to message lines. These **must** be stripped before regex matching or lines get misclassified as continuation lines and merged into the previous message.

Stripped characters:

| Character | Unicode | Name |
|-----------|---------|------|
| `\u200b` | U+200B | Zero-Width Space |
| `\u200c` | U+200C | Zero-Width Non-Joiner |
| `\u200d` | U+200D | Zero-Width Joiner |
| `\u200e` | U+200E | Left-to-Right Mark (LRM) |
| `\u200f` | U+200F | Right-to-Left Mark (RLM) |
| `\u202a`-`\u202e` | U+202A-202E | LTR/RTL Embedding, Override, Pop |
| `\u2060`-`\u2064` | U+2060-2064 | Word Joiner, Invisible Times, etc. |
| `\ufeff` | U+FEFF | BOM / Zero-Width No-Break Space |
| `\xa0` | U+00A0 | Non-Breaking Space (replaced with regular space) |

The stripping function `_strip_invisible()` replaces `\xa0` with a regular space, then removes all other listed characters entirely.

### 1.3 Multi-Line Message Handling

Lines that do NOT match any header pattern are appended to the current message's content with a `\n` separator. This is critical for stock lists, which span many lines under a single message header.

### 1.4 System Messages to Skip

Messages are skipped entirely if they match these patterns (case-insensitive):

**Structural skip patterns** (always skip):
- `diese nachricht wurde gel[oo]scht` (German: "this message was deleted")
- `this message was deleted`
- `you deleted this message`

**System message patterns** (always skip):
- `end-to-end.*encrypted`
- `ende-zu-ende.*verschl[uu]sselt` (German encryption notice)
- `nachrichtendauer wurde` (disappearing messages setting)
- `messages? and calls? are`
- `die sicherheitsnummer` (security number changed)
- `hat die gruppe` (group changes)
- `wurde hinzugef[uu]gt` (user was added)

**Pure emoji/decorative lines**: Messages with no alphanumeric content after emoji stripping are skipped.

### 1.5 Media Markers: Strip vs Skip

Media markers are strings WhatsApp inserts when media is not exported. The behavior depends on whether the message contains OTHER content:

**If the message is ONLY a media marker** (no watch data alongside): **skip the entire message**.
**If the message has watch data AND a media marker**: **strip the marker, keep the watch data**.

Real-world example of strip (not skip):
```
RM07-01 Starry night 2/26
HKD3.37m USDT 448k Bild weggelassen
```
The "Bild weggelassen" is stripped, and the watch listing is parsed.

Full list of media markers (case-insensitive):
- `bild weggelassen` (German: image omitted)
- `video weggelassen`
- `<media omitted>`
- `media omitted`
- `image omitted`
- `sticker weggelassen`
- `audio weggelassen`
- `dokument weggelassen`
- `gif weggelassen`
- `kontaktkarte weggelassen` (contact card omitted)
- `standort weggelassen` (location omitted)

### 1.6 SOLD Messages

A single-line message that is purely a SOLD notification is skipped:

```regex
^\s*[\w/\-\s\u0080-\uffff\*\U0001F3F7\uFE0F]*\s*-?\s*sold\s*$
```

Examples that are skipped: `126610LN - SOLD`, `5711/1A SOLD`

**Important**: `SOLD` appearing on ONE line inside a multi-line stock list does NOT skip the entire message. That single line is skipped within `parse_stock_list`, but all other lines are still parsed.

---

## 2. Post Type Detection (WTS vs WTB)

### 2.1 WTS Keywords

```python
["wts", "want to sell", "for sale", "selling", "fs", "stock list", "stocklist", "price list", "pricelist"]
```

### 2.2 WTB Keywords

```python
["wtb", "want to buy", "looking for", "lf"]
```

### 2.3 Word-Boundary Matching

All keyword matching uses word boundaries to prevent false positives:

```python
pattern = r'(?<![a-zA-Z])' + re.escape(kw) + r'(?![a-zA-Z])'
```

This means:
- `"looking for"` does NOT match inside `"looking forward to..."` (the `ward` after `for` would violate the right boundary)
- `"fs"` does NOT match inside `"ofs"` or `"offset"`
- `"lf"` does NOT match inside `"self"` or `"shelf"`

### 2.4 Priority: First Keyword Position Wins

When BOTH WTS and WTB keywords appear in the same message, the one that appears **earliest by character position** wins:

```python
if wts_pos is not None and wtb_pos is not None:
    return "WTS" if wts_pos <= wtb_pos else "WTB"
```

This handles cases like a dealer posting a WTS stock list with a small WTB section at the bottom, or vice versa.

### 2.5 Fallback: Currency-Tagged Price = WTS

If no WTS/WTB keyword is found, but the message contains a price with a currency tag, it is classified as WTS:

```python
r'(?:\$|EUR|\EUR|GBP|HKD|USD|CHF|AED|USDT)\s*[\d,.]+|[\d,.]+\s*(?:HKD|USD|EUR|GBP|CHF|AED|USDT|k\b)'
```

Real-world example:
```
5968A N2 1.17m hkd
```
No "WTS" keyword, but the HKD currency tag makes this WTS.

### 2.6 Fallback: Reference-Like + Big Number = WTS

If no keyword and no currency tag, but the message has:
1. A reference-like token: `\b[A-Za-z]{0,4}\d{4,6}[A-Za-z]{0,6}(?:[/\-][A-Za-z0-9]+)?\b`
2. AND a large number: `\d{3}[,.]\d{3}` or `\b\d{1,3}[kK]\b` or `\b\d\.\d+[mM]\b`

Then it is classified as WTS.

Example: `5167R N2 790,000` (no currency, no keyword, but clearly a WTS listing).

---

## 3. Brand Detection

### 3.1 Full BRAND_ALIASES Mapping

Every alias is matched case-insensitively with word boundaries.

| Alias(es) | Canonical Brand |
|-----------|----------------|
| `pp`, `patek`, `patek philippe` | Patek Philippe |
| `ap`, `audemars piguet`, `audemars` | Audemars Piguet |
| `rm`, `richard mille`, `richard miller` | Richard Mille |
| `fpj`, `f.p. journe`, `fp journe` | F.P. Journe |
| `rolex` | Rolex |
| `omega` | Omega |
| `cartier` | Cartier |
| `hublot` | Hublot |
| `jlc`, `jaeger-lecoultre`, `jaeger lecoultre` | Jaeger-LeCoultre |
| `vc`, `vacheron`, `vacheron constantin` | Vacheron Constantin |
| `iwc` | IWC |
| `breitling` | Breitling |
| `tudor` | Tudor |
| `panerai` | Panerai |
| `tag heuer`, `tag` | Tag Heuer |
| `lange`, `a. lange`, `a. lange & sohne` | A. Lange & Sohne |
| `chopard` | Chopard |
| `gp`, `girard-perregaux` | Girard-Perregaux |
| `zenith` | Zenith |
| `blancpain`, `bp` | Blancpain |
| `mb&f`, `mbf` | MB&F |
| `moser`, `h. moser` | H. Moser & Cie |
| `breguet` | Breguet |
| `piaget` | Piaget |
| `franck muller`, `fm` | Franck Muller |

Aliases are sorted by length (longest first) before matching so `"patek philippe"` is matched before `"patek"`.

### 3.2 Brand Header Detection (`detect_brand_header`)

Identifies lines that are brand section headers in stock lists. These lines mark the beginning of a brand section and are NOT parsed as watch entries.

Processing steps:
1. Strip emoji (`_clean_text`)
2. Strip asterisks (WhatsApp bold `*markers*`)
3. Strip trailing condition/status words: `used`, `new`, `unworn`, `fullset`, `full set`, `nos`, `stock`, `list`, `update`, `price`
4. Strip leading `all brand new`, `all new`, `brand new` prefixes
5. Strip decorative characters: dashes, underscores, equals, asterisks
6. Match against `BRAND_ALIASES`

Real-world header examples:

| Raw Line | After Cleanup | Matched Brand |
|----------|---------------|---------------|
| `🇭🇰🇭🇰Richard miller🇭🇰🇭🇰` | `richard miller` | Richard Mille |
| `🇭🇰🇭🇰Patek Philippe🇭🇰🇭🇰` | `patek philippe` | Patek Philippe |
| `Ap Used ✨✨` | `ap` | Audemars Piguet |
| `RM Used Fullset✨✨` | `rm` | Richard Mille |
| `Patek Used✨✨` | `patek` | Patek Philippe |
| `PP stock🍰🍰` | `pp` | Patek Philippe |
| `🇭🇰🇭🇰 Rolex 🇭🇰🇭🇰` | `rolex` | Rolex |
| `🇭🇰🇭🇰 VC 🇭🇰🇭🇰` | `vc` | Vacheron Constantin |
| `🇭🇰🇭🇰 FPJ 🇭🇰🇭🇰` | `fpj` | F.P. Journe |
| `✨ Richard Mille` | `richard mille` | Richard Mille |
| `☁️ F.P. Journe` | `f.p. journe` | F.P. Journe |
| `BRAND NEW Rolex` | `rolex` | Rolex |
| `All Brand new` | (empty after strip) | None (section header only) |

### 3.3 Section Condition Detection

Brand headers can also convey condition for all watches in that section.

Detection function: `_detect_section_condition(line)`

Priority order (checked first to last):
1. `like new` -> "Used" (Like New is closer to Used than Unworn)
2. Bare `like` alone -> "Used" (short for "like new")
3. `unworn`, `brand new`, `bnib` -> "Unworn"
4. `nos`, `stickered`, `sealed` -> "Unworn"
5. `\bnew\b` (but NOT as part of "like new") -> "Unworn"
6. `used`, `pre-owned`, `preowned` -> "Used"

Examples:
- `Patek Used✨✨` -> section condition = "Used"
- `RM Used Fullset✨✨` -> section condition = "Used"
- `New Fullset` -> section condition = "Unworn"
- `Like` -> section condition = "Used"

Emoji-based section markers from real chat data:
- `🐵` / `🍃` / `🎃` / `🍊` / `💯` are decorative only and do not carry condition meaning. The condition is inferred from the TEXT after emoji stripping.

### 3.4 `detect_brand_from_content` vs `detect_brand_header`

| Function | Purpose | Used For |
|----------|---------|----------|
| `detect_brand_header(line)` | Detects if a single line IS a brand header | Stock list section parsing |
| `detect_brand_from_content(content)` | Finds brand mentioned anywhere in message text | Brand hint for single-post matching |

`detect_brand_from_content` uses the same alias list and word-boundary matching but scans the entire message content rather than expecting the line to BE a header.

---

## 4. Reference Extraction

### 4.1 Main Extraction Function (`_extract_ref_from_line`)

Steps:
1. Strip emoji via `_clean_text`
2. Strip leading asterisks and whitespace
3. Strip leading condition words: `used`, `new`, `unworn`, `like new`, `brand new`, `bnib`, `nos`, `fresh`, `polished`
4. Reject year-starting lines (see 4.3)
5. Try RM special pattern (see 4.2)
6. Try main reference regex

Main reference regex:
```
^([A-Za-z]{0,4}\d{2,6}(?:[/\-][A-Za-z0-9]+)*[A-Za-z]{0,4})\b
```

This matches references at the START of the cleaned line. Breakdown:
- `[A-Za-z]{0,4}` - optional 0-4 letter prefix (e.g., `M` in `M28603`)
- `\d{2,6}` - 2-6 digits (the core reference number)
- `(?:[/\-][A-Za-z0-9]+)*` - optional slash or dash separated segments
- `[A-Za-z]{0,4}` - optional trailing letters

Real-world matches:

| Input Line | Extracted Reference |
|------------|-------------------|
| `5968A N2 1.17m hkd` | `5968A` |
| `5712/1A blue N1 1.52m hkd` | `5712/1A` |
| `126334G Black Jub N12 138,000` | `126334G` |
| `Used 5167A-001` | `5167A-001` (after stripping "Used") |
| `7118/1200A grey N2 808,000hkd` | `7118/1200A` |
| `5139G-010 2022 New 440,000hkd` | `5139G-010` |
| `RM037RG show diamond black lip n2/2026 300k usdt` | `RM037RG` |
| `RDDBEX0398 2014year fullset 1.42m hkd` | `RDDBEX0398` |
| `V41 FR 2` | `V41` |

### 4.2 Richard Mille Special Handling

RM references often have a space between `RM` and the number: `RM 11-03`, `RM 07-01`.

Special regex:
```
^(RM\s*\d{2,4}(?:[/\-][A-Za-z0-9]+)*)\b
```

Normalization removes the space: `RM 11-03` -> `RM11-03`

### 4.3 Year-Shaped Rejection

Lines starting with year-like tokens are rejected as not containing references (they are typically continuation lines from stock lists).

**Leading year rejection** (before reference extraction even begins):
```
^20[1-3]\d(?:y|year|used|new|unworn|full|brand|mint|like|fresh|polished)?\b
```

And short year format:
```
^\d{2}y\b
```

**Post-extraction validation** (after a candidate is found):
```
^20[1-3]\d[a-zA-Z]{0,8}$
```
With suffix check against: `''`, `'y'`, `'year'`, `'years'`, `'used'`, `'new'`, `'unworn'`, `'full'`, `'brand'`, `'bnib'`, `'nos'`, `'mint'`, `'like'`, `'fresh'`, `'polished'`, `'worn'`

Examples that are REJECTED:
- `2022y HKD 570K` -> year continuation, not a reference
- `2025used 180K` -> condition concatenated to year
- `2022new fullset` -> condition concatenated to year
- `2023Mint` -> condition concatenated to year
- `19y` -> short year (2019)
- `2024year` -> year with "year" suffix

### 4.4 Cartier/Hublot Dot-Separated References

References like `505.CM.5970.RX` are matched by the main regex because the dots are handled as part of the alphanumeric pattern. These are typically matched via OEM references in the watch index rather than the extraction regex (which expects `/` or `-` separators).

### 4.5 OEM References

These are manufacturer-specific reference codes stored in the `oem_references` field of the Watch model. They use formats like:
- `M28603-0003` (Rolex M-prefix)
- `26240ST.OO.1320ST.08` (AP dot-separated)
- `310.30.42.50.01.001` (Omega dot-separated)

OEM references are matched via the watch index lookup (see section 5), not via `_extract_ref_from_line`.

---

## 5. Reference Matching Pipeline

The matching pipeline tries progressively less specific strategies. Each step is case-insensitive.

### 5.1 Step-by-Step Order

#### For stock list lines (`match_watch_by_ref`):

1. **ws_code exact match**: `ref_lower` looked up directly in `by_ws_code` dict
   - Example: `"126710blnr jub"` matches ws_code `126710BLNR Jub`
   - If found: return immediately (single result)

2. **OEM reference exact match**: `ref_lower` looked up in `by_oem_ref` dict
   - Example: `"m28603-0003"` matches Rolex watch
   - Brand-filtered, then disambiguated with line tokens

3. **Reference exact match**: `ref_lower` looked up in `by_reference` dict
   - Example: `"126334"` matches all watches with reference `126334`
   - Brand-filtered, then disambiguated with line tokens (e.g., `Jub` / `Oys`)

4. **Alias exact match**: `ref_lower` looked up in `by_alias` dict
   - Example: a catalog alias `"batman"` matching `126710BLNR`
   - Brand-filtered, then disambiguated

4b. **Alias/ws_code match against reconstructed line**: when the 4 single-key lookups miss, the cleaned line content (`ref + " " + line_tokens`) is scanned against the pre-compiled alias/ws_code patterns.
   - Catches multi-word aliases that the leading-token ref extraction strips off.
   - Example: `🍄228238A Black N3/26 $550K🏷️` — ref extracted as `228238A` (not a direct key), but `"228238a black"` hits alias index → `228238A Blk`.
   - A full alias/ws_code hit here is authoritative and beats fuzzy.

5. **Fuzzy matching** (via rapidfuzz `WRatio`):
   - Brand-filtered candidates only
   - Threshold: 85 (minimum to consider)
   - Confident threshold: 95 (auto-accept)
   - Scores in [85, 95): routed to `needs_review` with explanation
   - Disambiguated with line tokens if multiple results

#### For single-post messages (`match_watch`):

Uses pre-compiled combined regex patterns (one alternation regex per dict) for fast scanning of the full message content. Order: ws_code -> reference -> OEM ref -> alias. No fuzzy matching at this level.

### 5.2 Brand-Hint Filtering

When a brand hint is available (from section header or message content), candidates are filtered to only that brand. If filtering leaves zero results, the filter is removed and all brands are considered.

### 5.3 Disambiguation with Line Tokens

When multiple watches match the same reference (e.g., `126710BLNR Jub` and `126710BLNR Oys` both have reference `126710BLNR`), the remaining tokens on the line are used to pick the right variant.

Scoring system:
- Token found in ws_code: **+10 points**
- Token found in dial field: **+10 points**
- Token found in bracelet field: **+10 points**
- Token found in model name: **+5 points**
- Token found in aliases: **+8 points**
- Distinguishing ws_code part in combined tokens: **+3 points**
- Full alias match in combined tokens: **+10 points**

Tokens that are skipped during disambiguation:
- Month codes: `N1`, `N2`, `N12`, etc.
- Prices: `145.5k`, `388,000`, etc.
- Years: `2024`, `20y`, etc.
- Condition/currency words: `used`, `new`, `hkd`, `usd`, etc.

Real-world example:
```
126710blnr jub n1 145.5k
```
Tokens after ref: `["jub", "n1", "145.5k"]`
- `n1` skipped (month code)
- `145.5k` skipped (price)
- `jub` resolved to `Jubilee` via descriptor aliases
- `jub` found in ws_code `126710BLNR Jub` -> +10 points
- Winner: `126710BLNR Jub`

### 5.4 Fuzzy Matching Details

- Algorithm: `rapidfuzz.fuzz.WRatio` (Weighted Ratio, handles partial matches well)
- Extracts top 5 candidates via `process.extract`
- Minimum ref length: 3 characters
- Results are cached per `(ref, brand_hint)` tuple (max 10,000 entries)
- Results are deduplicated by ws_code

---

## 6. Descriptor Aliases (Full Mapping)

### 6.1 Complete WATCH_DESCRIPTOR_ALIASES

**Bracelet/Style:**
| Alias | Canonical |
|-------|-----------|
| `jub`, `jubilee` | Jubilee |
| `oys`, `oyster` | Oyster |
| `tbr` | Tiger |

**Dial Descriptors:**
| Alias | Canonical |
|-------|-----------|
| `wim`, `wimbledon` | Wimbledon |
| `rom`, `roma`, `roman` | Roman |
| `choc`, `choco`, `cho`, `chocolate` | Chocolate |
| `yml` | YML (Yellow dial) |
| `pn`, `paul newman` | Paul Newman |
| `sundust`, `sun` | Sundust |
| `tiff`, `tiffany` | Tiffany |
| `sodalite` | Sodalite |
| `turqoise`, `turquoise` | Turquoise |
| `pistachio` | Pistachio |
| `ice blue` | Ice Blue |
| `mop` | MOP (Mother of Pearl) |
| `ruby` | Ruby |
| `sapphire` | Sapphire |
| `bright` | Bright |
| `rainbow` | Rainbow |
| `ice` | Ice Blue |

**GMT Bezel Colors:**
| Alias | Canonical |
|-------|-----------|
| `gnrn`, `grnr` | Green/Black (Sprite) |
| `blnr` | Blue/Black (Batman) |
| `blro` | Blue/Red (Pepsi) |
| `vtnr` | Green/Black (Destro) |
| `chnr` | Chocolate/Black (Root Beer) |

**Basic Colors (English):**
| Alias | Canonical |
|-------|-----------|
| `blk`, `black`, `bk` | Black |
| `wht`, `white`, `wh` | White |
| `blu`, `blue` | Blue |
| `grn`, `green` | Green |
| `grey`, `gray` | Grey |
| `red` | Red |
| `pink` | Pink |
| `purple` | Purple |
| `champ`, `champagne` | Champagne |
| `gold` | Gold |
| `silver` | Silver |
| `slate` | Slate |
| `brown` | Brown |
| `lavender` | Lavender |
| `mete`, `meteorite` | Meteorite |
| `onyx` | Onyx |
| `pave`, `paved` | Paved |
| `ombre`, `ombrè`, `ombré` | Ombre |

**German Colors:**
| Alias | Canonical |
|-------|-----------|
| `schwarz` | Black |
| `weiss`, `weiß` | White |
| `blau` | Blue |
| `grün`, `gruen` | Green |
| `rot` | Red |
| `grau` | Grey |
| `braun` | Brown |
| `silber` | Silver |
| `römisch`, `roemisch` | Roman |

**Spanish Colors:**
| Alias | Canonical |
|-------|-----------|
| `negro` | Black |
| `blanco` | White |
| `azul` | Blue |
| `verde` | Green (also Italian) |
| `rojo` | Red |
| `gris` | Grey (also French) |
| `marron`, `marrón` | Brown (also French) |
| `plata`, `plateado` | Silver |
| `dorado` | Gold |
| `romano` | Roman (also Italian) |

**French Colors:**
| Alias | Canonical |
|-------|-----------|
| `noir` | Black |
| `blanc` | White |
| `bleu` | Blue |
| `vert` | Green |
| `rouge` | Red |
| `argent` | Silver |
| `romain` | Roman |

**Italian Colors:**
| Alias | Canonical |
|-------|-----------|
| `nero` | Black |
| `bianco` | White |
| `rosso` | Red |
| `grigio` | Grey |
| `marrone` | Brown |
| `argento` | Silver |

**Bosnian/Croatian/Serbian Colors:**
| Alias | Canonical |
|-------|-----------|
| `crna`, `crno` | Black |
| `bijela`, `bijelo`, `bela`, `belo` | White |
| `plava`, `plavo` | Blue |
| `zelena`, `zeleno` | Green |
| `crvena`, `crveno` | Red |
| `siva`, `sivo` | Grey |
| `smeđa`, `smedja` | Brown |
| `srebrna`, `srebrno` | Silver |
| `zlatna`, `zlatno` | Gold |
| `roza` | Pink |

### 6.2 The `_resolve_descriptor` Function

Takes a token, returns a list of its canonical form(s) for disambiguation matching.

```python
_resolve_descriptor("blk")   # -> ["blk", "black"]
_resolve_descriptor("jub")   # -> ["jub", "jubilee"]
_resolve_descriptor("ombré") # -> ["ombré", "ombre", "ombre"]  (diacritics stripped)
_resolve_descriptor("hello") # -> ["hello"]  (unknown token, returned as-is)
```

### 6.3 Diacritics Stripping

`_strip_diacritics()` uses Unicode NFKD normalization to remove combining characters:
- `ombré` -> `ombre`
- `grün` -> `grun`
- `smeđa` -> `smedja` (approximately)

This allows `ombré` in a message to match the alias `ombre` in the descriptor map.

---

## 7. Year/Date Parsing

### 7.1 Extraction (`extract_month_year_from_text`)

Patterns are tried in order of specificity. Each pattern scans ALL occurrences (via `finditer`) before falling through to the next.

#### Priority 1: N-month/year with 'y' suffix
Pattern: `\b[nN](\d{1,2})[/\-](\d{2,4})\s*y\b`
Examples: `N2/26y`, `N9/2025y`, `N3/2026y`
Returns: `n2/26`, `n9/2025`, `n3/2026`

#### Priority 2: N-month/year without y
Pattern: `\b[nN](\d{1,2})[/\-](\d{2,4})\b`
Examples: `N2/26`, `N3/2026`, `N10/25`
Validation: month must be 1-12, year must be at least 2 digits
Returns: `n2/26`, `n3/2026`

#### Priority 3: N-month+year concatenated with y (missing /)
Pattern: `\b[nN](\d{1,2})(\d{4})\s*y\b`
Example: `N32026y` (meant as N3/2026)
Returns: `n3/2026`

#### Priority 4: YYYY/MM or YYYY-MM
Pattern: `\b(\d{4})[/\-](\d{1,2})\b`
Validation: year 2010-2035, month 1-12
Examples: `2025/11`, `2023-4`, `2026/2`
Returns: `02/26` (MM/YY format)

**Edge case**: `5980/60` has year=5980, which fails the 2010-2035 check, so this is correctly NOT matched as a date.

#### Priority 5: N-month only
Pattern: `\b[nN](\d{1,2})\b`
Validation: month 1-12, NOT preceded by `/` (to avoid matching model suffixes like `/1G` as `/N1`)
Examples: `N1`, `N2`, `N10`, `N12`
Returns: `n1`, `n2`, etc.

**Edge case**: `N3/1G` -- the N3 is preceded by nothing problematic, but `1G` is not a valid year (len < 2), so priority 2 does not match. Priority 5 would match `N3` as month-only. The `/1G` part is a model suffix.

#### Priority 6: MM/YY or MM/YYYY
Pattern: `\b(\d{1,2})[/\-](\d{2,4})\b`
Validation: month 1-12, NOT preceded by currency symbol
Examples: `09/25`, `02/26`, `26/2` (month=26 fails, skipped), `12/2025`
Returns: `09/25`, `02/26`, `12/2025`

#### Priority 7: Month name with year
Pattern: `\b(january|february|...|jan|feb|...\s*\d{2,4})\b`
Examples: `January 2024`, `Sep 2025`
Returns: `january 2024`, `sep 2025`

### 7.2 Standalone Year Extraction (`extract_year_from_line`)

Used when `extract_month_year_from_text` fails. Looks for:
- Full year: `\b(20[1-2]\d)\s*(?:year|y)?\b` -> `2024`, `2022year`
- Short year with 'y': `(?<![nN/\-])(?:^|\s)(\d{2})y\b` -> `19y` = 2019, `20y` = 2020
  - NOT preceded by N (month code), / or - (date separator)
  - Range: 10-35 (2010-2035)

### 7.3 Normalization (`normalize_month_year`)

Converts extracted date strings into canonical format.

Rules:
1. Strip trailing `y` suffix
2. `n{month}` only -> `MM/YY` (year inferred from reference month/year)
3. `n{month}/{year}` -> `MM/YY`
4. `{month}/{year}` -> `MM/YY`
5. Month name + year -> `MM/YY`
6. Pure 4-digit year -> returns the year as-is (e.g., `"2025"`, NOT `"01/25"`)
7. Pure 2-digit number -> interpreted as year, returns `"20XX"` (e.g., `"19"` -> `"2019"`)

**WTB "+" suffix**: When mode is "WTB", a `+` is appended to all results: `"02/26+"`, `"2025+"`.

**No fabrication when absent**: When a stock-list line contains no date/year tokens at all, `Monat/Jahr` is left empty. The message timestamp is **never** used to synthesize a warranty date — that would hallucinate `04/26` onto every dateless line in an April 2026 export. Same behavior for both WTS and WTB.

Examples:
| Input | Mode | ref_month=3, ref_year=2026 | Output |
|-------|------|---------------------------|--------|
| `n2/26y` | WTS | -- | `02/26` |
| `n9/2025y` | WTS | -- | `09/25` |
| `n2` | WTS | month=3, year=2026 | `02/26` (Feb is before March, so same year) |
| `n10` | WTS | month=3, year=2026 | `10/25` (Oct is after March, so previous year) |
| `2025` | WTS | -- | `2025` |
| `2024` | WTB | -- | `2024+` |
| `19y` | WTS | -- | `2019` |

---

## 8. Price Parsing

### 8.1 Currency-Prefixed Patterns

Checked in this order (first match wins):

| Pattern | Currency | Example |
|---------|----------|---------|
| `HK$` or `hk$` + number | HKD | `HK$387k`, `hk$790,000` |
| `HKD` or `hkd` + number | HKD | `HKD 300k`, `hkd563k`, `HKD:950000` |
| `USDT` or `usdt` + number | USDT | `USDT 448k`, `usdt470k` |
| `USD` or `usd` + number | USD | `USD 150,000` |
| `EUR` or `eur` or `€` + number | EUR | `€5,000` |
| `GBP` or `gbp` or `£` + number | GBP | `£10,000` |
| `$` + number | **context-dependent** | `$565000` |

The separator between currency and number can be `:`, space, or nothing: `HKD:950000`, `HKD 300k`, `hkd563k`.

Currency tags are matched **case-insensitively** — `Hkd`, `HkD`, `Usdt`, etc. all hit. This is load-bearing: without case-insensitivity the prefix pattern would miss mixed-case tags, the suffix fallback would then grab stray digits before the currency tag (e.g. `4/26 Hkd 968k` → `26` instead of `968k`), and the date fragment would win.

For bare `$`, the currency depends on sender country:
- If sender is in `HKD_DEFAULT_COUNTRIES` = `{HK, CN, MO, SG}` -> HKD
- Otherwise -> USD

### 8.2 Currency-Suffixed Patterns

Pattern: `([\d,.]+[kKmM]?)` followed by currency name
Examples: `387k hkd`, `1.265m hkd`, `435,000hkd`, `300k usdt`, `162300usdt`

Currency priority for suffix matching: `USDT > HKD > USD > EUR > GBP > CHF > AED > SGD > JPY`

### 8.3 Colon Separator

The regex allows `:` between currency and number: `HKD:950000`

### 8.4 Concatenated Format

Separate pattern for digits directly followed by currency: `(\d{3,9})\s*(hkd|usd|usdt|...)` handles `345000hkd`, `142000hkd`, `1245000hkd`.

### 8.4.1 Currency-Adjacent Prices Are Always Thousands

Luxury watches are never priced below a few thousand in any currency, so when a price sits directly next to a currency symbol/suffix, it is interpreted as **thousands** unless it is already a full amount (4+ digit integer or explicit k/m suffix or already-separated thousands).

Interpretations:
| Input | Output |
|-------|--------|
| `17,5€` | `17,500 EUR` |
| `17.5€` | `17,500 EUR` |
| `9,8€` | `9,800 EUR` |
| `125€` | `125,000 EUR` |
| `125.00€` | `125,000 EUR` |
| `999€` | `999,000 EUR` |
| `10000€` | `10,000 EUR` (already full) |
| `435.000€` | `435,000 EUR` (European thousands separator) |
| `435,000€` | `435,000 EUR` |
| `1,265,000 eur` | `1,265,000 EUR` (already full) |
| `850k hkd` | `850,000 HKD` (explicit k) |
| `1.815m hkd` | `1,815,000 HKD` (explicit m) |

Rules summary:
- Has k/m suffix → respect it.
- Pure integer 4+ digits (no separators) → already full.
- 3-digit decimal (e.g. `435.000`) → already full (European thousands).
- Multi-separator (e.g. `1,265,000` / `1,265.5`) → already full.
- Everything else → ×1000.

### 8.4.2 Phone-Country Default Currency

When a price has no currency symbol/suffix and the sender country is known, the currency defaults by country:

| Country set | Default |
|-------------|---------|
| `HK, CN, MO, SG` | HKD |
| `DE, FR, IT, ES, NL, BE, AT, PT, IE, FI, GR, LU, SK, SI, EE, LV, LT, MT, CY, HR` | EUR |
| `UK, GB` | GBP |
| `CH` | CHF |
| Everything else (US, JP, AE, etc.) | USD |

### 8.5 k/m Expansion

| Input | Expanded |
|-------|----------|
| `387k` | `387,000` |
| `1.17m` | `1,170,000` |
| `1.265m` | `1,265,000` |
| `145.5k` | `145,500` |
| `6.238m` | `6,238,000` |

### 8.6 Discount Formats

Pattern: `(?:[$EUR|GBP|HK$])?\s*([\d,.]+[kKmM]?)\s*-\s*(\d{1,2})%`

Examples:
- `$565000-25%` -> price 565,000 * 0.75 = `423,750`
- `134000-35%` -> price 134,000 * 0.65 = `87,100`
- `$83000-35%` -> price 83,000 * 0.65 = `53,950`

### 8.7 Dot Handling in Prices

- Multiple dots: `1.234.567` -> dots removed = `1234567`
- Single dot with 3-digit decimal: `435.000` -> dot removed = `435000` (European thousand separator)
- Single dot with other decimal: `1.17` -> treated as decimal (for k/m suffixes)
- Double dots: `144..5` -> rejected (likely a reference number)

### 8.8 Price Validation

**Year rejection**: Prices between 2010 and 2035 (as integers) are rejected.

**Brand minimum thresholds** (prices below these are flagged for review):

| Brand | Minimum (USD equiv.) |
|-------|---------------------|
| Richard Mille | 30,000 |
| MB&F | 20,000 |
| F.P. Journe | 15,000 |
| Patek Philippe | 8,000 |
| A. Lange & Sohne | 8,000 |
| Audemars Piguet | 5,000 |
| Vacheron Constantin | 5,000 |
| H. Moser & Cie | 5,000 |
| Rolex | 3,000 |
| Blancpain | 3,000 |
| Breguet | 3,000 |
| Hublot | 2,000 |
| Jaeger-LeCoultre | 2,000 |
| Chopard | 2,000 |
| Girard-Perregaux | 2,000 |
| Piaget | 2,000 |
| Franck Muller | 2,000 |
| IWC | 1,500 |
| Zenith | 1,500 |
| Panerai | 1,500 |
| Omega | 1,000 |
| Cartier | 1,000 |
| Breitling | 1,000 |
| Tudor | 1,000 |
| Tag Heuer | 500 |
| Default (unknown) | 500 |

Prices below the minimum are not rejected outright -- they are routed to `needs_review` with a reason like `"Price 3,000 below minimum 8000 for Patek Philippe"`.

### 8.9 Multiple Prices

`extract_all_prices()` finds all prices in a message with their currencies. Currency preference order:
`USDT (0) > USD (1) > EUR (2) > GBP (3) > CHF (4) > HKD (5)`

Overlapping matches (within 5 characters) are deduplicated.

### 8.10 Serial Code Stripping

Before price extraction, serial code prefixes are removed to prevent false matches:
```python
re.sub(r'\b(?:SC|SN|REF|ser\.?)\s*[\d,]+', '', content, flags=re.IGNORECASE)
```

### 8.11 Bare Price in Stock Lines

When no currency prefix/suffix is found, `extract_price_from_line` scans tokens from right to left, skipping:
- Month codes (`N1`, `N2`, etc.)
- Year tokens (`2024`, `2022year`, `19y`)
- Non-numeric tokens
- The first token (likely the reference number)

If a bare numeric token is found, currency defaults by sender country:
- `HKD_DEFAULT_COUNTRIES` -> HKD
- Otherwise -> USD

---

## 9. Condition Detection

### 9.1 WTS Conditions Mapping

| Keyword(s) | Normalized Condition |
|-----------|---------------------|
| `brand new`, `bnib`, `b.n.i.b`, `fresh`, `unworn`, `un-worn`, `stickered`, `sealed`, `unsized`, `new`, `nos` | Unworn |
| `like new` | Used |
| `retail ready` | Retail Ready |
| `handling marks`, `handling mark` | Handling Marks |
| `polished` | Polished |
| `used`, `worn`, `pre-owned`, `preowned` | Used |

Keywords are matched longest-first to ensure `"brand new"` matches before `"new"`, and `"like new"` matches before `"new"`.

### 9.2 WTB Conditions Mapping

| Keyword(s) | Normalized Condition |
|-----------|---------------------|
| `unworn`, `new`, `only unworn`, `unworn only` | Only Unworn |
| `used`, `can be used`, `used ok`, `used fine` | Can be Used |

### 9.3 Defaults

- **WTS**: defaults to `"Unworn"` when no explicit condition keyword is found
- **WTB**: defaults to `None` (no condition)

### 9.4 Section Condition Inheritance

In stock lists, the section header condition (from `_detect_section_condition`) is inherited by all lines in that section unless the line has its own explicit condition.

**Mode-aware vocabulary**: `_detect_section_condition` and `extract_condition_from_line` both take a `mode` argument and emit values from the matching vocabulary. A WTB stock list with header "Patek Used" yields `"Can be Used"`, never `"Used"`. WTB rows can ONLY be `"Only Unworn"` or `"Can be Used"` (or empty) — no WTS-only labels like `"Used"`, `"Polished"`, `"Handling Marks"` should ever appear on a WTB row.

Example:
```
Patek Used✨✨        <-- section_condition = "Used"
5968A 2024 used 1.10m hkd   <-- explicit "used" -> "Used"
5167R 2022 730,000hkd        <-- no condition word -> inherits "Used" from section
```

Function `extract_condition_from_line` priority:
1. Line's own condition keyword
2. Section condition from header
3. Default: `"Unworn"`

---

## 10. Stock List Processing

### 10.1 Detection (`_is_stock_list_message`)

A message is a stock list if it meets either:
- **1+ brand headers AND 3+ reference lines**, OR
- **5+ reference lines** (even without brand headers)

Detection samples only the first 40 non-empty lines for performance (early termination on success).

### 10.2 Split-Line Merging

Before parsing, lines are pre-processed to merge split entries where:
- Line N has a reference but no price
- Lines N+1, N+2, N+3 have price/year/condition but no reference

Look-ahead stops if:
- Next line has its own reference
- Next line is a brand header
- A price was gathered
- The next line has neither year/condition nor price

Real-world example (merged):
```
RM 67-02 Alexis Pinturault 26/2    <-- ref found, no price
HKD3.67m  usdt470k                  <-- price found, merged
```
Becomes: `RM 67-02 Alexis Pinturault 26/2 HKD3.67m usdt470k`

### 10.3 Per-Line Parsing

For each non-header line with a reference:

1. Extract reference via `_extract_ref_from_line`
2. Skip SOLD lines: `\bsold\b` (case-insensitive)
3. Get line tokens (everything after the reference)
4. Match via `match_watch_by_ref` (with fuzzy score tracking)
5. If no match: try full-line `match_watch` (exact patterns only, no fuzzy)
6. Extract: condition, month/year, price, remarks
7. Route to matched / needs_review / not_in_database

### 10.4 SOLD Line Skipping Within Stock Lists

Only the single SOLD line is skipped, NOT the entire stock list:
```
126334G Grey Jub N2 161,000
126518LN YML N12 - SOLD          <-- this line only is skipped
126518LN Black N1 404,000
```

### 10.5 Section Headers Not Parsed as Entries

These are detected and skipped:
- Brand headers (see section 3.2)
- Condition-only labels: `New Fullset`, `Used Fullset`, `Like New`, `Like`, `All Brand New`
- Lines starting with `--` or `---`
- Lines starting with `—` (em-dash)
- Empty/decorative-only lines

Example:
```
—-no box-—香港現貨
```
This is a note/header, not a watch entry.

---

## 11. Phone Number Extraction & Country Detection

### 11.1 Phone Extraction

Pattern: `(\+[\d\s\-\(\)]{7,20})` at the start of the sender string.

Then cleaned: remove spaces, dashes, parentheses. Must match `^\+\d{7,15}$`.

Handles formats:
- `+852 5203 4944 WS` -> `+85252034944`
- `+852 6547 2648` -> `+85265472648`
- `+49 170 1234567` -> `+491701234567`
- `+1 (450) 866-2919 WS` -> `+14508662919`

Returns `None` for contact names like `~ Mei Li`, `Hakimi HK`.

### 11.2 PHONE_PREFIX_TO_COUNTRY (Full Mapping)

Longest prefix matched first (3-digit, then 2-digit, then 1-digit):

**1-digit:**
| Prefix | Country |
|--------|---------|
| 1 | US |
| 7 | RU |

**2-digit:**
| Prefix | Country | | Prefix | Country |
|--------|---------|---|--------|---------|
| 20 | EG | | 60 | MY |
| 27 | ZA | | 61 | AU |
| 30 | GR | | 62 | ID |
| 31 | NL | | 63 | PH |
| 32 | BE | | 64 | NZ |
| 33 | FR | | 65 | SG |
| 34 | ES | | 66 | TH |
| 36 | HU | | 81 | JP |
| 39 | IT | | 82 | KR |
| 40 | RO | | 84 | VN |
| 41 | CH | | 86 | CN |
| 43 | AT | | 90 | TR |
| 44 | UK | | 91 | IN |
| 45 | DK | | 92 | PK |
| 46 | SE | | 93 | AF |
| 47 | NO | | 94 | LK |
| 48 | PL | | 95 | MM |
| 49 | DE | | 98 | IR |
| 51 | PE | | |
| 52 | MX | | |
| 53 | CU | | |
| 54 | AR | | |
| 55 | BR | | |
| 56 | CL | | |
| 57 | CO | | |
| 58 | VE | | |

**3-digit:**
| Prefix | Country | | Prefix | Country |
|--------|---------|---|--------|---------|
| 212 | MA | | 852 | HK |
| 213 | DZ | | 853 | MO |
| 216 | TN | | 855 | KH |
| 218 | LY | | 856 | LA |
| 220 | GM | | 880 | BD |
| 221 | SN | | 886 | TW |
| 234 | NG | | 960 | MV |
| 254 | KE | | 961 | LB |
| 255 | TZ | | 962 | JO |
| 256 | UG | | 963 | SY |
| 260 | ZM | | 964 | IQ |
| 263 | ZW | | 965 | KW |
| 351 | PT | | 966 | SA |
| 352 | LU | | 967 | YE |
| 353 | IE | | 968 | OM |
| 354 | IS | | 970 | PS |
| 356 | MT | | 971 | AE |
| 358 | FI | | 972 | IL |
| 370 | LT | | 973 | BH |
| 371 | LV | | 974 | QA |
| 372 | EE | | 975 | BT |
| 380 | UA | | 976 | MN |
| 381 | RS | | 977 | NP |
| 385 | HR | | 992 | TJ |
| 386 | SI | | 993 | TM |
| 420 | CZ | | 994 | AZ |
| 421 | SK | | 995 | GE |
| | | | 996 | KG |
| | | | 998 | UZ |

### 11.3 HKD_DEFAULT_COUNTRIES

Countries where bare `$` is interpreted as HKD:
```python
{"HK", "CN", "MO", "SG"}
```

---

## 12. Known Edge Cases & Gotchas

### 12.1 "N3/1G" is a Model Suffix, Not a Date

In references like `7118/1200A`, the `/1200A` is part of the reference. The month extraction pattern for N-month/year validates that the "year" part is at least 2 digits. `N3/1G` would have month=3, year=`1G` which fails the numeric year check. The ref extraction regex captures the full `7118/1200A` as one token.

Additionally, N-month-only (priority 5) explicitly checks that the `N` is NOT preceded by `/`.

### 12.2 "5980/60G" -- Slash is Part of the Reference

The YYYY/MM pattern (priority 4) checks that the year is 2010-2035. `5980` fails this check, so `/60G` is not interpreted as a date. The full `5980/60G` is captured as a reference.

### 12.3 Multi-Watch Single Lines

Rare cases where a single line contains multiple watches (e.g., `Looking for 7118/1300r - 5968a new 2025`). The parser extracts the first reference only. If the line cannot be resolved to a single watch, it goes to `needs_review`.

### 12.4 Lines Starting with Years

Lines like `2022y HKD 570K` or `2025used 180K` are continuation lines from a previous stock list entry. The year-rejection logic in `_extract_ref_from_line` prevents `2022` from being treated as a reference. These lines get merged with the previous reference line during split-line merging.

### 12.5 "looking for" vs "looking forward"

Word-boundary matching ensures `"looking for"` does not match inside `"looking forward to your reply"`. The regex `(?<![a-zA-Z])looking for(?![a-zA-Z])` requires non-alpha characters (or string edges) on both sides.

### 12.6 SOLD in Multi-Line Messages

A multi-line stock list with one SOLD line:
```
126518LN YML N12 490,000
126518LN YML N1 - SOLD
126518LN Black N1 404,000
```
Only the SOLD line is skipped. The other lines are parsed normally. This is different from a single-line SOLD message (which causes the entire message to be skipped).

### 12.7 Contact Names vs Phone Numbers

When the sender is a saved contact name (e.g., `~ Mei Li`, `Hakimi HK`), no phone number is extracted. These rows get a review reason: `"No phone number (contact name used)"`.

### 12.8 "tag" as Brand Alias vs Generic Word

`"tag"` maps to `Tag Heuer` in the brand aliases. Word-boundary matching prevents matching inside longer words, but a standalone `tag` in a message (e.g., `"both tag"`) could theoretically false-match. In practice, `"both tag"` is a remarks keyword, and brand detection happens in a separate pass from remarks extraction.

### 12.9 WhatsApp Bold Markers

WhatsApp wraps bold text in asterisks: `*5/3/2026 Stock List*`. Brand header detection strips these before matching. Price parsing also handles `*433,000*` by stripping the asterisks.

### 12.10 Typos in Real Data

The parser handles common typos found in dealer messages:
- `"richard miller"` -> Richard Mille (alias)
- `"yaer"` in `2022yaer` -- the year regex handles this via the leading-year rejection pattern
- `"ustd"` for USDT -- NOT explicitly handled (would fail currency match)
- `"ueed"` for `used` -- NOT handled by condition detection (would miss the condition)
- `"bule"` for `blue` -- NOT handled by descriptor aliases

### 12.11 Emoji Price Tags

Real data includes `🏷️` (price tag emoji) next to prices:
```
126334G Grey Jub N2 🏷️ 162,000
```
The emoji is stripped by `_clean_text` before price extraction, so the price `162,000` is correctly extracted.

---

## 13. AI Matching Pass

### 13.1 When It Is Invoked

The AI pass runs AFTER the main processing loop, specifically on rows that ended up in the `not_in_database` bucket (where no automatic match was found). It does NOT run on `needs_review` rows (those already have candidate matches).

### 13.2 Caps and Timeouts

- Maximum items: 3,000 (first N items kept; excess skipped)
- Batch size: 1,500 lines per API call
- Max concurrent API calls: 5
- Overall timeout: 180 seconds (3 minutes)
- Model: `gpt-5.2`
- Temperature: 0.1
- Max tokens per call: 16,384

### 13.3 The Prompt Structure

The prompt contains:

1. **Role**: "You are an expert luxury watch dealer reference matcher"
2. **Watch catalog**: All watches from the index, formatted as:
   ```
   ws_code | brand model | refs: reference, oem_ref1, alias1, ...
   ```
3. **Dealer abbreviations reference**: jub, oys, wim, gnrn, blnr, blro, vtnr, rom, choc, yml, pn, tbr, sun, tiff, N-codes, brand aliases
4. **Rules**:
   - NEVER match across brands
   - Provide suggestions even for watches not in catalog
   - ws_code format: `reference + key descriptor`
   - Confidence 0-100, only >80 is reliable
   - Set confidence 0 for truly unidentifiable lines
5. **Unmatched lines**: `[index] content` (truncated to 400 chars)

Expected response: JSON array of objects with `index`, `ws_code`, `brand`, `model`, `suggested_ws_code`, `confidence`, `in_catalog`.

### 13.4 Confidence Thresholds

| Confidence | Action |
|-----------|--------|
| < 1 | Ignored entirely |
| 1-79 | Row promoted from `not_in_database` to `needs_review` with AI suggestion |
| 80-100 | Row moved to `matched` with AI-determined data |

### 13.5 in_catalog vs suggested

- **`in_catalog = true`**: AI matched to an existing ws_code in the watch catalog. The matched watch data is used directly.
- **`in_catalog = false`**: AI identified the watch (brand + model) but it is not in the catalog. The `ai_ws_code` and `ai_brand` are used. These are also collected as **suggested catalog additions** and output as a separate CSV.

### 13.6 Handling Hallucinated ws_codes

If AI returns a `ws_code` that does not exist in the catalog index, `watch` will be `None` and `in_catalog` will be `False`. The system falls back to using `ai_brand` and `ai_ws_code` from the AI response. This prevents hallucinated codes from causing lookup failures.

### 13.7 Suggested Catalog Additions

Watches that AI identifies with confidence >= 80 but are NOT in the catalog are collected and output as a separate CSV with columns:
- `brand`
- `suggested_ws_code`
- `model`
- `reference`
- `confidence`
- `example_line`

Deduplicated by `suggested_ws_code` (case-insensitive), sorted by confidence descending.

---

## 13A. AI Verification Pass

After the unmatched-line AI matching pass (§13), an additional **AI verification** pass runs over all `matched_rows` AND all `needs_review_rows`. Its job: catch mis-matched variants and mis-parsed prices that slipped through the deterministic pipeline.

### 13A.1 Inputs

Per row the verifier receives:
- `original_text` — the single line that produced the row
- `current_ws_code`, `current_price`, `current_currency`
- `candidates` — short-list (the chosen ws_code plus any ambiguous-match candidates)
- `brand_hint` — the brand detected

### 13A.2 Rules Sent to the Model

1. Literal ws_code in text is ground truth. `126508g blk` → `126508g` (literal wins).
2. Color words decide between variants. `blk`/`black` → Black variant; never silently return Green when Black exists in short-list.
3. Never merge variants. `5167A` ≠ `5167A Black`.
4. Never cross brands.
5. Price verification: `k` = thousands, `m` = millions, European `17,5€` = `17,500 EUR`, integer `125€` = `125 EUR`.
6. Currency precedence for bare amounts: phone-country default (§8.4.2).
7. Symbol `$` = HKD for HK/CN/MO/SG senders, USD otherwise. `USDT` normalizes to `USD`.

### 13A.3 Verdicts

| Action | Confidence | Effect |
|--------|------------|--------|
| `keep` | 80–100 | Leave row unchanged |
| `flip` | **≥ 95** | Correct ws_code and/or price on a matched row |
| `flip` | 80–94 | (On a needs_review row) apply the suggested ws_code but keep the row in needs_review |
| `demote` | < 80 | Move matched row to needs_review with AI reason appended |

A flip below 95 confidence on an already-matched row is **ignored** — the cost of wrong flips outweighs the benefit.

### 13A.4 When the Pass Runs

- Only if `OPENAI_API_KEY` is configured.
- After the §13 unmatched-line AI pass.
- Capped at `AI_MATCHING_CAP` (default 3,000) items total.
- Batches of 800, up to 5 concurrent, `gpt-5.2`, temp 0.05.
- Timeout enforced (`AI_MATCHING_TIMEOUT`); on timeout, deterministic results are preserved.

## 13B. Cross-Currency Normalization

A `$550K` amount from a contact-name sender (no phone → country unknown) is initially labelled `USD`, while the same listing from a phoned HK sender is labelled `HKD`. That split produces spurious currency discrepancies across rows that clearly describe the same listing.

After AI verification and before dedup, a normalization pass runs:

1. Tally currencies per WhatsApp group across **matched rows only** (ground truth).
2. For each matched OR needs-review row whose currency differs from the group's dominant currency, check whether the same `(group, ws_code, numeric_value)` triple also appears in a matched row under the dominant currency.
3. If yes AND the dominant currency clearly wins (≥ 3 count AND ≥ 3× the minority), flip the row's currency to the dominant.

The pass never flips when the group has mixed currencies in comparable proportions, never flips without a same-value peer in the dominant currency, and never touches the numeric amount.

## 14. Deduplication

After all processing (including AI matching), rows are deduplicated.

### 14.1 Dedup Key

```
ws_code | phone | price_numeric | currency | month_year
```

All fields are normalized (lowercase, whitespace stripped, phone cleaned of spaces/dashes).

For `needs_review` and `not_in_database` rows, the extracted reference is appended to the key when no ws_code is present, to avoid merging different watches.

### 14.2 Strategy

- When duplicates are found, the row with the **latest timestamp** is kept
- Applied independently to: matched rows, needs_review rows, not_in_database rows

---

## Appendix A: Remarks Extraction

Keywords are matched with word boundaries and scanned longest-first so a phrase like `nfc card` is consumed before the shorter `nfc` would otherwise fire. Multiple remarks can appear in one row (comma-separated).

| Keyword(s) in text | Normalized |
|---------|-----------|
| `only watch`, `watch only`, `single watch`, `naked`, `no paper`, `no papers` | only watch |
| `white tag`, `both tag`, `both tags` | white tag |
| `full sticker`, `fullsticker`, `fs` | full sticker |
| `fullset`, `full set`, `complete set` | fullset |
| `nfc card`, `nfc` | NFC Card |
| `net price`, `net`, `netto`, `ex-vat`, `ex vat`, `excluding vat`, `intra`, `intracom`, `intracommunity` | net price |
| `only export`, `need export`, `export only`, `export` | only export |
| `margin scheme` | margin scheme |
| `dial change` | dial change |
| `retail ready` | retail ready |
| `polished` | polished |
| `card only` | Card Only |
| `box only` | Box Only |
| `no box` | No Box |
| `can be used`, `used ok`, `used okay`, `used fine` | Can be Used |
| `any year` | Any Year |
| `new clasp` | New Clasp |
| `new buckle` | New Buckle |
| `new paper`, `new papers`, `new certificate` | New Paper |
| `new caliber`, `new calibre` | New Caliber |
| `double seal` | Double Seal |
| `single seal` | Single Seal |
| `open date` | Open Date |
| `wire`, `wire transfer` | Wire |
| `cash`, `bh` | Cash |
| `usdt` | USDT |
| `wta`, `wta munich` | WTA Munich |
| `mercedes`, `mercedes hands` | Mercedes Hands |

Location-preference remarks are appended separately (see Appendix B). `worldwide`
yields the `Worldwide` remark for **WTB only** — the former WTS-side
`Watch Worldwide` remark has been removed.

## Appendix A2: Image-Based Variant Matching (optional layer)

Text parsing always runs first and keeps authority. Image analysis is only used when
a WhatsApp "export with media" `.zip` is uploaded alongside the chat export, and only
for two cases:

1. **Ambiguous variant** — the reference was recognised but several catalog entries
   share it (`Review Reason: Ambiguous match: A, B`) and the text carries no
   distinguishing information. The photos attached to *that message only* are sent to
   the vision model together with the candidates' variable attributes and their catalog
   reference photos.
2. **Missing date on a matched row** — `Monat/Jahr` is empty and the message has photos;
   the warranty card / certificate date is read from the image.

Rules:
- Only attributes that actually differ between the candidates (`bracelet`, `dial`,
  `index`) are used. An attribute that is absent is *fixed* for that reference (a
  Day-Date bracelet is always President) — never treated as missing data.
- A verdict below 85% confidence, or one naming a ws_code outside the candidate set,
  is discarded and the row stays in **Needs Review**. An unclear photo never produces
  an automatic match.
- Resolved rows are written to a separate **Matched via Image** CSV (same columns plus
  `Image Confidence` and `Image Evidence`), so they can be reviewed before import.
- At most 200 rows per run are analysed, 3 photos per message.

## Appendix B: Location Detection (WTS Only)

For WTS posts, text patterns override phone-based country detection:

| Country | Patterns |
|---------|----------|
| HK | `in hk`, `hk deal`, `watch in hk`, `hong kong`, `located in hk` |
| US | `in us/usa`, `watch in us`, `located in us`, `united states` |
| UK | `in uk`, `watch in uk`, `located in uk`, `england`, `united kingdom` |
| DE | `in de/germany`, `watch in de`, `located in germany`, `deutschland` |
| CH | `in ch/switzerland`, `swiss` |
| AE | `in uae/dubai`, `emirates`, `abu dhabi` |
| SG | `in sg/singapore` |
| JP | `in jp/japan` |
| NL | `in nl/netherlands/holland` |
| IT | `in it/italy`, `italia` |
| FR | `in fr/france` |
| AU | `in au/australia` |
| CA | `in ca/canada` |

For WTB: phone prefix country only (no text override). Location preference text is extracted into remarks instead.

## Appendix C: CSV Output Columns

| Column | German Label | Description |
|--------|-------------|-------------|
| Nachrichten Art | Message Type | WTS or WTB |
| Marke | Brand | Canonical brand name |
| WS-Code | WS Code | Watch identifier in catalog |
| Monat/Jahr | Month/Year | Warranty date (MM/YY or YYYY) |
| Standort | Location | Country code |
| Zustand | Condition | Normalized condition |
| Bemerkungen | Remarks | Full Set, Watch Only, etc. |
| Preis | Price | Formatted price + currency |
| Nummer | Number | Phone number or sender name |
| Gruppe | Group | WhatsApp group name |
| Nachricht gepostet am | Posted On | DD.MM.YY HH:MM:SS |

Additional columns for needs_review/not_in_database:
- `Review Reason`
- `Original Text` (first 500 chars)
- `Extracted Ref`
