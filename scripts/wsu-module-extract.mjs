#!/usr/bin/env node
/**
 * Slice one module out of the Fundamentals of Psychological Disorders single-file HTML
 * and convert it to markdown for direct-parse authoring (run plan §9.3–9.4).
 *
 * Why HTML and not pdftotext: the HTML carries real h2/h3 headings, real <ul>/<ol>, and —
 * the part that matters — it tells you where the figures are. Content delivered as an image
 * (e.g. Table 13.1, the personality-disorder prevalence matrix) is invisible to pdftotext and
 * URL-only here, so every <img> becomes a visible [[IMAGE: file]] marker that you then read
 * off the native PDF page with the Read tool. A dropped figure must not be silent.
 *
 *   node scripts/wsu-module-extract.mjs 16 > out.md
 *   node scripts/wsu-module-extract.mjs --list
 */
import { readFileSync } from 'node:fs';

const BOOK = process.env.WSU_BOOK_HTML
  || 'F:/gits/radlab_project/PSY240resources/Fundamentals-of-Psychological-Disorders-1721254433.html';

const html = readFileSync(BOOK, 'utf8');

// Module boundaries are the only <h2 class="chapter-title"> in the file; back matter closes the last one.
const bounds = [];
const chapterRe = /<h[12][^>]*class="(?:chapter-title|back-matter-title)"[^>]*>([\s\S]*?)<\/h[12]>/g;
for (let m; (m = chapterRe.exec(html)); ) {
  bounds.push({ offset: m.index, title: strip(m[1]) });
}

if (process.argv.includes('--list')) {
  bounds.forEach((b, i) => {
    const end = bounds[i + 1]?.offset ?? html.length;
    console.log(`${String(b.offset).padStart(8)}  ${String(end - b.offset).padStart(7)} chars  ${b.title}`);
  });
  process.exit(0);
}

const n = Number(process.argv[2]);
if (!Number.isInteger(n)) {
  console.error('usage: wsu-module-extract.mjs <module number> | --list');
  process.exit(1);
}

const startIdx = bounds.findIndex((b) => new RegExp(`^Module ${n}\\b`).test(b.title));
if (startIdx < 0) {
  console.error(`Module ${n} not found. Chapters present:\n` + bounds.map((b) => '  ' + b.title).join('\n'));
  process.exit(1);
}
const start = bounds[startIdx].offset;
const end = bounds[startIdx + 1]?.offset ?? html.length;

process.stderr.write(`Module ${n}: bytes ${start}..${end} (${end - start} chars)\n`);
process.stdout.write(toMarkdown(html.slice(start, end)));

function strip(s) {
  return decode(s.replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();
}

function decode(s) {
  return s
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;|&rsquo;|&lsquo;/g, "'")
    .replace(/&ldquo;|&rdquo;/g, '"')
    .replace(/&mdash;/g, '\u2014')
    .replace(/&ndash;/g, '\u2013')
    .replace(/&hellip;/g, '\u2026')
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)));
}

function toMarkdown(chunk) {
  let s = chunk;

  // Figures first, before any tag stripping can eat them. A silent drop here is the failure mode.
  s = s.replace(/<img\b[^>]*>/gi, (tag) => {
    const src = /src="([^"]*)"/i.exec(tag)?.[1] ?? '';
    const alt = /alt="([^"]*)"/i.exec(tag)?.[1] ?? '';
    const file = decodeURIComponent(src.split('/').pop() || 'unknown');
    return `\n\n[[IMAGE: ${file}${alt ? ` — alt="${alt}"` : ''}]]\n\n`;
  });

  s = s.replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, '');

  // Tables survive as pipe rows; only 3 real <table> exist in the book but they carry real payload.
  s = s.replace(/<t[dh]\b[^>]*>/gi, ' | ').replace(/<\/t[dh]>/gi, '');
  s = s.replace(/<tr\b[^>]*>/gi, '\n').replace(/<\/tr>/gi, ' |');
  s = s.replace(/<\/?(table|thead|tbody|tfoot)\b[^>]*>/gi, '\n\n');

  s = s.replace(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi, (_, lvl, inner) => {
    const text = strip(inner);
    return text ? `\n\n${'#'.repeat(Math.min(6, Number(lvl)))} ${text}\n\n` : '\n\n';
  });

  s = s.replace(/<li\b[^>]*>/gi, '\n- ').replace(/<\/li>/gi, '');
  s = s.replace(/<\/?(ul|ol)\b[^>]*>/gi, '\n');
  s = s.replace(/<br\s*\/?>/gi, '\n');
  s = s.replace(/<\/(p|div|section|blockquote|figure|figcaption)>/gi, '\n\n');
  s = s.replace(/<(strong|b)\b[^>]*>([\s\S]*?)<\/\1>/gi, (_, __, t) => `**${strip(t)}**`);
  s = s.replace(/<(em|i)\b[^>]*>([\s\S]*?)<\/\1>/gi, (_, __, t) => `*${strip(t)}*`);
  s = s.replace(/<a\b[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, (_, href, t) => {
    const text = strip(t);
    return text ? `${text} (${href})` : '';
  });

  s = s.replace(/<[^>]+>/g, '');
  s = decode(s);
  s = s.replace(/[ \t]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{3,}/g, '\n\n');
  return s.trim() + '\n';
}
