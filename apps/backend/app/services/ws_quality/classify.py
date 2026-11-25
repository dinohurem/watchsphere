"""Is a message a sale offer (WTS), a buy request (WTB), both, or neither?

Fixes over the current detect_post_type (each one seen in production):
  * European single-watch posts ("... 11.500€", "8.000€", "12.8k + ship") were not recognised at all,
    because only "€ 11.500" (symbol first) and prices >= 100,000 counted as a price signal.
  * A whole sale list became buy requests when it contained one "looking for" line
    ("On sales ... 228238 green roman 493,000 ..." -> 48 WTB orders with prices).
  * Mixed messages ("Looking for: ...  /  Rolex ready HK: ...") are split into sections.
  * WTB wording dealers actually use: looking / need / NTQ / LTB / searching / suche / in search of / 收 / 求.
  * Advertising and service spam is dropped.
"""
import re
from typing import List, Tuple, Optional
from .normalize import clean

_REF = re.compile(
    r"(?<![A-Za-z0-9])(?:"
    r"[A-Za-z]{0,4}\d{3,6}[A-Za-z]{0,6}(?:[/.\-][A-Za-z0-9]{1,12}){0,5}"
    r"|RM\s?\d{2,3}(?:-\d{2})?"
    r"|[A-Za-z]\d[A-Za-z]{2}\d{4}"                       # Cartier W2SA0051, W4PN0018
    r"|[A-Za-z]\d{7}[A-Za-z]?"                            # JLC Q3868520, Cartier B6081617
    r"|\d{5,6}[A-Za-z]{1,3}\d{1,2}"                      # 279171g17
    r"|(?:0[1-9]|[1-8]\d)-0[1-9](?=\s?(?:ti|rg|wg|pg|ntpt|tpt|carbon|cer\w*|ca|fq|rm|used|new|white|black|blk|red|blue|green|20\d\d)\b)"   # RM written without RM: 67-01 RG
    r")(?![A-Za-z0-9])", re.I)
_YEARLIKE = re.compile(r"^(?:19|20)\d{2}[-/](?:(?:19|20)\d{2}|\d{1,2})$|^(?:1[5-9]|2[0-7])[-/](?:1[5-9]|2[0-7])y?$", re.I)
_CUR = r"hk\$|hkd|hk(?=\s?\d)|usdt?|us\$|eur|euros?|€|\$|£|gbp|chf|aed|rmb|cny"
_PRICE_SIGNAL = re.compile(
    rf"(?:{_CUR})\s*[:=\-]?\s*\d[\d.,']*\s?[km]?(?![a-z])"         # €11.500  HKD 300k  AED-74,500
    rf"|\d[\d.,']*\s?[km]?\s*(?:{_CUR})(?![a-z])"                  # 11.500€  144000hkd  305k usdt
    rf"|(?<![A-Za-z0-9/])\d{{1,3}}(?:[.,]\d{{1,2}})?\s?[km](?![a-z0-9])"   # 530k  1.17m  12.8k
    rf"|(?<![A-Za-z0-9/.,])\d{{1,3}}[.,]\d{{3}}(?:[.,]\d{{3}})*(?![\d/])"   # 11.450  138,000
    rf"|(?<![A-Za-z0-9/.,\-])\d{{5,7}}(?![A-Za-z0-9/.,\-])"                 # 144000
    rf"|-\d{{4,7}}-\d{{1,2}}%"                                             # 4020t/000r-b654-474000-25%
    rf"|(?<![A-Za-z0-9/.,])\d{{4,7}}\s?-\s?\d{{1,2}}(?:\.\d)?\s?%",            # 93400-13%
    re.I,
)
_STRONG_PRICE = re.compile(
    rf"(?:{_CUR})\s*[:=]?\s*\d[\d.,']*\s?[km]?(?![a-z])|\d[\d.,']*\s?[km]?\s*(?:{_CUR})(?![a-z])|(?<![A-Za-z0-9/])\d{{1,3}}(?:[.,]\d{{1,2}})?\s?[km](?![a-z0-9])",
    re.I,
)
_NUM_IS_PRICE_AFTER = re.compile(rf"^\s?(?:[km](?![a-z])|{_CUR})", re.I)
_NUM_IS_PRICE_BEFORE = re.compile(rf"(?:{_CUR})\s*[:=]?\s*$", re.I)
_YEARISH = re.compile(r"^(?:19|20)\d{2}(?:y|yr|yrs|year|years)?$", re.I)
# tokens that look like a reference but are a price or a measure: hkd337k, 750k, 158kusdt, usdt145k, 48mm, 150pcs
_PRICE_TOKEN = re.compile(
    r"^(?:(?:hk|hkd|usdt?|eur|aed|rmb|cny)\d+(?:[.,]\d+)*(?:k|m|mil|w)?(?:hkd|hk|usdt?|usd|eur|euros?|aed|rmb|cny|u)?"      # hkd337k, usdt145k
    r"|\d+(?:[.,]\d+)*(?:k|m|mil|w)(?:hkd|hk|usdt?|usd|eur|euros?|aed|rmb|cny|u)?"                                         # 750k, 244.5k, 158kusdt
    r"|\d+(?:[.,]\d+)*(?:hkd|hk|usdt?|usd|eur|euros?|aed|rmb|cny))$", re.I)                                                 # 144000hkd
