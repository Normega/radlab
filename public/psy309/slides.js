/* PSY309 lecture slideshow engine.
 *
 * Authoring contract: one <section> per slide inside <div id="deck">.
 *   data-kind="title|divider|activity|break"   optional styling
 *   <aside class="notes">…</aside>             speaker notes (hidden; 'n' toggles)
 *   class="hidden-until"                       revealed by a later press of → / space
 *
 * Keys:  → ↓ space / PgDn  next (reveals staged items first)
 *        ← ↑ PgUp          previous
 *        Home / End        first / last
 *        f                 fullscreen
 *        n                 speaker notes
 *        o                 overview grid (click a slide to jump)
 *        t                 elapsed-time clock (starts on first press)
 *        ?                 keyboard help
 * The current slide is mirrored into the URL hash so a reload keeps your place
 * and a link can point at a specific slide.
 */
(function () {
  const deck = document.getElementById('deck')
  const slides = Array.from(deck.querySelectorAll('section'))
  const bar = document.getElementById('bar')
  const num = document.getElementById('num')
  const clockEl = document.getElementById('clock')
  const help = document.getElementById('help')
  let i = 0
  let clockStart = null

  const staged = (s) => Array.from(s.querySelectorAll('.hidden-until'))

  function show(n, { revealAll = false } = {}) {
    i = Math.max(0, Math.min(slides.length - 1, n))
    slides.forEach((s, k) => {
      s.classList.toggle('current', k === i)
      // Slides behind you keep their reveals; slides ahead are reset, so
      // stepping back and forward replays the build rather than skipping it.
      if (k !== i) staged(s).forEach(el => el.classList.toggle('shown', k < i))
    })
    staged(slides[i]).forEach(el => el.classList.toggle('shown', revealAll))
    bar.style.width = ((i + 1) / slides.length * 100) + '%'
    num.textContent = (i + 1) + ' / ' + slides.length
    if (history.replaceState) history.replaceState(null, '', '#' + (i + 1))
  }

  function next() {
    const hide = staged(slides[i]).filter(el => !el.classList.contains('shown'))
    if (hide.length) { hide[0].classList.add('shown'); return }   // build first
    if (i < slides.length - 1) show(i + 1)
  }
  function prev() { if (i > 0) show(i - 1, { revealAll: true }) }

  document.addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return
    switch (e.key) {
      case 'ArrowRight': case 'ArrowDown': case ' ': case 'PageDown':
        e.preventDefault(); next(); break
      case 'ArrowLeft': case 'ArrowUp': case 'PageUp':
        e.preventDefault(); prev(); break
      case 'Home': e.preventDefault(); show(0); break
      case 'End': e.preventDefault(); show(slides.length - 1, { revealAll: true }); break
      case 'f': case 'F':
        if (document.fullscreenElement) document.exitFullscreen()
        else document.documentElement.requestFullscreen?.()
        break
      case 'n': case 'N': document.body.classList.toggle('notes-on'); break
      case 'o': case 'O': document.body.classList.toggle('overview'); break
      case 't': case 'T':
        if (!clockStart) { clockStart = Date.now(); tick() } else { clockStart = null; clockEl.textContent = '' }
        break
      case '?': help.classList.toggle('on'); break
      case 'Escape': help.classList.remove('on'); document.body.classList.remove('overview'); break
    }
  })

  // Click/tap: forward on the right two-thirds, back on the left third — so a
  // clicker or a phone works without a keyboard.
  deck.addEventListener('click', (e) => {
    if (document.body.classList.contains('overview')) {
      const s = e.target.closest('section')
      if (s) { document.body.classList.remove('overview'); show(slides.indexOf(s)) }
      return
    }
    if (e.target.closest('a')) return
    ;(e.clientX < window.innerWidth / 3) ? prev() : next()
  })

  function tick() {
    if (!clockStart) return
    const s = Math.floor((Date.now() - clockStart) / 1000)
    clockEl.textContent = String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0')
    setTimeout(tick, 1000)
  }

  const fromHash = parseInt(location.hash.replace('#', ''), 10)
  show(Number.isFinite(fromHash) && fromHash > 0 ? fromHash - 1 : 0)
})()
