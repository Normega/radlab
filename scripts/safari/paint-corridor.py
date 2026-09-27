"""Paint a Blender-rendered corridor into the Night Safari style.

    python scripts/safari/paint-corridor.py <renders_dir> <corridor> [--quality medium|high]
                                            [--only plate|props] [--limit N]

<renders_dir> holds what Blender exported for one exhibit (see docs/markdowns/safari_build_plan.md
§4.3): `manifest.json`, one plate render per corridor, and one transparent render per prop.
Painted output goes to <renders_dir>/../painted/<corridor>/. Every image request goes through
gen-art.mjs, so the global ledger and spend cap apply.

The recipe this implements (verified in the 2026-09-26 tests):
  * style references are content-free: the Splat sheet for ink, a plank swatch for palette.
    A scene image as reference leaks its objects into the output.
  * the plate is painted in overlapping 1024x1536 tiles; each tile after the first receives
    the previous tile's painted overlap under a mask so it is kept, then the overlaps are
    blended with a feather.
  * each prop is painted alone on mid-grey with a transparent output, and its prompt names
    exactly that one object - naming an object that is absent makes the model draw it.

Resumable: a step whose output file already exists is skipped.
"""
import argparse, glob, json, os, subprocess, sys
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
GEN = os.path.join(HERE, 'gen-art.mjs')
STYLE_DIR = r'I:\Shared drives\ComeSee\Safari\art\style'
INK = os.path.join(STYLE_DIR, 'ink_reference_splat.png')
PALETTE = os.path.join(STYLE_DIR, 'palette_swatch_barn.png')
TW, TH, STRIDE = 1024, 1536, 640
MATCH_COLOUR = False
OV = TW - STRIDE

STYLE = (
    "Style: hand-inked storybook illustration for a cozy-spooky night-time game, 'Studio Ghibli at midnight "
    "meets a deadpan nature documentary'. Take the ink line quality (confident dark outlines, varied weight) from "
    "the SECOND image and the colour palette and darkness from the THIRD image. Both are style references only: "
    "copy none of their objects, characters or layout. Night lighting: cool blue-white moonlight from the upper "
    "left, warm brown-black shadows, small amber lantern glows only where the first image has a lantern. "
    "No text, no letters, no watermark, no border, no characters or animals.")

# Deliberately generic: naming a lantern, window or doorway in the prompt makes the model paint one
# into every tile, whether or not the tile has it (2026-09-27, c1 medium run). The render carries
# the layout; the prompt only says what materials things are made of.
PLATE_DESC = {
    'c1': "the inside of an old wooden barn seen from mouse height: board walls, posts, beams, a plank roof and a plank floor",
    'c2': "the inside of an old wooden barn seen from mouse height: board walls and stall fronts, posts, beams, a plank roof and a plank floor",
}


def run_gen(job, out_dir):
    os.makedirs(out_dir, exist_ok=True)
    jf = os.path.join(out_dir, f"_job_{job['id']}.json")
    json.dump([job], open(jf, 'w'))
    env = dict(os.environ, SAFARI_ART_DIR=out_dir)
    r = subprocess.run(['node', GEN, jf], capture_output=True, text=True, env=env)
    sys.stdout.write(r.stdout); sys.stderr.write(r.stderr)
    if r.returncode:
        raise SystemExit(f"generation failed for {job['id']}")
    os.remove(jf)
    return sorted(glob.glob(os.path.join(out_dir, job['id'] + '_*.png')))[-1]


def tile_xs(width):
    xs = list(range(0, width - TW + 1, STRIDE))
    if xs[-1] != width - TW:
        xs.append(width - TW)
    return xs