_THOUSANDS = re.compile(r"^\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{1,2})?$")
_MEASURE_TOKEN = re.compile(r"^\d{1,2}(?:mm|th|st|nd|rd|x|ct|cts|h)$|^\d{1,4}(?:pcs|pc|pieces|units?|links?|days?|hrs?|carat)$", re.I)

WTB_STRONG = (
    r"wtb|w\.t\.b|want(?:ed)?\s+to\s+buy|looking\s+(?:for|to\s+buy)|looking|lf|ltb|l\.t\.b|ntq|need\s+to\s+quote|"
    r"searching\s+for|in\s+search\s+of|iso|suche(?:n)?|gesucht|cerco|busco|recherche|收|求购|求"
)
# weak words also occur inside sale lines ("need export", "needs a polish", "sold order" as a remark):
# they only open a buy request at the start of a line that carries no price
WTB_WEAK = (r"need(?:ed|s)?|wanted|search(?:ing)?|buying|can\s+buy|co[nm]f(?:ir|ri)m(?:ed)?\s+(?:the\s+)?orders?|sold\s+orders?|(?:strong|serious)\s+call|"
            r"any\s?one\s+(?:has|have|got)|who\s+ha(?:s|ve)")
WTB_WORDS = WTB_STRONG + "|" + WTB_WEAK
WTS_STRONG = (
    r"wts|w\.t\.s|want\s+to\s+sell|for\s+sale|on\s+sales?|selling|in\s+stock|ready\s+stock|stock\s*list|hk\s+stock|new\s+stock|"
    r"price\s*list|ready\s+(?:in\s+)?(?:hk|hong\s*kong|dxb|dubai)|just\s+arrived|price\s+(?:drop|update|reduced)|出售|现货|verkaufe|vendo|vends"
)
WTS_SOFT = r"sell|available|avail|ready|incoming|offer(?:ing)?"
WTS_WORDS = WTS_STRONG + "|" + WTS_SOFT
_WTB_HDR = re.compile(rf"(?<![A-Za-z])(?:{WTB_WORDS})(?![A-Za-z])", re.I)
_WTB_STRONG_HDR = re.compile(rf"(?<![A-Za-z])(?:{WTB_STRONG})(?![A-Za-z])", re.I)
_WTB_WEAK_HDR = re.compile(rf"(?<![A-Za-z])(?:{WTB_WEAK})(?![A-Za-z])", re.I)
_WTB_ORDER_HDR = re.compile(r"(?<![A-Za-z])(?:co[nm]f(?:ir|ri)m(?:ed)?\s+(?:the\s+)?orders?|sold\s+orders?|(?:strong|serious)\s+call|who\s+ha(?:s|ve)\s*\??\s*$)(?![A-Za-z])", re.I)
_WTS_HDR = re.compile(rf"(?<![A-Za-z])(?:{WTS_WORDS})(?![A-Za-z])", re.I)
_WTS_STRONG_HDR = re.compile(rf"(?<![A-Za-z])(?:{WTS_STRONG})(?![A-Za-z])", re.I)
# "looking for USDT / payment / buyer" is a seller talking about payment, not a buy request
_FALSE_WTB = re.compile(
    r"(?:looking\s+(?:for|to\s+buy)|look\s+for|need|buy(?:ing)?|accept(?:ing)?|want(?:\s+to\s+buy)?)\s+(?:usdt|usd|cash|hkd|payment|buyers?|offers?|wire|your\s+(?:offer|best))"
    r"|needs?\s+(?:to\s+)?(?:find\s+me|contact|pm|dm|call|whatsapp|export|ship\w*|deliver\w*|servic\w*|polish\w*|overhaul\w*|more|sell|go|gone|deposit|invoice|photos?|pics?|videos?|fix\w*|repair\w*|adjust\w*|pay\w*|(?:re)?c(?:on)?fi?r?m\w*|no\b|a\s)"
    r"|need\s+(?:re)?c(?:on)?fi?r?m"
    r"|look(?:s|ing)?\s+(?:like\s+)?(?:brand\s+)?(?:new|good|great|mint|fresh|clean|nice|unworn|perfect|amazing)"
    r"|needs?\s+(?:a\s+)?[\W_]*safe\s+s(?:ale|ell)",
    re.I,
)
_STRICT_BUDGET = re.compile(r"\b(?:target|budget|max(?:imum)?|up\s+to|can\s+(?:pay|buy|confirm|take|close)|willing\s+to\s+pay)\b", re.I)
_BUDGET = re.compile(r"\b(?:target|budget|max(?:imum)?|up\s+to|can\s+(?:pay|confirm)|willing\s+to\s+pay|pay(?:ing)?|offer(?:ing)?|around|about|under|below)\b", re.I)

