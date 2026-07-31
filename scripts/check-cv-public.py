"""Check that the public copy of the CV carries no home contact details.

Run from the repo root after refreshing public/docs/Farb_CV_2026.pdf:

    cp "I:/My Drive/Professional/CV/Farb_CV_2026.pdf" public/docs/Farb_CV_2026.pdf
    python scripts/check-cv-public.py

The CV was cleaned at the source on 2026-07-31 — the home address and home
phone that page 1 used to carry are gone from Norm's own file, so nothing needs
stripping here. This script exists because that is a property of the current
file, not a guarantee about future ones: the CV is maintained in Word from a
template that once had those fields, and the published PDF is search-indexable.
Exits non-zero if they come back.

Requires: pip install pymupdf
"""
import os
import re
import sys

import pymupdf

PDF = "public/docs/Farb_CV_2026.pdf"

# Literal strings from the pre-2026-07-31 version of the CV.
FORBIDDEN = [
    "Home Address",
    "Home Phone",
    "293 Markham",
    "Markham Street",
    "M6J 2G7",
    "(647) 235-6281",
]
# Contact details that SHOULD be public — their absence means the wrong file
# (or a truncated one) got copied in.
REQUIRED = [
    "Institute Address",
    "University of Toronto Mississauga",
    "(905) 828-3959",
    "norman.farb@utoronto.ca",
    "www.radlab.zone",
]
OFFICE_PHONE = "(905) 828-3959"
CAMPUS_POSTAL = "L5L 1C6"

if not os.path.exists(PDF):
    sys.exit(f"missing {PDF}")

doc = pymupdf.open(PDF)
text = "\n".join(page.get_text() for page in doc)
pages = len(doc)
doc.close()

problems = []

found = [s for s in FORBIDDEN if s.lower() in text.lower()]
if found:
    problems.append(f"home contact details present: {found}")

missing = [s for s in REQUIRED if s not in text]
if missing:
    problems.append(f"expected work contact details missing: {missing}")

# Any postal code other than the campus one, or any phone number other than the
# office line, is a detail this file did not previously contain — worth a look
# before it goes live rather than a silent pass.
postals = {p for p in re.findall(r"\b[A-Z]\d[A-Z] ?\d[A-Z]\d\b", text) if p != CAMPUS_POSTAL}
if postals:
    problems.append(f"unexpected postal code(s): {sorted(postals)}")

phones = {p for p in re.findall(r"\(\d{3}\) ?\d{3}-\d{4}", text) if p != OFFICE_PHONE}
if phones:
    problems.append(f"unexpected phone number(s): {sorted(phones)}")

print(f"{PDF}: {pages} pages, {os.path.getsize(PDF)} bytes")
if problems:
    for p in problems:
        print(f"  FAIL: {p}")
    sys.exit(1)
print("  OK: no home contact details; work contact details intact")
