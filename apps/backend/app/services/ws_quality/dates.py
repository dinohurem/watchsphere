"""Year and month of a dealer line (rules of Kenan's full check, section 4).

* A written year always wins. An N-month / W-month gives only the month (and the year only when no
  year is written).
* Year and month are found glued to words or to each other: 2013used, 2021New, 2023fullset, 50TH2022,
  2025N12, Di25y, 12/25y, 06/23y, 2022yaer, 2021yr, "22Y 50TH".
* Month notations: 2026-9, 2026/09, Nov-2026, Nov2026, 11/2026, 11.2026, /N11/, N10/26, 10N.
  "11/2020" is month 11 of 2020, not of this year.

Pure functions, no imports from the generator. The caller masks prices first.
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Optional

_MONTHS = {
    "jan": 1, "feb": 2, "mar": 3, "apr": 4, "may": 5, "jun": 6, "jul": 7, "aug": 8, "sep": 9, "sept": 9,
    "oct": 10, "nov": 11, "dec": 12,
}
_MONTH_NAME = r"(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)"

_YEAR4 = r"20[0-2]\d"
_YSUF = r"(?:y|yr|yrs|year|years|yaer)?"

# N-month with a year: n12/22y, N9/26, n5/2026, w10/2026, N10-26
_N_YEAR_RE = re.compile(r"(?<![a-z0-9])([nw])\s?(0?[1-9]|1[0-2])\s?[/.\-]\s?(" + _YEAR4 + r"|\d{2})(?!\d)")
# year glued in front of the N-month: 2025N12, 2025 n12
_YEAR_N_RE = re.compile(r"(?<![0-9])(" + _YEAR4 + r")\s?([nw])\s?(0?[1-9]|1[0-2])(?![0-9])")
# 10N, 10n (month before the N); N10 / /N11/ (N before the month)
_MONTH_N_RE = re.compile(r"(?<![a-z0-9/.\-])(0?[1-9]|1[0-2])([nw])(?![a-z0-9])")
_N_ONLY_RE = re.compile(r"(?<![a-z0-9])([nw])(0?[1-9]|1[0-2])(?![0-9])")
# 2026-9, 2026/09 (year first)
_YEAR_FIRST_RE = re.compile(r"(?<![0-9a-z/.\-])(" + _YEAR4 + r")[/\-](0?[1-9]|1[0-2])(?![0-9]|\s?(?:links?|%|pcs|x\b))")
# Nov-2026, Nov2026, November 26
_MONTH_NAME_RE = re.compile(r"(?<![a-z])(" + _MONTH_NAME + r")[\s.\-/]*(" + _YEAR4 + r"|\d{2})(?![0-9])")
# 11/2026, 11.2026, 11-2026 (4-digit year)
_MM_YYYY_RE = re.compile(r"(?<![0-9a-z/.\-])(0?[1-9]|1[0-2])\s?[/.\-]\s?(" + _YEAR4 + r")(?![0-9])")
# 12/25y, 06/23y, 09/25 (2-digit year; "y" suffix makes it certain)
_MM_YY_RE = re.compile(r"(?<![0-9a-z/.\-])(0?[1-9]|1[0-2])\s?/\s?(\d{2})(?:y|yr|year|new|nos|used|fs|fullset)?(?![0-9a-z])")
# 09-26, 07-26 (hyphen: only a plausible card year, so that "5-10" or "12-14" stay what they are)
_MM_YY_DASH_RE = re.compile(r"(?<![0-9a-z/.\-])(0?[1-9]|1[0-2])-(2[2-7])(?:y|yr|year|new|nos|used|fs)?(?![0-9a-z\-])")
# written years: 2013used, 2021New, 50TH2022, 2022yaer, 2021yr, 2026Y
_YEAR4_RE = re.compile(r"(?<![0-9])(" + _YEAR4 + r")(?![0-9])")
# 22Y, 25y, Di25y, 21yr; the digits must not belong to a longer number or a date
_YEAR2_Y_RE = re.compile(r"(?<![0-9/.\-])(\d{2})\s?(?:y|yr|yrs|yaer|year)(?![a-z])")


@dataclass
class DateRead:
    year: Optional[int] = None
    month: Optional[int] = None
    kind: Optional[str] = None      # "n" (N-month), "w" (W-month, wood card) or "d" (plain date)
    year_written: bool = False      # the year stands in the line (not inferred from the N-month)

    @property
    def n_month(self) -> bool:
        return self.kind == "n"

    @property
    def has_month(self) -> bool:
        """A W-month (wood card) is not a card month for the condition rules."""
        return self.month is not None and self.kind != "w"


def _yr(raw: str) -> int:
    y = int(raw)
    return y if y > 99 else 2000 + y


def _written_year(low: str) -> Optional[int]:
    m = _YEAR4_RE.search(low)
    if m:
        return int(m.group(1))
    for m in _YEAR2_Y_RE.finditer(low):
        yy = int(m.group(1))
        if 10 <= yy <= 35:
            return 2000 + yy
    return None


def read_date(text: str, ref_month: int = 12, ref_year: int = 2099) -> DateRead:
    """Year and month of a line (prices already masked by the caller)."""
    low = (text or "").lower()
    month: Optional[int] = None
    kind: Optional[str] = None
    comp_year: Optional[int] = None

    def take(m_month: int, k: str, year: Optional[int] = None):
        nonlocal month, kind, comp_year
        month, kind, comp_year = m_month, k, year

    for rx, build in (
        (_N_YEAR_RE, lambda m: (int(m.group(2)), m.group(1), _yr(m.group(3)))),
        (_YEAR_N_RE, lambda m: (int(m.group(3)), m.group(2), int(m.group(1)))),
        (_YEAR_FIRST_RE, lambda m: (int(m.group(2)), "d", int(m.group(1)))),
        (_MONTH_NAME_RE, lambda m: (_MONTHS[m.group(1)[:4] if m.group(1).startswith("sept") else m.group(1)[:3]], "d",
                                    _yr(m.group(2)))),
        (_MM_YYYY_RE, lambda m: (int(m.group(1)), "d", int(m.group(2)))),
        (_MM_YY_RE, lambda m: (int(m.group(1)), "d", _yr(m.group(2)))),
        (_MM_YY_DASH_RE, lambda m: (int(m.group(1)), "d", _yr(m.group(2)))),
        (_MONTH_N_RE, lambda m: (int(m.group(1)), m.group(2), None)),
        (_N_ONLY_RE, lambda m: (int(m.group(2)), m.group(1), None)),
    ):
        m = rx.search(low)
        if m:
            mo, k, yr = build(m)
            take(mo, "n" if k == "n" else ("w" if k == "w" else "d"), yr)
            break

    written = _written_year(low)
    year = written if written is not None else comp_year
    year_written = year is not None
    if year is None and month is not None:
        year = ref_year if month <= ref_month else ref_year - 1
    return DateRead(year=year, month=month, kind=kind, year_written=year_written)


def format_month_year(d: DateRead, ref_month: int, ref_year: int, suffix: str = "") -> str:
    """'MM/YY' when there is a month, 'YYYY' when only a year; never a date in the future."""
    if d.year is None:
        return ""
    if d.year > ref_year:
        return ""
    if d.month is not None and 1990 <= d.year <= 2099 and (d.year, d.month) <= (ref_year, ref_month):
        return f"{d.month:02d}/{d.year % 100:02d}{suffix}"
    if d.year_written:
        return f"{d.year}{suffix}"
    return ""