AD_PATTERNS = re.compile(
    r"market\s+view|whatsapp\s+shows\s+fragments|too\s+much\s+noise|too\s+little\s+signal|posts\s+get\s+lost|you\s+don.?t\s+need\s+m\S*ore\s+fragments|"
    r"your\s+next\s+buy\s+should\s+not|win\s+back\s+your\s+time|here.?s\s+why\s+your\s+market\s+feel|trusted\s+source\s+for\s+luxury|worldwide\s+sourcing|"
    r"time\s*dealer|luxury\s*social|whatsapp\s+chaos|noise\s+tax|close\s+more\s+deals|always\s+online|more\s+whatsapp\s+groups|"
    r"how\s+many\s+groups\s+do\s+you\s+check|modern\s+dealers|smart(?:er)?\s+dealers|brothers,\s+(?:stop|they|the\s+real)|market\s+(?:lens|screen|flow)|"
    r"serial\s+check\s+service|join\s+(?:the|our|my)\s+[\w ]{0,40}(?:group|channel|community)|subscribe|free\s+trial",
    re.I,
)
_FILLER = {"brand", "used", "like", "full", "only", "please", "watch", "watches", "europe", "good", "price", "prices", "offer", "offers",
           "deal", "ready", "have", "with", "card", "papers", "year", "years", "your", "best", "bild", "weggelassen", "urgent", "condition",
           "contact", "send", "thanks", "thank", "anyone", "order", "sold", "confirm", "stock", "dubai", "hong", "kong", "payment", "cash"}
_BRAND_WORD = re.compile(
    r"\b(?:rolex|patek|pp|ap|audemars|royal\s*oak|rm|richard\s*mille|cartier|omega|tudor|vacheron|vc|lange|hublot|iwc|panerai|breitling|jlc|jaeger|"
    r"fpj|journe|daytona|submariner|sub|gmt|datejust|day-?date|nautilus|aquanaut|explorer|yacht-?master|sky-?dweller|santos|speedmaster|"
    r"breguet|chopard|bvlgari|bulgari|zenith|grand\s*seiko|piaget|blancpain|ulysse|glashutte|moser|mb&f|de\s*bethune)\b", re.I)
