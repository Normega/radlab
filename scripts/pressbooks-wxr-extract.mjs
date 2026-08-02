#!/usr/bin/env node
/**
 * Extract chapters from a Pressbooks WXR (WordPress eXtended RSS) export and convert them
 * to markdown for direct-parse authoring (PSY240 run plan §9.3–9.4).
 *
 * This is the route for books that publish no XHTML export — Behavioral Disorders of
 * Childhood offers only mpdf and wxr. Prefer it over scraping live chapter pages: it is a
 * single local file, so a run is reproducible and does not depend on the site being up.
 *
 *   node scripts/pressbooks-wxr-extract.mjs --list <export.xml>
 *   node scripts/pressbooks-wxr-extract.mjs <export.xml> "Module 10"        # to stdout
 *   node scripts/pressbooks-wxr-extract.mjs --out DIR <export.xml> [match]  # one .md each
 *
 * `match` is a case-insensitive substring of the chapter title; omit it with --out to take
 * every chapter. Attachment items (images) are skipped, but the <img> tags inside chapter
 * bodies still become visible [[IMAGE: file]] markers — read those off the native PDF.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { toMarkdown, decode } from './lib/pressbooks-md.mjs';

const args = process.argv.slice(2);
const listOnly = args[0] === '--list' && args.shift();
let outDir = null;
if (args[0] === '--out') { outDir = args[1]; args.splice(0, 2); }

const file = args.shift();
if (!file) {
  console.error('usage: pressbooks-wxr-extract.mjs [--list|--out DIR] <export.xml> [title match]');
  process.exit(1);
}
const match = args.join(' ').trim().toLowerCase();

const xml = readFileSync(file, 'utf8');

const items = [];
for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
  const item = m[1];
  const type = /<wp:post_type>(?:<!\[CDATA\[)?([^\]<]*)/.exec(item)?.[1]?.trim() ?? '';
  if (type === 'attachment' || type === 'nav_menu_item') continue;

  const title = decode((/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/.exec(item)?.[1] ?? '').trim());
  const body = /<content:encoded><!\[CDATA\[([\s\S]*?)\]\]><\/content:encoded>/.exec(item)?.[1] ?? '';
  const order = Number(/<wp:menu_order>(\d+)/.exec(item)?.[1] ?? 0);
  if (!body.trim()) continue;
  items.push({ title, body, type, order });
}

items.sort((a, b) => a.order - b.order);

if (listOnly) {
  for (const it of items) {
    console.log(`${String(it.body.length).padStart(7)} chars  [${it.type}]  ${it.title}`);
  }
  process.exit(0);
}

const picked = match ? items.filter((it) => it.title.toLowerCase().includes(match)) : items;
if (!picked.length) {
  console.error(`no chapter matching "${match}". Run --list to see titles.`);
  process.exit(1);
}
if (!outDir && picked.length > 1) {
  console.error(`"${match}" matches ${picked.length} chapters; narrow it or use --out DIR:`);
  picked.forEach((it) => console.error('  ' + it.title));
  process.exit(1);
}

if (outDir) mkdirSync(outDir, { recursive: true });

for (const it of picked) {
  const md = toMarkdown(it.body);
  const images = [...md.matchAll(/\[\[IMAGE: ([^\]]+)\]\]/g)].map((i) => i[1]);
  process.stderr.write(`${it.title}: ${md.length} chars, ${images.length} image marker(s)`
    + (images.length ? ` — ${images.join(', ')}` : '') + '\n');

  if (outDir) {
    const slug = it.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80);
    writeFileSync(join(outDir, `${slug}.md`), `# ${it.title}\n\n${md}`);
  } else {
    process.stdout.write(`# ${it.title}\n\n${md}`);
  }
}
