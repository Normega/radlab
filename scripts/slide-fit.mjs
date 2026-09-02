// Slide fit check: renders each static deck at the classroom reference
// viewport and reports any slide whose content is taller or wider than one
// screen with every staged reveal shown. The decks are authored in vmin
// units, so passing at 1280x720 means passing at every 16:9 screen; run
// --viewport=1024x768 to audit the stricter 4:3 case.
//
//   node scripts/slide-fit.mjs [public/psy309/L1.html ...] [--viewport=WxH]
//
// Exits 1 if anything overflows, so it can gate a build if we ever want to.
import { launch } from 'puppeteer-core'
import { globSync } from 'node:fs'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const args = process.argv.slice(2)
const vpArg = args.find(a => a.startsWith('--viewport='))
const [W, H] = (vpArg ? vpArg.split('=')[1] : '1280x720').split('x').map(Number)
const files = args.filter(a => !a.startsWith('--'))
const decks = files.length ? files : globSync('public/psy309/L*.html')

const CHROME = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find(existsSync)

const browser = await launch({ executablePath: CHROME, headless: 'new' })
const page = await browser.newPage()
await page.setViewport({ width: W, height: H })

let failures = 0
for (const f of decks.sort()) {
  await page.goto(pathToFileURL(resolve(f)).href, { waitUntil: 'networkidle0' })
  await page.evaluate(() => document.fonts.ready)
  const rows = await page.evaluate(() => {
    const out = []
    const slides = [...document.querySelectorAll('#deck > section')]
    for (let k = 0; k < slides.length; k++) {
      slides.forEach((s, i) => s.classList.toggle('current', i === k))
      const s = slides[k]
      // Fit must hold with the build complete, not just the first frame.
      s.querySelectorAll('.hidden-until').forEach(el => el.classList.add('shown'))
      // scrollHeight misses content pushed above the top edge by
      // justify-content:center, so measure the real span of the children.
      const kids = [...s.children].filter(c => c.getBoundingClientRect().height > 0)
      const top = Math.min(...kids.map(c => c.getBoundingClientRect().top))
      const bot = Math.max(...kids.map(c => c.getBoundingClientRect().bottom))
      const cs = getComputedStyle(s)
      const need = (bot - top) + parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom)
      out.push({
        n: k + 1,
        overV: Math.max(0, Math.round(need - s.clientHeight)),
        overH: Math.max(0, s.scrollWidth - s.clientWidth),
        used: Math.round(need / s.clientHeight * 100),
      })
    }
    return out
  })
  const bad = rows.filter(r => r.overV > 2 || r.overH > 2)
  failures += bad.length
  const tag = f.replace(/^public\//, '')
  if (!bad.length) { console.log(`ok    ${tag}  (${rows.length} slides, tallest ${Math.max(...rows.map(r => r.used))}% of screen)`); continue }
  for (const r of bad) console.log(`OVER  ${tag}#${r.n}  +${r.overV}px tall${r.overH > 2 ? ` +${r.overH}px wide` : ''}`)
}
await browser.close()
console.log(failures ? `\n${failures} slide(s) overflow at ${W}x${H}` : `\nall decks fit at ${W}x${H}`)
process.exit(failures ? 1 : 0)