PARTS_PATTERNS = re.compile(
    r"\b(?:watch\s+winder|travel\s+(?:case|roll|pouch)|watch\s+(?:box|roll|case)\s+only|box\s+only|card\s+only|papers?\s+only|"
    r"bezel(?:\s+insert)?\s+only|dial\s+only|bracelet\s+only|strap\s+only|buckle\s+only|clasp\s+only|links?\s+only|extra\s+links?\s+for|"
    r"spare\s+parts?|movement\s+only|crown\s+only|hands\s+only|aftermarket\s+(?:strap|bracelet)|rubber\s*b|display\s+stand|"
    r"x\s*swatch|swatch\s*x|moonswatch|royal\s*pop)\b",
    re.I,
)


_CARAT = re.compile(r"(?<![A-Za-z0-9.,])(9|10|14|18|22|24)\s?k(?:t)?(?=\s+(?:yellow|rose|white|pink|red|gold|yg|rg|wg|everose|solid)\b)", re.I)
_SIZE_M = re.compile(rf"(?<![A-Za-z0-9.,$€£])(2[4-9]|3\d|4[0-8])\s?m(?![A-Za-z0-9])(?!\s?(?:{_CUR}))", re.I)
# a discount with no price in front ("WSSA0061 N10 less 16"): still a sale offer, it goes to review
_LONE_DISCOUNT = re.compile(r"(?<![A-Za-z0-9])less\s+\d{1,2}(?:[.,]\d)?(?![\d%k])|(?<![\w.,])-\s?\d{1,2}(?:[.,]\d)?\s?%", re.I)
_DISCOUNT = re.compile(r"(?<![A-Za-z0-9/.,])\d{4,7}\s?-\s?\d{1,2}(?:\.\d)?\s?%")
_BARE_PRICE_START = re.compile(r"^\W{0,3}\d{1,3}(?:[.,]\d{3})+(?![\d/])|^\W{0,3}\d{5,7}(?![A-Za-z0-9/.,\-])")
_CUR_BEFORE = re.compile(rf"(?:{_CUR})\s*[:=]?\s*$", re.I)
_REF_SEP = re.compile(r"\s*[/,、;|&+]\s*|\s{2,}")
_REFISH = re.compile(r"(?=[A-Za-z0-9.\-]*\d{3})[A-Za-z0-9]{3,12}(?:[.\-][A-Za-z0-9]{1,6}){0,3}")


def _not_prices(line: str) -> str:
    """18K yellow gold -> 18ct, Datejust 36m -> 36mm: gold purity and case size are not prices."""
    line = _CARAT.sub(lambda m: m.group(1) + "ct", line)
    return _SIZE_M.sub(lambda m: m.group(0) if _CUR_BEFORE.search(line[:m.start()]) else m.group(1) + "mm", line)


def _ref_list(line: str) -> bool:
    """'Refs: 1057917 / 166921 / W25029B8 / 112000R' or '115.021、115.022、115.025': a list of references, not a priced line."""
    if _STRONG_PRICE.search(line):
        return False
    parts = [x for x in _REF_SEP.split(re.sub(r"^[^:：]{0,12}[:：]", "", line)) if x.strip()]
    return len(parts) >= 3 and sum(1 for x in parts if _REFISH.fullmatch(x.strip())) >= 0.8 * len(parts)


def is_advert(text: str) -> bool:
    return bool(AD_PATTERNS.search(text))


def is_part_or_accessory(line: str) -> bool:
    return bool(PARTS_PATTERNS.search(line))


