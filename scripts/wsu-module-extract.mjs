#!/usr/bin/env node
/**
 * Slice one module out of the Fundamentals of Psychological Disorders single-file HTML
 * export and convert it to markdown for direct-parse authoring (PSY240 run plan §9.3–9.4).
 *
 * Why HTML and not pdftotext: the HTML carries real h2/h3 headings, real <ul>/<ol>, and —
 * the part that matters — it tells you where the figures are. See lib/pressbooks-md.mjs.
 *
 * After running, read any [[IMAGE: …]] markers off the corresponding native PDF page with
 * the Read tool; the HTML gives you the filename, not the content.
 *
 *   node scripts/wsu-module-extract.mjs 16 > out.md
 *   node scripts/wsu-module-extract.mjs --list
 *
 * Set WSU_BOOK_HTML to point at a different Pressbooks XHTML export.
 * For books with no XHTML export, use pressbooks-chapter-fetch.mjs instead.
 */
import { readFileSync } from 'node:fs';
import { toMarkdown, strip } from './lib/pressbooks-md.mjs';

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

const arg = process.argv.slice(2).join(' ').trim();
if (!arg) {
  console.error('usage: wsu-module-extract.mjs <module number | section title> | --list');
  process.exit(1);
}

// A bare integer means "Module N" (the Fundamentals book). Anything else is matched as a
// case-insensitive title prefix, which is what the section-numbered books need — Cummings'
// Abnormal Psychology has "3.1 Mood Disorders", not "Module 3".
const startIdx = /^\d+$/.test(arg)
  ? bounds.findIndex((b) => new RegExp(`^Module ${arg}\\b`).test(b.title))
  : bounds.findIndex((b) => b.title.toLowerCase().startsWith(arg.toLowerCase()));

if (startIdx < 0) {
  console.error(`"${arg}" not found. Chapters present:\n` + bounds.map((b) => '  ' + b.title).join('\n'));
  process.exit(1);
}
const start = bounds[startIdx].offset;
const end = bounds[startIdx + 1]?.offset ?? html.length;

process.stderr.write(`${bounds[startIdx].title}: bytes ${start}..${end} (${end - start} chars)\n`);
process.stdout.write(toMarkdown(html.slice(start, end)));