def paint_plate(rdir, cor, meta, out, quality, limit):
    # paint from the brighter, haze-free input render when there is one: a dim hazy render lets
    # the model invent structure; the style references still set the final darkness
    src_name = meta['plate'].replace('_render.png', '_input.png')
    if not os.path.exists(os.path.join(rdir, src_name)):
        src_name = meta['plate']
    plate = Image.open(os.path.join(rdir, src_name)).convert('RGB')
    xs = tile_xs(plate.width)
    raw = os.path.join(out, 'raw'); tiles = os.path.join(out, 'tiles'); os.makedirs(tiles, exist_ok=True)
    done = 0
    for k, x in enumerate(xs):
        dst = os.path.join(tiles, f'tile{k:02d}.png')
        if os.path.exists(dst):
            continue
        if limit is not None and done >= limit:
            print('limit reached'); return False
        src = plate.crop((x, 0, x + TW, TH))
        base = (f"Repaint the FIRST image as a finished game background in the style below. It is one {TW}x{TH} tile of "
                f"{PLATE_DESC[cor]}. Keep the FIRST image's composition, perspective, and the position and size of every "
                "shape, edge and light in it EXACTLY - this tile must line up with its neighbours. Change only the rendering "
                "style. Every object in the first image stays exactly where it is, and nothing new is added - where the first "
                "image is plain wall or floor, paint plain wall or floor. Keep light where the first image is bright: moonlit "
                "gaps, open sky, lamp flames and lit doorways stay bright; dark areas stay dark. ")
        job = {'id': f'{cor}_tile{k:02d}', 'size': f'{TW}x{TH}', 'quality': quality, 'n': 1}
        # Every tile is painted independently from the render. Chaining tiles through a mask (keep the
        # previous tile's painted overlap) made seams perfect but let the model ignore the render in the
        # rest of the tile - it invented walls, dropped the window, moved the floor line (2026-09-27).
        # Seams are handled after painting instead: colour-match in the overlap, then cross-fade.
        inp = os.path.join(tiles, f'_in{k:02d}.png'); src.save(inp)
        job.update(images=[inp, INK, PALETTE], prompt=base + STYLE)
        got = run_gen(job, raw)
        Image.open(got).convert('RGB').save(dst)
        done += 1
    # stitch with a feathered blend across each overlap
    acc = np.zeros((TH, plate.width, 3), np.float64); wsum = np.zeros((TH, plate.width, 1), np.float64)
    prev = None
    for k, x in enumerate(xs):
        t = np.asarray(Image.open(os.path.join(tiles, f'tile{k:02d}.png')).convert('RGB'), np.float64)
        if MATCH_COLOUR and prev is not None:
            # match this tile's colour statistics to the previous (already matched) tile in the overlap.
            # OFF by default: chained matching accumulates drift - warm lantern light spread down the
            # whole c1 plate and turned the moon orange (2026-09-27). Raw overlaps differ ~9/255,
            # which the cross-fade hides.
            keep = TW - (x - xs[k - 1])
            a_, b_ = t[:, :keep].reshape(-1, 3), prev[:, TW - keep:].reshape(-1, 3)
            t = ((t - a_.mean(0)) * (b_.std(0) / np.maximum(a_.std(0), 1e-6)) + b_.mean(0)).clip(0, 255)
        prev = t
        w = np.ones((1, TW, 1))
        if k > 0:
            keep = TW - (x - xs[k - 1]); w[0, :keep, 0] = np.linspace(0, 1, keep)
        if k < len(xs) - 1:
            keep_next = TW - (xs[k + 1] - x); w[0, TW - keep_next:, 0] = np.minimum(w[0, TW - keep_next:, 0], np.linspace(1, 0, keep_next))
        acc[:, x:x + TW] += t * w; wsum[:, x:x + TW] += w
    img = Image.fromarray((acc / np.maximum(wsum, 1e-9)).clip(0, 255).astype(np.uint8))
    img.save(os.path.join(out, f'{cor}_plate.png'))
    img.save(os.path.join(out, f'{cor}_plate.webp'), 'WEBP', quality=78, method=6)
    print('plate done', img.size)
    return True


