# Passage art-pipeline spike (run headless: blender -b --factory-startup --python spike.py -- OUTDIR)
# Proves: orthographic side camera at game scale, transparent sprite cell,
# a neutral "beauty" render that the game can tint, and a flat region-ID mask
# render (skin / tunic / legs / hair) from the same camera, so the canvas can
# recolour the figure per element and per player avatar.
import bpy, sys, math, os

OUT = sys.argv[sys.argv.index('--') + 1]
os.makedirs(OUT, exist_ok=True)
sc = bpy.context.scene
for o in list(bpy.data.objects):
    bpy.data.objects.remove(o, do_unlink=True)

# ── materials: neutral light greys carrying the shading; the game supplies hue ──
def mat(name, grey):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    b.inputs['Base Color'].default_value = (grey, grey, grey, 1)
    b.inputs['Roughness'].default_value = 0.7
    return m
M = {'skin': mat('skin', 0.8), 'tunic': mat('tunic', 0.85), 'legs': mat('legs', 0.55), 'hair': mat('hair', 0.35)}

def add(prim, name, loc, scale, rot=(0, 0, 0), m='tunic'):
    if prim == 'sphere':
        bpy.ops.mesh.primitive_uv_sphere_add(segments=32, ring_count=16, location=loc)
    else:
        bpy.ops.mesh.primitive_cylinder_add(vertices=24, location=loc)
    o = bpy.context.active_object
    o.name = name; o.scale = scale; o.rotation_euler = rot
    o.data.materials.append(M[m])
    bpy.ops.object.shade_smooth()
    return o

# ── a stand-in acrobat, 1.75 m, facing +X (screen right), mid-stride ──
H = 1.75
add('sphere', 'head', (0.03, 0, 1.58), (0.13, 0.12, 0.14), m='skin')
add('sphere', 'hair', (0.0, 0, 1.63), (0.135, 0.125, 0.11), m='hair')
add('cyl', 'torso', (0, 0, 1.2), (0.15, 0.11, 0.27), m='tunic')
for side, sw in ((0.07, 0.35), (-0.07, -0.35)):
    add('cyl', 'thigh', (math.sin(sw) * 0.2, side, 0.72), (0.07, 0.07, 0.22), (0, sw, 0), m='legs')
    add('cyl', 'shin', (math.sin(sw) * 0.36, side, 0.28), (0.055, 0.055, 0.22), (0, sw * 0.6, 0), m='legs')
    add('cyl', 'arm', (-math.sin(sw) * 0.14, side * 2.4, 1.18), (0.045, 0.045, 0.24), (0, -sw, 0), m='tunic')
    add('sphere', 'hand', (-math.sin(sw) * 0.26, side * 2.4, 0.93), (0.05, 0.05, 0.05), m='skin')

# ── camera: orthographic, looking along +Y, so the figure is in profile ──
# Sprite cell 128×192 px at 2× (game logical 64×96); the figure fills ~160 px.
bpy.ops.object.camera_add(location=(0, -10, 0.9), rotation=(math.radians(90), 0, 0))
cam = bpy.context.active_object
cam.data.type = 'ORTHO'
cam.data.sensor_fit = 'VERTICAL'
cam.data.ortho_scale = H * 192 / 160
sc.camera = cam
sc.render.resolution_x, sc.render.resolution_y = 128, 192
sc.render.resolution_percentage = 100
sc.render.film_transparent = True
sc.render.image_settings.file_format = 'PNG'
sc.render.image_settings.color_mode = 'RGBA'

# ── lights: warm key from upper front-left (the desk-lamp torchlight), cool rim behind ──
def light(kind, loc, energy, color, rot):
    bpy.ops.object.light_add(type=kind, location=loc, rotation=rot)
    L = bpy.context.active_object
    L.data.energy = energy; L.data.color = color
    return L
light('AREA', (-2.5, -3, 3), 400, (1.0, 0.85, 0.65), (math.radians(55), 0, math.radians(-40)))
light('AREA', (2.5, 3, 2), 250, (0.6, 0.7, 1.0), (math.radians(-60), 0, math.radians(140)))
light('AREA', (0, -4, 1), 60, (1, 1, 1), (math.radians(90), 0, 0))

# Engine ids moved between versions: read what's accepted rather than hardcode.
for eng in ('BLENDER_EEVEE', 'BLENDER_EEVEE_NEXT'):
    try:
        sc.render.engine = eng
        break
    except TypeError:
        pass
print('engine', sc.render.engine)

# ── pass 1: beauty ──
sc.render.filepath = os.path.join(OUT, 'beauty.png')
bpy.ops.render.render(write_still=True)

# ── pass 2: region-ID mask, flat emission, same camera ──
# R = skin, G = tunic, B = legs, and hair = pure white.
IDS = {'skin': (1, 0, 0), 'tunic': (0, 1, 0), 'legs': (0, 0, 1), 'hair': (1, 1, 1)}
for k, m in M.items():
    nt = m.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    em = nt.nodes.new('ShaderNodeEmission'); em.inputs['Color'].default_value = (*IDS[k], 1)
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    nt.links.new(em.outputs['Emission'], out.inputs['Surface'])
sc.view_settings.view_transform = 'Standard'   # flat IDs must come out exactly as authored
sc.render.filepath = os.path.join(OUT, 'mask.png')
bpy.ops.render.render(write_still=True)
print('done')
