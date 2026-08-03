// Trim a single icon to its content and re-emit it square, so a piece of art
// with generous margins doesn't read smaller than the flat glyphs beside it.
//
//   node scripts/dsm-icon-trim.mjs <source.png> <chapter number> <name>
//
// Shares the PNG decoder with dsm-icon-grid-detect.mjs deliberately: no image
// library is installed, and adding one for two scripts isn't worth it.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import zlib from 'node:zlib';

const [src, chapter, name] = process.argv.slice(2);
if (!src || !chapter || !name) {
  console.error('usage: node scripts/dsm-icon-trim.mjs <source.png> <chapter> <name>');
  process.exit(1);
}

const FF = 'C:/Users/norma/AppData/Local/Microsoft/WinGet/Links/ffmpeg';
const OUT = 'src/assets/chapter-icons';
const PAD = 0.06;   // share of the content box left as breathing room

const buf = fs.readFileSync(src);
let pos = 8, idat = [], W = 0, H = 0, depth = 0, colour = 0;
while (pos < buf.length) {
  const len = buf.readUInt32BE(pos);
  const type = buf.toString('ascii', pos + 4, pos + 8);
  const data = buf.subarray(pos + 8, pos + 8 + len);
  if (type === 'IHDR') { W = data.readUInt32BE(0); H = data.readUInt32BE(4); depth = data[8]; colour = data[9] }
  else if (type === 'IDAT') idat.push(data);
  else if (type === 'IEND') break;
  pos += 12 + len;
}
const channels = { 0: 1, 2: 3, 4: 2, 6: 4 }[colour];
if (depth !== 8 || !channels) throw new Error(`unsupported PNG: depth ${depth}, colour ${colour}`);

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

// Content bounding box. Transparent counts as empty, so art on alpha trims the
// same way art on white does.
const INK = 246;
let x0 = W, y0 = H, x1 = -1, y1 = -1;
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  const i = y * stride + x * channels;
  const alpha = (channels === 2 || channels === 4) ? px[i + channels - 1] : 255;
  if (alpha < 16) continue;
  const lum = Math.min(px[i], px[i + 1] ?? px[i], px[i + 2] ?? px[i]);
  if (lum < INK) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y }
}
if (x1 < 0) throw new Error('no content found');

const side = Math.max(x1 - x0 + 1, y1 - y0 + 1);
const padded = Math.round(side * (1 + PAD * 2));
const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
const cropX = Math.max(0, Math.min(W - padded, Math.round(cx - padded / 2)));
const cropY = Math.max(0, Math.min(H - padded, Math.round(cy - padded / 2)));
const cropW = Math.min(padded, W - cropX, H - cropY);

console.log(`${W}x${H} → content ${x1 - x0 + 1}x${y1 - y0 + 1} at (${x0},${y0})`);
console.log(`  margin trimmed: ${((1 - side / Math.min(W, H)) * 100).toFixed(0)}%`);

const dest = `${OUT}/${chapter}.${name}.webp`;
execFileSync(FF, ['-y', '-loglevel', 'error', '-i', src,
  '-vf', `crop=${cropW}:${cropW}:${cropX}:${cropY},scale=192:192:flags=lanczos`,
  '-q:v', '82', dest]);
console.log(`  wrote ${dest} (${(fs.statSync(dest).size / 1024).toFixed(1)} KB)`);
