#!/usr/bin/env python3
"""Summarise DMARC aggregate reports.

Receivers send one XML report per day per domain, zipped or gzipped, to the
address in the `rua=` tag of the DMARC record. They answer the question you
need before tightening a DMARC policy: which sources are sending as this
domain, and does each one authenticate and align?

    python scripts/parse-dmarc-report.py report.zip
    python scripts/parse-dmarc-report.py ~/Downloads/*.zip      # a term's worth

Reads .zip, .gz, or bare .xml. Stdlib only -- no install step, because the
person who needs this is usually mid-incident.

Reading the output: `disposition` is what the receiver DID (none / quarantine
/ reject), while dkim and spf are what it FOUND. Under p=none disposition is
always `none`, so a failing row shows you what *would* happen under a stricter
policy -- which is the whole point of running p=none first.
"""

import gzip
import io
import socket
import sys
import zipfile
import datetime
import xml.etree.ElementTree as ET
from pathlib import Path

_ptr_cache = {}


def ptr(ip):
    """Reverse-DNS, best effort. The hostname is usually what identifies a
    source: 'a9-3.smtp-out.amazonses.com' says Resend far more clearly than
    54.240.9.3 does."""
    if ip not in _ptr_cache:
        try:
            _ptr_cache[ip] = socket.gethostbyaddr(ip)[0]
        except Exception:
            _ptr_cache[ip] = '(no reverse DNS)'
    return _ptr_cache[ip]


def xml_documents(path):
    """Yield XML bytes from a .zip, .gz or .xml path."""
    p = Path(path)
    data = p.read_bytes()
    if data[:2] == b'PK':
        with zipfile.ZipFile(io.BytesIO(data)) as z:
            for name in z.namelist():
                if name.lower().endswith('.xml'):
                    yield name, z.read(name)
    elif data[:2] == b'\x1f\x8b':
        yield p.name, gzip.decompress(data)
    else:
        yield p.name, data


def ts(value):
    return datetime.datetime.fromtimestamp(
        int(value), datetime.timezone.utc).strftime('%Y-%m-%d %H:%M UTC')


def summarise(name, raw):
    root = ET.fromstring(raw)
    meta = root.find('report_metadata')
    pol = root.find('policy_published')
    org = meta.findtext('org_name')
    begin = meta.find('date_range/begin').text
    end = meta.find('date_range/end').text

    print(f"\n{'=' * 78}\n{name}")
    print(f"  reporter : {org}")
    print(f"  window   : {ts(begin)}  ->  {ts(end)}")
    if pol is not None:
        bits = ' '.join(f"{c.tag}={c.text}" for c in pol)
        print(f"  policy   : {bits}")
    print()

    total = 0
    failing = []
    for rec in root.findall('record'):
        row = rec.find('row')
        ev = row.find('policy_evaluated')
        ids = rec.find('identifiers')
        auth = rec.find('auth_results')

        ip = row.findtext('source_ip') or row.findtext('source_ipv6') or '?'
        count = int(row.findtext('count') or 0)
        total += count
        dkim = ev.findtext('dkim') or '?'
        spf = ev.findtext('spf') or '?'
        disp = ev.findtext('disposition') or '?'
        hfrom = ids.findtext('header_from') or '?'

        ok = (dkim == 'pass' or spf == 'pass')
        mark = 'PASS' if ok else 'FAIL'
        print(f"  [{mark}] {ip:<18} {ptr(ip)}")
        print(f"         from={hfrom}  messages={count}  disposition={disp}  dkim={dkim}  spf={spf}")

        dkim_sigs = []
        for d in auth.findall('dkim'):
            dkim_sigs.append((d.findtext('domain'), d.findtext('selector'), d.findtext('result')))
            print(f"         dkim sig: d={d.findtext('domain')} s={d.findtext('selector')} -> {d.findtext('result')}")
        spf_rows = []
        for s in auth.findall('spf'):
            spf_rows.append((s.findtext('domain'), s.findtext('result')))
            print(f"         spf     : {s.findtext('domain')} -> {s.findtext('result')}")

        if not ok:
            failing.append((ip, hfrom, count, dkim_sigs, spf_rows))
            # A DKIM signature that claims your domain and FAILED is the
            # fingerprint of a forward, not a forgery: a forger has no way to
            # produce a signature naming your domain at all, whereas a relay
            # that appends a footer or rewrites a subject invalidates a real
            # one. Paired with an SPF softfail (the relay's IP is legitimately
            # not in your record) it is the classic mailing-list / auto-forward
            # pattern. A guess, but a well-supported one -- confirm by asking
            # whoever runs that host, or by checking whether it recurs.
            forwarded = any(dom and dom in hfrom and res == 'fail' for dom, _, res in dkim_sigs)
            softfail = any(res == 'softfail' for _, res in spf_rows)
            if forwarded and softfail:
                print("         ^ looks like a FORWARD (broken signature naming your own domain,")
                print("           plus an SPF softfail from a relay). Usually benign -- but it is")
                print("           what a stricter policy would start quarantining.")
            elif not dkim_sigs:
                print("         ^ no DKIM signature at all. Could be a forge, or a sender of")
                print("           yours that was never set up. Identify it before tightening.")
        print()

    print(f"  {total} message(s), {len(failing)} failing source(s)")
    return total, failing


def main(argv):
    paths = argv[1:]
    if not paths:
        print(__doc__)
        return 2

    grand, all_failing = 0, []
    for arg in paths:
        for path in sorted(Path().glob(arg)) if any(c in arg for c in '*?') else [Path(arg)]:
            if not path.exists():
                print(f"skipping {path}: not found")
                continue
            for name, raw in xml_documents(path):
                total, failing = summarise(name, raw)
                grand += total
                all_failing.extend(failing)

    print(f"\n{'=' * 78}")
    print(f"TOTAL: {grand} message(s) across all reports, {len(all_failing)} failing source(s)")
    if all_failing:
        print("\nFailing sources -- resolve or explain each of these before moving DMARC")
        print("off p=none, since under p=quarantine their mail starts landing in spam:")
        for ip, hfrom, count, _, _ in all_failing:
            print(f"  {ip:<18} {ptr(ip):<40} from={hfrom} x{count}")
    else:
        print("\nEvery source authenticated and aligned.")
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv))