def paint_props(rdir, cor, meta, out, quality, limit):
    raw = os.path.join(out, 'raw'); sp = os.path.join(out, 'props'); os.makedirs(sp, exist_ok=True)
    done = 0
    for p in meta['props']:
        if p['kind'] != 'prop':
            continue
        dst = os.path.join(sp, p['id'] + '.png')
        if os.path.exists(dst):
            continue
        if limit is not None and done >= limit:
            print('limit reached'); return False
        rgba = Image.open(os.path.join(rdir, p['file'])).convert('RGBA')
        # fit into a 1024 square on mid-grey at ~80% so small props get enough pixels
        s = 820 / max(rgba.size)
        big = rgba.resize((max(1, round(rgba.width * s)), max(1, round(rgba.height * s))), Image.LANCZOS)
        canvas = Image.new('RGBA', (1024, 1024), (128, 128, 128, 255))
        ox, oy = (1024 - big.width) // 2, (1024 - big.height) // 2
        canvas.alpha_composite(big, (ox, oy))
        inp = os.path.join(sp, f"_in_{p['id']}.png"); canvas.convert('RGB').save(inp)
        prompt = (f"Repaint the object in the FIRST image - {p['desc']} - as a finished illustrated game prop in the style "
                  "below. It is the only object: keep its exact position, size, silhouette and viewing angle, and add "
                  "nothing else. Output it ONLY on a fully transparent background: no floor, no wall, no shadow plane, "
                  "no grey. Give it a thin cool moonlit rim so it reads against a dark scene. " + STYLE)
        got = run_gen({'id': f"{cor}_{p['id']}", 'images': [inp, INK, PALETTE], 'size': '1024x1024',
                       'quality': quality, 'n': 1, 'background': 'transparent', 'prompt': prompt}, raw)
        g = Image.open(got).convert('RGBA').crop((ox, oy, ox + big.width, oy + big.height))
        g = g.resize(rgba.size, Image.LANCZOS)
        g.save(dst); g.save(os.path.join(sp, p['id'] + '.webp'), 'WEBP', quality=82, method=6)
        done += 1
    return True


def prepare(rdir, man):
    """Trim each prop render to its visible pixels (+6 px) and shift box_px to match. Blender's
    bound-box projection is padded generously on export, because a tight one clipped the boot."""
    if man.get('trimmed'):
        return man
    for meta in (v for k, v in man.items() if isinstance(v, dict) and 'props' in v):
        for p in meta['props']:
            if p['kind'] != 'prop':
                continue
            f = os.path.join(rdir, p['file']); im = Image.open(f).convert('RGBA')
            # the haze volume leaves a faint alpha veil over the whole render; clear it first
            a = im.getchannel('A').point(lambda v: 0 if v < 48 else v); im.putalpha(a)
            bb = a.getbbox()
            if not bb:
                continue
            l, t, r, b = max(0, bb[0] - 6), max(0, bb[1] - 6), min(im.width, bb[2] + 6), min(im.height, bb[3] + 6)
            if l == 0 or r == im.width:
                print(f"note: {p['id']} touches its render edge (at the plate edge, or export padding too tight)")
            im.crop((l, t, r, b)).save(f)
            x0, y0 = p['box_px'][:2]
            p['box_px'] = [x0 + l, y0 + t, x0 + r, y0 + b]
    man['trimmed'] = True
    json.dump(man, open(os.path.join(rdir, 'manifest.json'), 'w'), indent=1)
    return man


def preview(rdir, cor, meta, out):
    pl = os.path.join(out, f'{cor}_plate.png')
    if not os.path.exists(pl):
        return
    img = Image.open(pl).convert('RGBA')
    for p in meta['props']:
        f = os.path.join(out, 'props', p.get('id', '') + '.png')
        if p['kind'] == 'prop' and os.path.exists(f):
            x0, y0, x1, y1 = p['box_px']; img.alpha_composite(Image.open(f).convert('RGBA'), (x0, y0))
    img.convert('RGB').save(os.path.join(out, f'{cor}_composite.jpg'), quality=88)
    print('composite written')


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('renders_dir'); ap.add_argument('corridor')
    ap.add_argument('--quality', default='medium', help='props quality')
    ap.add_argument('--plate-quality', default='high', help='plates need high: medium honours the tile mask 2-3x worse'); ap.add_argument('--only', choices=['plate', 'props'])
    ap.add_argument('--limit', type=int, default=None, help='max new images this run')
    a = ap.parse_args()
    man = json.load(open(os.path.join(a.renders_dir, 'manifest.json')))
    if a.only != 'plate':                     # props are only trimmed when props will be painted
        man = prepare(a.renders_dir, man)
    meta = man[a.corridor]
    out = os.path.join(os.path.dirname(os.path.abspath(a.renders_dir)), 'painted', a.corridor)
    os.makedirs(out, exist_ok=True)
    ok = True
    if a.only in (None, 'plate'):
        ok = paint_plate(a.renders_dir, a.corridor, meta, out, a.plate_quality, a.limit) and ok
    if a.only in (None, 'props'):
        ok = paint_props(a.renders_dir, a.corridor, meta, out, a.quality, a.limit) and ok
    preview(a.renders_dir, a.corridor, meta, out)
