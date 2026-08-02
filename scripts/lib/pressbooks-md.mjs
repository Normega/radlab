/**
 * Pressbooks HTML → markdown, for direct-parse authoring (PSY240 run plan §9.3).
 *
 * Shared by `wsu-module-extract.mjs` (slices the single-file XHTML export of
 * Fundamentals of Psychological Disorders) and `pressbooks-chapter-fetch.mjs`
 * (pulls live chapter pages for books with no XHTML export, e.g. Behavioral
 * Disorders of Childhood). One converter so the two sources cannot drift.
 *
 * The rule that matters: every <img> becomes a visible [[IMAGE: file]] marker.
 * Content delivered as an image is invisible to pdftotext and URL-only in HTML,
 * and Table 13.1 — a prevalence matrix for ten personality disorders — nearly
 * went missing that way. A dropped figure must be loud, not silent.
 */

export function decode(s) {
  return s
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;|&rsquo;|&lsquo;/g, "'")
    .replace(/&ldquo;|&rdquo;/g, '"')
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–')
    .replace(/&hellip;/g, '…')
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)));
}

export function strip(s) {
  return decode(s.replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();
}

export function toMarkdown(chunk) {
  let s = chunk;

  // Figures first, before any tag stripping can eat them.
  s = s.replace(/<img\b[^>]*>/gi, (tag) => {
    const src = /src="([^"]*)"/i.exec(tag)?.[1] ?? '';
    const alt = /alt="([^"]*)"/i.exec(tag)?.[1] ?? '';
    const file = decodeURIComponent(src.split('/').pop() || 'unknown');
    return `\n\n[[IMAGE: ${file}${alt ? ` — alt="${alt}"` : ''}]]\n\n`;
  });

  s = s.replace(/<(script|style|noscript)\b[\s\S]*?<\/\1>/gi, '');

  // Tables survive as pipe rows; rare in these books but they carry real payload.
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
