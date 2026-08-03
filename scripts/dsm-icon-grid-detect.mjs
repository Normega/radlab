// Find the icon-tile grid in the composite by decoding the PNG and looking at
// where the ink is. Guessing the geometry drifts by the bottom-right corner.
import fs from 'node:fs';
import zlib from 'node:zlib';

const buf = fs.readFileSync('F:/gits/radlab_project/PSY240resources/deevid_icons.png');

// --- minimal PNG decode -----------------------------------------------------
let pos = 8, idat = [], W = 0, H = 0, depth = 0, colour = 0;
while (pos < buf.length) {
  const len = buf.readUInt32BE(pos);
  const type = buf.toString('ascii', pos + 4, pos + 8);
  const data = buf.subarray(pos + 8, pos + 8 + len);
  if (type === 'IHDR') {
    W = data.readUInt32BE(0); H = data.readUInt32BE(4);
    depth = data[8]; colour = data[9];
  } else if (type === 'IDAT') idat.push(data);
  else if (type === 'IEND') break;
  pos += 12 + len;
}
if (depth !== 8) throw new Error('expected 8-bit, got ' + depth);
const channels = { 0: 1, 2: 3, 4: 2, 6: 4 }[colour];
if (!channels) throw new Error('unsupported colour type ' + colour);

const raw = zlib.inflateSync(Buffer.concat(idat));
const stride = W * channels;
const px = Buffer.alloc(H * stride);
let rp = 0;
for (let y = 0; y < H; y++) {
  const filter = raw[rp++];
  const line = raw.subarray(rp, rp + stride); rp += stride;
  const out = px.subarray(y * stride, (y + 1) * stride);
  const prev = y ? px.subarray((y - 1) * stride, y * stride) : null;
  for (let x = 0; x < stride; x++) {
    const a = x >= channels ? out[x - channels] : 0;
    const b = prev ? prev[x] : 0;
    const c = (prev && x >= channels) ? prev[x - channels] : 0;
    let v = line[x];
    if (filter === 1) v += a;
    else if (filter === 2) v += b;
    else if (filter === 3) v += (a + b) >> 1;
    else if (filter === 4) {
      const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
      v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c);
    }
    out[x] = v & 0xff;
  }
}
console.log(`decoded ${W}x${H}, ${channels} channels`);

// --- ink profiles -----------------------------------------------------------
const INK = 246;                        // anything below this is "not white"
const inkAt = (x, y) => {
  const i = y * stride + x * channels;
  return Math.min(px[i], px[i + 1] ?? px[i], px[i + 2] ?? px[i]) < INK ? 1 : 0;
};
const colInk = new Array(W).fill(0), rowInk = new Array(H).fill(0);
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  if (inkAt(x, y)) { colInk[x]++; rowInk[y]++; }
}

// Bands of consecutive lines carrying ink, ignoring hairline noise.
const bands = (profile, minRun, minInk) => {
  const out = []; let start = -1;
  for (let i = 0; i < profile.length; i++) {
    const on = profile[i] >= minInk;
    if (on && start < 0) start = i;
    if ((!on || i === profile.length - 1) && start >= 0) {
      const end = on ? i : i - 1;
      if (end - start + 1 >= minRun) out.push([start, end]);
      start = -1;
    }
  }
  return out;
};

console.log('\ncolumn bands (>=8px ink):');
bands(colInk, 20, 8).forEach(([a, b], i) => console.log(`  ${i}: ${a}..${b}  (w=${b - a + 1})`));
console.log('\nrow bands (>=8px ink):');
bands(rowInk, 20, 8).forEach(([a, b], i) => console.log(`  ${i}: ${a}..${b}  (h=${b - a + 1})`));

// Column bands measured INSIDE each icon row, so label text (often wider than
// the box) can't inflate them.
const ROWS = bands(rowInk, 100, 8).filter(([a, b]) => b - a > 200);
console.log('\nper-row tile boxes:');
const boxes = [];
for (const [y0, y1] of ROWS) {
  const prof = new Array(W).fill(0);
  for (let y = y0; y <= y1; y++) for (let x = 0; x < W; x++) if (inkAt(x, y)) prof[x]++;
  const cols = bands(prof, 100, 3).filter(([a, b]) => b - a > 200);
  console.log(`  y ${y0}..${y1} (h=${y1 - y0 + 1}): ` +
    cols.map(([a, b]) => `${a}..${b}(w=${b - a + 1})`).join('  '));
  for (const [x0, x1] of cols) boxes.push({ x0, y0, x1, y1 });
}
fs.writeFileSync('C:/Users/norma/AppData/Local/Temp/claude/F--gits-radlab-project-radlab/7e71075f-e22f-451d-a2cb-ccbd87f90b41/scratchpad/boxes.json',
  JSON.stringify(boxes, null, 1));
console.log(`\n${boxes.length} boxes written to boxes.json`);
