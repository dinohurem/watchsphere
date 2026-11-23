"""Text normalisation that has to run BEFORE any matching."""
import re
import unicodedata

# Zero-width / invisible characters that dealers' bots insert into references and keywords
# ("520|7G", "us|dt", "1.1|M HKD" with | = an invisible character). The current server list misses
# U+180E (Mongolian vowel separator - by far the most frequent one), U+034F, U+00AD, U+061C and the Hangul fillers.
_INVISIBLE_CODEPOINTS = (
    list(range(0x200B, 0x2010))      # zero width space/joiners, LRM, RLM
    + list(range(0x202A, 0x202F))    # bidi embeddings
    + list(range(0x2060, 0x2065))    # word joiner, invisible operators
    + list(range(0x2066, 0x206A))    # bidi isolates
    + [0xFEFF, 0x180E, 0x034F, 0x00AD, 0x061C, 0x115F, 0x1160, 0x17B4, 0x17B5, 0x3164, 0xFFA0, 0xFE0E, 0xFE0F]
)
INVISIBLE_RE = re.compile("[" + "".join(chr(c) for c in _INVISIBLE_CODEPOINTS) + "]")
_SPACES = {c: " " for c in (0x00A0, 0x202F, 0x2009, 0x2007, 0x2002, 0x2003, 0x3000)}
# hyphen look-alikes incl. U+2011 NON-BREAKING HYPHEN ("4300V/220G-H151" is often written with it)
_HYPHENS = re.compile("[" + "".join(chr(c) for c in (0x2010, 0x2011, 0x2012, 0x2013, 0x2014, 0x2212)) + "]")
_APOS = "'`" + "".join(chr(c) for c in (0x2019, 0x2018, 0x00B4))


def strip_invisible(text: str) -> str:
    return INVISIBLE_RE.sub("", text.translate(_SPACES))


def normalize_line(line: str) -> str:
    """Invisible characters out, full-width forms to ASCII, typographic variants unified."""
    s = strip_invisible(line)
    # full-width letters / digits / punctuation -> ASCII; emoji and CJK stay untouched
    s = "".join(unicodedata.normalize("NFKC", ch) if 0xFF00 <= ord(ch) <= 0xFFEF else ch for ch in s)
    return _HYPHENS.sub("-", s)


def normalize_numbers(line: str) -> str:
    """Make price notations uniform without changing their value:
    1'480'000 -> 1480000 | 1 480 000 -> 1480000 | 11.300,- -> 11.300 | 74,500/- -> 74,500 | 1.08mil -> 1.08m"""
    s = line
    s = re.sub(rf"(?<=\d)[{_APOS}](?=\d{{3}}(?!\d))", "", s)
    s = re.sub(r"(?<![\d.,/])(\d{1,3})((?: \d{3}){2,})(?![\d.,])", lambda m: m.group(1) + m.group(2).replace(" ", ""), s)
    s = re.sub(r"(?<=\d)[,.]\s?-{1,2}(?![\d%])", "", s)          # "11.300,-"  "9.500.-"
    s = re.sub(r"(?<=\d)/-(?![\d%])", "", s)                      # "74,500/-"
    s = re.sub(r"(?<=\d)\s?(?:mio|mill?(?:ion)?s?)\b", "m", s, flags=re.I)
    return s


def clean(line: str) -> str:
    return normalize_numbers(normalize_line(line))
