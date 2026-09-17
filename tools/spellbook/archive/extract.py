import pymupdf, glob, re, json
ZW = dict.fromkeys(map(ord, '\u200b\ufeff'), None)
def lines_of(page):
    rows = {}
    for b in page.get_text('dict')['blocks']:
        for l in b.get('lines', []):
            txt = ''.join(s['text'] for s in l['spans']).translate(ZW)
            if not txt.strip(): continue
            y = round(l['bbox'][1])
            bold = all((s['flags'] & 16) for s in l['spans'] if s['text'].translate(ZW).strip())
            key = next((k for k in rows if abs(k - y) <= 2), y)
            r = rows.setdefault(key, {'y': key, 'x0': l['bbox'][0], 'x1': l['bbox'][2], 'parts': [], 'bold': True})
            r['parts'].append((l['bbox'][0], txt)); r['x0'] = min(r['x0'], l['bbox'][0]); r['x1'] = max(r['x1'], l['bbox'][2])
            r['bold'] = r['bold'] and bold
    out = []
    for k in sorted(rows):
        r = rows[k]; r['text'] = ' '.join(t for _, t in sorted(r['parts'])).strip()
        r['text'] = re.sub(r'\s+', ' ', r['text'])
        out.append(r)
    return out

def extract(path, start_page=1, left=72):
    d = pymupdf.open(path)
    blocks = []; mode = 'body'; cur = None
    def push():
        nonlocal cur
        if cur and cur['text'].strip(): blocks.append(cur)
        cur = None
    for pi in range(start_page, d.page_count):
        for r in lines_of(d[pi]):
            t = r['text']
            if r['y'] < 62: continue                      # running head
            if re.fullmatch(r'\d{1,2}', t) and (r['y'] > 740 or mode != 'refs'): continue
            low = t.lower().strip(' :')
            if low.startswith('appendix'): push(); return blocks
            if low in ('references', 'references:', 'reference'):
                push(); blocks.append({'type': 'h', 'text': 'References'}); mode = 'refs'; continue
            if mode == 'refs':
                if r['x0'] <= left + 6: push(); cur = {'type': 'ref', 'text': t}
                elif cur: cur['text'] = join(cur['text'], t)
                continue
            short = len(t) < 90 and not t.endswith('.')
            centered = r['x0'] > left + 60 and abs((r['x0'] + r['x1']) / 2 - 306) < 30
            if (r['bold'] and short) or (centered and short and len(t) < 70):
                push(); blocks.append({'type': 'h', 'text': t}); continue
            if r['x0'] >= left + 20 or cur is None: push(); cur = {'type': 'p', 'text': t}
            else: cur['text'] = join(cur['text'], t)
    push(); return blocks

def join(a, b):
    a = a.rstrip()
    if a.endswith('-') and not a.endswith(' -'): return a + b
    return a + ' ' + b

import docx
END = re.compile(r'[.!?)"”:]\s*$')
REFSTART = re.compile(r"^(?:[A-ZÀ-ÖØ-Þa-z][\w’'\-]+(?: [A-Za-z][\w’'\-]+)?, (?:[A-ZÀ-ÖØ-Þ]\.)|Aska\.)")
def extract_docx(path, start_marker, stop_prefix):
    d = docx.Document(path); blocks = []; started = False; mode = 'body'
    for p in d.paragraphs:
        t = re.sub(r'\s+', ' ', p.text.translate(ZW)).strip()
        t = t.replace('ADDIN EN.REFLIST ', '')
        if not t: continue
        if not started:
            if t.startswith(start_marker): started = True
            continue
        if t.lower().startswith(stop_prefix): break
        bold = all(r.bold for r in p.runs if r.text.strip()) and not t.startswith('http')
        is_head = p.style.name.startswith('Heading') or (bold and len(t) < 90)
        if t.lower().rstrip(':') == 'references':
            blocks.append({'type': 'h', 'text': 'References'}); mode = 'refs'; continue
        if is_head:
            blocks.append({'type': 'h', 'text': t.rstrip(':')})
            if t.lower().startswith('appendix'): mode = 'body'
            continue
        if mode == 'refs':
            prevref = blocks[-1] if blocks and blocks[-1]['type'] == 'ref' else None
            if prevref and (prevref['text'].rstrip().endswith((',', '-')) or not REFSTART.match(t)): prevref['text'] = join(prevref['text'], t)
            elif True: blocks.append({'type': 'ref', 'text': t})
            else: blocks[-1]['text'] = join(blocks[-1]['text'], t)
            continue
        prev = blocks[-1] if blocks else None
        if prev and prev['type'] == 'p' and not END.search(prev['text']): prev['text'] = join(prev['text'], t)
        else: blocks.append({'type': 'p', 'text': t})
    return blocks