def _refs(line: str):
    """Reference-like tokens of a line. Pure numbers that are written as a price (currency or k/m next to them) do not count."""
    out = []
    for m in _REF.finditer(line):
        t = m.group(0)
        if _YEARISH.match(t) or _YEARLIKE.match(t):
            continue
        if t.isdigit():
            if len(t) < 4 or len(t) >= 7 or _NUM_IS_PRICE_AFTER.match(line[m.end():m.end() + 6]) or _NUM_IS_PRICE_BEFORE.search(line[max(0, m.start() - 8):m.start()]):
                continue
            if re.match(r"[.,]\d{3}(?!\d)", line[m.end():m.end() + 5]) or re.search(r"\d[.,]$", line[max(0, m.start() - 2):m.start()]):
                continue                                           # part of 205,000 / 1.265.000
        elif re.fullmatch(r"[nNwW]\d{3,4}", t) or _PRICE_TOKEN.match(t) or _MEASURE_TOKEN.match(t):
            continue
        elif _THOUSANDS.match(t):
            # 1.942.500 / 138.000 are prices. Only "425.050" style (A. Lange) can be a reference: 3+3 digits with a dot,
            # no currency next to it and no reference before it on the line
            lange = re.fullmatch(r"\d{3}\.\d{3}", t) and not out
            if not lange or _NUM_IS_PRICE_AFTER.match(line[m.end():m.end() + 6]) or _NUM_IS_PRICE_BEFORE.search(line[max(0, m.start() - 8):m.start()]):
                continue
        out.append(m)
    return out


def _priced_ref_line(line: str) -> bool:
    refs = _refs(line)
    if not refs:
        return False
    # dealers write the reference first: a later plain number of 5+ digits is the price ("124208 blk  09/2026  286000")
    refs = [refs[0]] + [m for m in refs[1:] if not (m.group(0).isdigit() and len(m.group(0)) >= 5)]
    rest = line
    for m in reversed(refs):
        rest = rest[:m.start()] + " " + rest[m.end():]
    return bool(_PRICE_SIGNAL.search(rest))


def _wtb_header(line: str):
    """Does this line open a buy request?
    strong word (wtb, looking for, ntq ...): anywhere on a line without a price; on a priced line only BEFORE the reference
                                             ("WTB 126518 tiffany target 80k" yes, "5231G new HKD798k (looking for export)" no)
    weak word (need, sold order, buying ...): only before the reference and only on a line without a price"""
    if _FALSE_WTB.search(line):
        return None
    refs = _refs(line)
    before = re.sub(r"^[^A-Za-z0-9\u4e00-\u9fff]+", "", line[:refs[0].start()] if refs else line)[:60]
    if not refs and _STRONG_PRICE.search(line) and not _STRICT_BUDGET.search(line) and not _WTB_STRONG_HDR.match(before):
        return None                                               # "$890k USD need safe sale": a price line of a sale post
    priced = _priced_ref_line(line)
    m = _WTB_STRONG_HDR.search(before) or (None if priced else _WTB_STRONG_HDR.search(line[:80]))
    if m:
        return m
    if not priced:
        order = _WTB_ORDER_HDR.search(line[:80])                  # "RM30-01, confirm the order, 2026 new is required"
        if order:
            return order
    weak = _WTB_WEAK_HDR.search(before[:24])                      # at the start of the line: "Need patek 3900", not "... if you need other models"
    if weak and (not priced or _STRICT_BUDGET.search(line)):      # "SOLD ORDER ... 127234 ... can buy AED 63,000"
        return weak
    if priced:
        # One request in one line: a request word, exactly one watch and at most one price - the price is
        # the target ("5164R wtb 1.08m", "Sold order!! 15510ST blue 2026 new, pay 500k hkd",
        # "126710GRNR jub wanted, EU stock, 2026, unworn, 18.900€"; test chats 25 Nov 2026).
        word = _WTB_HDR.search(line)
        if word and len({m.group(0).lower() for m in refs}) == 1 and len(_STRONG_PRICE.findall(line)) <= 1:
            return word
    return None


def _has_ref(line: str) -> bool:
    return bool(_refs(line))


_HAVE_SPLIT = re.compile(r"[,;]\s*(?:i\s+|we\s+)?(?:have|got|selling|can\s+offer)\s+(?=\S*\d)", re.I)


