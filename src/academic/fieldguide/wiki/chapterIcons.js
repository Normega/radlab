// DSM chapter icons for the Field Guide.
//
// Files register themselves: drop `<chapter number>.<anything>.webp` into
// src/assets/chapter-icons/ and it appears wherever a chapter is named. There
// is no list to keep in step — which matters because the set arrives a few
// chapters at a time, and a hand-maintained manifest would drift.
//
// A chapter with no file renders *no* icon rather than a broken image, so a
// half-finished set degrades to the text-only layout it replaces.
//
// `?no-inline` matters. Most of these icons are under Vite's 4 KB inline
// threshold, so by default they are base64'd into a shared chunk — which built
// out to 56 KB that *every* wiki page had to download, including an article
// page that shows exactly one 22px icon. Forcing separate files lets the
// browser fetch only the icons actually on screen, and makes `loading="lazy"`
// mean something.
const files = import.meta.glob('../../../assets/chapter-icons/*.{webp,png,svg}', {
  eager: true,
  query: '?no-inline&url',
  import: 'default',
})

export const CHAPTER_ICONS = new Map(
  Object.entries(files)
    .map(([path, url]) => [Number(path.split('/').pop().split('.')[0]), url])
    .filter(([n]) => Number.isInteger(n) && n > 0)
)

/** URL for a DSM chapter's icon, or null when that chapter has none yet. */
export const chapterIcon = (n) => CHAPTER_ICONS.get(Number(n)) ?? null
