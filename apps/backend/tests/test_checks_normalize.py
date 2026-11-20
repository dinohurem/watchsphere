"""Normalisation rules of the Checks feature (spec 2.5)."""
import pytest

from app.services.checks_normalize import (
    build_e164,
    normalize_country_code,
    normalize_reference,
    normalize_serial,
    validate_e164,
)


@pytest.mark.parametrize("raw,expected", [
    ("3y0r 9842", "3Y0R9842"),
    ("3Y0R9842", "3Y0R9842"),
    ("3Y0R-9842", "3Y0R9842"),
    ("3Y0R.9842", "3Y0R9842"),
    ("  3y0r  9842 ", "3Y0R9842"),
    ("No. 8V7K2310", "8V7K2310"),
    ("NO 8V7K2310", "8V7K2310"),
    ("no.8v7k2310", "8V7K2310"),
    ("Case 605", "605"),
    ("CASE NO. 605", "605"),
    ("S/N 8V7K2310", "8V7K2310"),
    ("s/n: 8v7k2310", "8V7K2310"),
    ("SN 8V7K2310", "8V7K2310"),
    ("#8V7K2310", "8V7K2310"),
    ("# 8V7K 2310", "8V7K2310"),
    ("605", "605"),
    ("", ""),
    (None, ""),
    ("SN", "SN"),  # nothing follows the prefix, keep it
])
def test_normalize_serial(raw, expected):
    assert normalize_serial(raw) == expected


def test_serial_match_is_exact_not_substring():
    assert normalize_serial("605") != normalize_serial("6051")
    assert normalize_serial("8V7K2310") != normalize_serial("8V7K23")
    assert normalize_serial("3Y0R9842") == normalize_serial("3y0r 9842")


def test_richard_mille_605_with_prefixes():
    assert normalize_serial("No. 605") == "605"
    assert normalize_serial("605") == normalize_serial("S/N 605") == normalize_serial("#605")


@pytest.mark.parametrize("raw,expected", [
    ("116500LN", "116500LN"),
    ("116500 ln", "116500LN"),
    ("Ref. 116500LN", "116500LN"),
    ("REF 116500LN", "116500LN"),
    ("ref.116500ln", "116500LN"),
    ("5711/1A-010", "5711/1A010"),
    ("RM 011", "RM011"),
    ("126334", "126334"),
    (None, ""),
])
def test_normalize_reference(raw, expected):
    assert normalize_reference(raw) == expected


@pytest.mark.parametrize("cc,number,expected", [
    ("+852", "6123 4567", "+85261234567"),
    ("852", "6123-4567", "+85261234567"),
    ("+852", "(6123) 4567", "+85261234567"),
    ("+852", "06123 4567", "+85261234567"),
    ("+852", "0085261234567", "+85261234567"),
    ("+852", "+852 6123 4567", "+85261234567"),
    ("+41", "079 123 45 67", "+41791234567"),
    ("+852", "", None),
    ("", "6123 4567", None),
    ("+852", "1" * 20, None),
])
def test_build_e164(cc, number, expected):
    assert build_e164(cc, number) == expected


def test_validate_e164():
    assert validate_e164("+85261234567")
    assert validate_e164("+41791234567")
    assert not validate_e164("+852123")
    assert not validate_e164("+85200000000")
    assert not validate_e164(None)


def test_normalize_country_code():
    assert normalize_country_code("852") == "+852"
    assert normalize_country_code("+852 ") == "+852"
    assert normalize_country_code("00852") == "+852"
    assert normalize_country_code("") is None
