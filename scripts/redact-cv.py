"""Strip home address / home phone from the public copy of the CV.

Run from the repo root whenever the CV is refreshed:

    cp "I:/My Drive/Professional/CV/Farb_CV_2026.pdf" public/docs/Farb_CV_2026.pdf
    python scripts/redact-cv.py

It verifies its own output and exits non-zero (leaving the file untouched)
rather than publishing something it could not confirm was clean.

Operates only on public/docs/Farb_CV_2026.pdf; the source on the I: drive is
never touched. Uses real redaction (apply_redactions removes the glyphs) rather
than drawing a box over the text, which would leave it selectable.

Scoped to the page-1 PERSONAL contact block (y < 210). "Toronto, Ontario" also
occurs on page 2 in the Employment section, where it must be preserved.
"""
import sys
import pymupdf

SRC = "public/docs/Farb_CV_2026.pdf"
TMP = "public/docs/_redacted.tmp.pdf"

TARGETS = [
    "Home Address:",
    "293 Markham Street",
    "Toronto, Ontario",
    "Canada M6J 2G7",
    "Home Phone:",
    "(647) 235-6281",
]
Y_LIMIT = 210  # bottom of the home-address block on page 1

doc = pymupdf.open(SRC)
page = doc[0]

hits = 0
for needle in TARGETS:
    for rect in page.search_for(needle):
        if rect.y1 > Y_LIMIT:
            print(f"  skip (outside contact block): {needle!r} y={round(rect.y1)}")
            continue
        page.add_redact_annot(rect)  # no fill: glyphs removed, nothing drawn
        hits += 1
        print(f"  redact {needle!r} at {tuple(round(v) for v in rect)}")
page.apply_redactions(images=pymupdf.PDF_REDACT_IMAGE_NONE)
print(f"redacted {hits} instance(s) on page 1")

doc.save(TMP, garbage=4, deflate=True)
doc.close()

# --- verify the saved output ---
check = pymupdf.open(TMP)
p1 = check[0].get_text()
rest = "\n".join(p.get_text() for p in list(check)[1:])

leaks = [t for t in TARGETS if t in p1]
kept_p1 = ["3359 Mississauga Road", "(905) 828-3959", "norman.farb@utoronto.ca",
           "www.radlab.zone", "Institute Address:", "Norman A. S. Farb"]
missing = [k for k in kept_p1 if k not in p1]
# employment entries on later pages must survive untouched
emp = rest.count("Toronto, Ontario")

print(f"pages: {len(check)}")
print(f"leaked on page 1: {leaks or 'none'}")
print(f"expected-to-keep missing from page 1: {missing or 'none'}")
print(f"'Toronto, Ontario' still on later pages: {emp} (expected 3)")
check.close()

if leaks or missing or emp != 3:
    sys.exit(1)

import os
os.replace(TMP, SRC)
print(f"OK -> {SRC} ({os.path.getsize(SRC)} bytes)")
