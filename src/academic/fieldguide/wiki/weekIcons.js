// Week icons for week-anchored courses (PSY309 onward) — the calendar's
// sibling of chapterIcons.js, same self-registering pattern: drop
// `<coursecode>.<week_no>.<anything>.webp` into src/assets/week-icons/ and it
// appears wherever that course's week is named. Week numbers are the
// course_structure week_no values (so test weeks can carry icons too, even
// though the wiki index currently renders content weeks only).
//
// A week with no file renders *no* icon rather than a broken image, and a
// course with no icons at all degrades to the text-only layout — which is the
// state every new course starts in.
//
// `?no-inline` for the same reason as chapterIcons: keep each icon a separate
// lazily-fetched file instead of base64 ballast in a shared chunk.
const files = import.meta.glob('../../../assets/week-icons/*.{webp,png,svg}', {
  eager: true,
  query: '?no-inline&url',
  import: 'default',
})

const WEEK_ICONS = new Map(
  Object.entries(files)
    .map(([path, url]) => {
      const parts = path.split('/').pop().split('.')
      return [`${parts[0].toLowerCase()}.${Number(parts[1])}`, url]
    })
    .filter(([key]) => !key.endsWith('.NaN'))
)

export function weekIcon(courseCode, weekNo) {
  return WEEK_ICONS.get(`${String(courseCode ?? '').toLowerCase()}.${weekNo}`)
}