def split_sections(message: str) -> List[Tuple[str, str]]:
    """Split a message into [(mode, text)] with mode in {"WTS", "WTB"}.
    Rules:
      * a header line (or a line starting with a WTB/WTS word) opens a section of that type
      * lines before any header: WTS if the message carries prices, otherwise undecided
      * a WTB section that consists of priced reference lines only, in a message that never says
        wtb / want to buy / ntq explicitly, is a seller's list with a decorative header -> WTS
    Returns [] for adverts, system messages and chatter.
    """
    text = "\n".join(_not_prices(l) for l in clean(message).split("\n"))
    lines = []
    offers: set = set()  # indexes of lines split off as an offer: always their own WTS section
    for l in (x.strip() for x in text.split("\n")):
        if not l:
            continue
        # "Looking for 126508 green 2026, have 126508 white N10 620k hkd": a request and an offer in one line
        m = _HAVE_SPLIT.search(l)
        if m and _wtb_header(l[:m.start()]) and _priced_ref_line(l[m.end():]):
            lines.append(l[:m.start()].strip())
            offers.add(len(lines))
            lines.append(l[m.end():].strip())
        else:
            lines.append(l)
    if is_advert(text):
        # an advert never carries priced reference lines; a real list with a promo line keeps its watch lines
        lines = [l for l in lines if not is_advert(l)]
        offers = set()
        if not (any(_has_ref(l) for l in lines) and any(_STRONG_PRICE.search(l) for l in lines)):
            return []
    if not lines:
        return []
    sections: List[List] = []
    cur_mode: Optional[str] = None
    cur: List[str] = []
    for i_line, l in enumerate(lines):
        if i_line in offers:
            if cur:
                sections.append([cur_mode, cur])
            sections.append(["WTS", [l]])
            cur_mode, cur = None, []
            continue
        head = re.sub(r"^[^A-Za-z0-9一-鿿]+", "", l)[:40]
        wtb = _wtb_header(l)
        wts = _WTS_HDR.search(head)
        new_mode = None
        if wtb and (not wts or wtb.start() <= wts.start() or not _WTS_STRONG_HDR.search(head)):
            new_mode = "WTB"
        elif wts:
            new_mode = "WTS"
        if new_mode and new_mode != cur_mode:
            if cur_mode is None and cur:
                # lines before the first keyword belong to the same post ("5968r-001 / New 2026 / 157,000$ ready in Dubai"),
                # unless they are a priced list of their own and the keyword now opens a buy request
                if new_mode == "WTS" or not any(_priced_ref_line(x) for x in cur):
                    cur_mode = new_mode
                    cur.append(l)
                    continue
            if cur_mode == "WTB" and new_mode == "WTS" and not _WTS_STRONG_HDR.search(head):
                cur.append(l)            # "payment ready", "best offer" inside a buy request do not start a sale section
                continue
            if cur_mode and cur and not _has_ref(l) and not _STRONG_PRICE.search(l) and any(_has_ref(x) for x in cur):
                cur.append(l)            # closing line of a list: "All new 2026 full set, HK stock" belongs to the list above
                continue
            if cur:
                sections.append([cur_mode, cur])
            cur_mode, cur = new_mode, [l]
        else:
            cur.append(l)
    if cur:
        sections.append([cur_mode, cur])

    explicit_wtb = bool(re.search(r"(?<![A-Za-z])(?:wtb|w\.t\.b|want(?:ed)?\s+to\s+buy|ntq|ltb|求购|收)(?![A-Za-z])", text, re.I))
    # priced watch lines inside a WTB section are the seller's own stock unless they are worded as a budget
    resplit = []
    for mode, ls in sections:
        if mode == "WTB":
            hdr_budget = bool(_STRICT_BUDGET.search(ls[0]))
            # "Confirm order / 126334 Wim jub / W9-W11 / $116000 HKD can take": a request for ONE watch with ONE price - the price is the target
            one_watch = len({m.group(0).lower() for l in ls for m in _refs(l)}) == 1
            price_lines = [l for l in ls if _STRONG_PRICE.search(l) or _DISCOUNT.search(l)]
            if one_watch and len(price_lines) <= 1 and any(_WTB_ORDER_HDR.search(l) or _WTB_STRONG_HDR.search(l) for l in ls[:2]):
                hdr_budget = True
            # a priced watch line below a "looking for" header is the dealer's own stock,
            # unless the line itself is worded as a request or a budget ("WTB 126518 target 80k")
            sale = [l for l in ls[1:] if _priced_ref_line(l) and not _STRICT_BUDGET.search(l) and not _wtb_header(l) and not _ref_list(l)]
            # stock written over two or three lines: "124200 Beige N11" / "$59K"   or   "5980/1400G White Gold" / "Brand New, Full Set, 2022" / "550,000 USDT"
            for i in range(1, len(ls) - 1):
                a = ls[i]
                if not _has_ref(a) or _priced_ref_line(a) or _wtb_header(a) or _ref_list(a):
                    continue
                block = [a]
                for b in ls[i + 1:i + 3]:
                    if _has_ref(b) or _wtb_header(b) or _BUDGET.search(b):
                        break
                    block.append(b)
                    if _STRONG_PRICE.search(b) or _BARE_PRICE_START.match(b):
                        sale += [x for x in block if x not in sale]
                        break
            # several price lines without a budget word under a request: stock items written by model name ("New 65-01 McLaren N11 HKD:3300000")
            if len(price_lines) >= 2:
                sale += [l for l in ls[1:] if l in price_lines and l not in sale and not _BUDGET.search(l) and not _wtb_header(l)]
            # a line between stock lines is stock too ("126710BLNR jub W11 N141000": the dealer mistyped the $)
            if sale:
                pos = {i for i, l in enumerate(ls) if l in sale}
                for i, l in enumerate(ls):
                    if i and i not in pos and not _wtb_header(l) and not _BUDGET.search(l) and (pos & {i - 1, i - 2}) and (pos & {i + 1, i + 2}):
                        sale.append(l)
            if sale and not hdr_budget:
                keep = [l for l in ls if l not in sale]
                if any(_has_ref(l) for l in keep):
                    resplit.append(["WTB", keep])
                resplit.append(["WTS", sale])
                continue
        resplit.append([mode, ls])
    sections = resplit

    out = []
    for mode, ls in sections:
        ref_lines = [l for l in ls if _has_ref(l)]
        priced = [l for l in ref_lines if _priced_ref_line(l)]
        if mode is None:
            # no header: a sale offer needs a price; model-name-only posts ("F.P.Journe Elegante 40mm / 1.6m hkd") count too
            if (priced or (ref_lines and any(_PRICE_SIGNAL.search(l) or _LONE_DISCOUNT.search(l) for l in ls))
                    or any(_STRONG_PRICE.search(l) for l in ls)):
                mode = "WTS"
            else:
                continue
        elif mode == "WTB" and not explicit_wtb and len([l for l in priced if not _ref_list(l)]) >= 5 and len(priced) >= 0.8 * max(1, len(ref_lines)):
            mode = "WTS"
        if mode == "WTS" and not (priced or any(_PRICE_SIGNAL.search(l) for l in ls)):
            if not ref_lines:
                continue
        if mode == "WTB" and not ref_lines:
            # a request without any reference ("Looking for Gerald Genta Mickey Mouse 36mm") must be short and say what is wanted
            body = _WTB_HDR.sub(" ", " ".join(ls))
            words = [w for w in re.findall(r"[A-Za-z]{4,}", body) if w.lower() not in _FILLER]
            if len(" ".join(ls)) > 300 or not words:
                continue
        out.append((mode, "\n".join(ls)))
    # merge neighbours of the same mode
    merged: List[Tuple[str, str]] = []
    for mode, t in out:
        if merged and merged[-1][0] == mode:
            merged[-1] = (mode, merged[-1][1] + "\n" + t)
        else:
            merged.append((mode, t))
    return merged


def post_type(message: str) -> Optional[str]:
    """'WTS' | 'WTB' | 'MIXED' | None  (drop-in summary of split_sections)."""
    modes = {m for m, _ in split_sections(message)}
    if not modes:
        return None
    return "MIXED" if len(modes) > 1 else modes.pop()
