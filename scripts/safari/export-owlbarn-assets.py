"""Export the painted Owl Barn art from the shared drive into the game's bundled assets.

    python scripts/safari/export-owlbarn-assets.py

Reads   I:/Shared drives/ComeSee/Safari/art/corridors/owlbarn/{renders,painted}  (paint-corridor.py output)
        I:/Shared drives/ComeSee/Safari/art/characters/raw                         (gen-art.mjs output, newest take)
Writes  src/games/Safari/owlbarn/assets/*.webp  and  src/games/Safari/owlbarn/assets/scene.json

scene.json carries everything the engine positions by: each corridor's plate size and props (plate pixels),
the owl rig (body + heads cut at the neck, pivot, eye centres) and the mouse poses (aligned on a foot line).
"""
import glob, json, os
import numpy as np
from PIL import Image

ART = r'I:\Shared drives\ComeSee\Safari\art'
COR = os.path.join(ART, 'corridors', 'owlbarn')
RAW = os.path.join(ART, 'characters', 'raw')
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'src', 'games', 'Safari', 'owlbarn', 'assets')
OUT = os.path.normpath(OUT)
os.makedirs(OUT, exist_ok=True)

OWL_H = 440          # exported owl height in px (displayed ~300 plate px, sharp up to DPR 2)
MOUSE_W = 320        # exported width of the mouse master pose, tail included
NECK_FEATHER = 40


def newest(prefix):
    fs = sorted(glob.glob(os.path.join(RAW, prefix + '_*.png')))
    if not fs:
        raise SystemExit(f'missing character art: {prefix}')
    return Image.open(fs[-1]).convert('RGBA')


def save_webp(im, name, q=82):
    im.save(os.path.join(OUT, name), 'WEBP', quality=q, method=6)
    return name


def clean_alpha(im, floor=24):
    a = im.getchannel('A').point(lambda v: 0 if v < floor else v)
    im = im.copy(); im.putalpha(a); return im


scene = {'version': 1}

# ── corridors ────────────────────────────────────────────────────────────────
man = json.load(open(os.path.join(COR, 'renders', 'manifest.json')))
for cor in ('c1', 'c2'):
    m = man[cor]
    plate = Image.open(os.path.join(COR, 'painted', cor, f'{cor}_plate.png')).convert('RGB')
    save_webp(plate, f'{cor}_plate.webp', q=74)
    props = []
    for p in sorted(m['props'], key=lambda q: q['spot']):
        e = {'spot': p['spot'], 'id': p['id'], 'kind': p['kind']}
        if p['kind'] == 'prop':
            im = Image.open(os.path.join(COR, 'painted', cor, 'props', p['id'] + '.png')).convert('RGBA')
            e['file'] = save_webp(clean_alpha(im), f"{cor}_{p['id']}.webp")
            e['box'] = p['box_px']
        else:
            e['anchor'] = p['anchor_px']
        props.append(e)
    scene[cor] = {'width': plate.width, 'height': plate.height, 'props': props}

# ── owl rig ──────────────────────────────────────────────────────────────────
master = newest('char_owl_master')
alpha = np.asarray(master.getchannel('A')) > 40
rows = [(alpha[y].sum(), y) for y in range(620, 900)]
neck = min(rows)[1]
body = newest('owl_body_headless')
heads = {k: newest('owl_head_' + k) for k in ('neutral', 'blink', 'hoot', 'glare')}

ys = np.where(np.asarray(body.getchannel('A')).any(1))[0]
feet_y = int(ys[-1])
scale = OWL_H / (feet_y - int(np.where(alpha.any(1))[0][0]))


def cut_head(im):
    a = np.array(im)
    a[neck + 30:, :, 3] = 0
    for i in range(NECK_FEATHER):
        y = neck - 10 + i
        a[y, :, 3] = (a[y, :, 3] * (1 - i / NECK_FEATHER)).astype(np.uint8)
    return Image.fromarray(a)


def part(im, name):
    """Crop to alpha, scale, save; return its box in rig coordinates (origin = feet, centre-bottom)."""
    im = clean_alpha(im)
    bb = im.getchannel('A').getbbox()
    c = im.crop(bb)
    w, h = max(1, round(c.width * scale)), max(1, round(c.height * scale))
    save_webp(c.resize((w, h), Image.LANCZOS), name)
    return {'file': name, 'x': round((bb[0] - 512) * scale, 1), 'y': round((bb[1] - feet_y) * scale, 1), 'w': w, 'h': h}


rig = {'height': OWL_H, 'pivot': [0, round((neck - feet_y) * scale, 1)], 'body': part(body, 'owl_body.webp'), 'heads': {}}
for k, im in heads.items():
    rig['heads'][k] = part(cut_head(im), f'owl_head_{k}.webp')

# eye centres (for the glow in the rafters): the two largest dark blobs in the neutral head's face band
nh = np.asarray(heads['neutral']).astype(np.int32)
lum = (nh[..., 0] * 3 + nh[..., 1] * 6 + nh[..., 2]) // 10
dark = (lum < 55) & (nh[..., 3] > 200)
band = np.zeros_like(dark); band[250:neck - 60, 150:874] = True
pts = np.argwhere(dark & band)
eyes = []
for side in (pts[pts[:, 1] < 512], pts[pts[:, 1] >= 512]):
    if len(side):
        cy, cx = side.mean(0)
        r = np.sqrt(len(side) / np.pi)
        eyes.append({'x': round((cx - 512) * scale, 1), 'y': round((cy - feet_y) * scale, 1), 'r': round(r * scale, 1)})
rig['eyes'] = eyes

sw = clean_alpha(newest('owl_swoop'))
bb = sw.getchannel('A').getbbox(); c = sw.crop(bb)
sws = OWL_H * 1.05 / c.height
save_webp(c.resize((round(c.width * sws), round(c.height * sws)), Image.LANCZOS), 'owl_swoop.webp')
# talons are bottom-right in the swoop drawing: that point is what reaches the mouse
rig['swoop'] = {'file': 'owl_swoop.webp', 'w': round(c.width * sws), 'h': round(c.height * sws), 'grip': [round(c.width * sws * 0.8), round(c.height * sws * 0.95)]}
scene['owl'] = rig

# ── mouse poses ──────────────────────────────────────────────────────────────
mm = clean_alpha(newest('char_mouse_master'))
bbm = mm.getchannel('A').getbbox()
mscale = MOUSE_W / (bbm[2] - bbm[0])
poses = {'crouch': mm}
for k in ('peek', 'run_a', 'run_b', 'freeze', 'dizzy', 'cheer'):
    poses[k] = clean_alpha(newest('mouse_' + k))
mouse = {}
for k, im in poses.items():
    bb = im.getchannel('A').getbbox(); c = im.crop(bb)
    w, h = round(c.width * mscale), round(c.height * mscale)
    save_webp(c.resize((w, h), Image.LANCZOS), f'mouse_{k}.webp')
    # anchor: the body's leading edge sits at x=0 so poses don't slide when swapped; feet on y=0
    mouse[k] = {'file': f'mouse_{k}.webp', 'w': w, 'h': h, 'x': -w, 'y': -h}
scene['mouse'] = mouse

json.dump(scene, open(os.path.join(OUT, 'scene.json'), 'w', newline=chr(10)), indent=1)
total = sum(os.path.getsize(os.path.join(OUT, f)) for f in os.listdir(OUT))
print('assets', len(os.listdir(OUT)), 'files', round(total / 1e6, 2), 'MB; eyes', eyes, 'neck', neck)
