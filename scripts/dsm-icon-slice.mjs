// Slice the composite into per-chapter icons.
//
// Geometry came from grid.mjs (ink-profile detection), not from eyeballing:
// boxes are 310x318 at x = 101/485/869/1253/1637, y = 101/571/1063/1603.
// Inset by 3px to drop the 1px border, then take a centred 304x304 square so
// scaling to 192 doesn't squash it.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const FF = 'C:/Users/norma/AppData/Local/Microsoft/WinGet/Links/ffmpeg';
const SRC = 'F:/gits/radlab_project/PSY240resources/deevid_icons.png';
const OUT = 'F:/gits/radlab_project/radlab/src/assets/chapter-icons';

const XS = [101, 485, 869, 1253, 1637];
const YS = [101, 571, 1063, 1603];
const INSET = 3, SIZE = 304, BOX_H = 318;

// Row-major order in the composite. `null` is the duplicated
// "Disruptive, Impulse-Control, and Conduct Disorders" tile at row 4, column 1
// — the same artwork as position 15, so nothing is lost by skipping it.
// DSM-5-TR chapter 20 (Other Mental Disorders) has no tile; the course omits it.
const ORDER = [
  [1, 'neurodevelopmental'], [2, 'schizophrenia-spectrum'], [3, 'bipolar'],
  [4, 'depressive'], [5, 'anxiety'],
  [6, 'obsessive-compulsive'], [7, 'trauma-stressor'], [8, 'dissociative'],
  [9, 'somatic-symptom'], [10, 'feeding-eating'],
  [11, 'elimination'], [12, 'sleep-wake'], [13, 'sexual-dysfunctions'],
  [14, 'gender-dysphoria'], [15, 'disruptive-impulse-conduct'],
  null, [16, 'substance-related'], [17, 'neurocognitive'],
  [18, 'personality'], [19, 'paraphilic'],
];

fs.mkdirSync(OUT, { recursive: true });
let n = 0;
ORDER.forEach((entry, i) => {
  if (!entry) return;
  const [chapter, name] = entry;
  const x = XS[i % 5] + INSET;
  const y = YS[Math.floor(i / 5)] + INSET + Math.floor((BOX_H - 2 * INSET - SIZE) / 2);
  const dest = `${OUT}/${chapter}.${name}.webp`;
  execFileSync(FF, [
    '-y', '-loglevel', 'error', '-i', SRC,
    '-vf', `crop=${SIZE}:${SIZE}:${x}:${y},scale=192:192:flags=lanczos`,
    '-q:v', '82', dest,
  ]);
  n++;
  console.log(`${String(chapter).padStart(2)}  ${name.padEnd(28)} ${(fs.statSync(dest).size / 1024).toFixed(1)} KB`);
});
const total = fs.readdirSync(OUT).filter(f => f.endsWith('.webp'))
  .reduce((s, f) => s + fs.statSync(`${OUT}/${f}`).size, 0);
console.log(`\n${n} icons, ${(total / 1024).toFixed(0)} KB total`);
