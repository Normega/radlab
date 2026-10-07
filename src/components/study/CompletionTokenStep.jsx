// ── CompletionTokenStep ──────────────────────────────────────────────────────
// The last step of a session: a two-word token the participant shows to the
// researcher to claim their prize.
//
// WHAT IT IS FOR. At a recruitment table the researcher needs to tell, in a
// second and without touching the participant's phone, that this person really
// reached the end. A completion token does that, and the rotation is what makes
// it work: everyone sees the SAME token on a given day, and a different one
// tomorrow. So staff learn today's token once and can check it at a glance,
// while a screenshot taken yesterday, or passed to a friend who did not take
// part, shows the wrong words.
//
// It is a speed bump, not security. Someone determined can screenshot today's
// token and send it to a friend within the same day. That is fine: the prize is
// a stress toy, and the cost of a tighter scheme (per-participant codes staff
// must look up) is worse than the fraud it prevents.
//
// DETERMINISTIC, NOT RANDOM. The token is a pure function of the calendar date
// in the lab's timezone, so every device shows the same thing without a server
// round trip, and staff can check today's token by opening the preview at
// /admin/questionnaires/advanced/completion_token. Nothing is stored: reaching
// this step is already recorded by the session flow.
//
// ON THE ARTWORK. Previous waves used a Pokemon of the day. The wordlist below
// is deliberately generic so the lab owns everything it hands out; if you would
// rather use a licensed set, swap CREATURES and COLOURS and the mechanism is
// unchanged.
//
// ON REPEATS. The two words are drawn by independent hashes, so pairs are
// random rather than a cycle: measured over 400 days the first repeat lands 37
// days out, not 372. That does not matter here. The threat is a screenshot from
// yesterday or from a friend who did not take part, so the window that counts
// is one day, and consecutive days never share a creature (checked over 399
// pairs). A guaranteed 372-day cycle is possible with day-counter arithmetic
// instead of hashing, but it makes tomorrow's token predictable from today's,
// which is a worse trade.

import { useMemo } from 'react'

// 31 creatures, 12 colours: 372 possible pairs. See ON REPEATS above.
const CREATURES = [
  'Axolotl', 'Pangolin', 'Narwhal', 'Capybara', 'Lynx', 'Heron', 'Otter',
  'Falcon', 'Badger', 'Manatee', 'Ibex', 'Puffin', 'Marten', 'Caracal',
  'Osprey', 'Tapir', 'Quokka', 'Serval', 'Kestrel', 'Wombat', 'Gannet',
  'Fossa', 'Okapi', 'Jerboa', 'Saola', 'Vicuna', 'Dhole', 'Kakapo',
  'Numbat', 'Bongo', 'Sifaka',
]
const COLOURS = [
  'Amber', 'Indigo', 'Scarlet', 'Jade', 'Copper', 'Violet',
  'Cobalt', 'Saffron', 'Teal', 'Crimson', 'Olive', 'Slate',
]

/** Calendar date in the lab's timezone, as YYYY-MM-DD. */
export function labDateString(now = new Date()) {
  // en-CA gives ISO order, and the timezone is pinned so a participant whose
  // phone is set to another zone still sees the same token as the researcher
  // standing next to them.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Toronto',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(now)
}

/** FNV-1a. Small, dependency-free, and good enough to decorrelate adjacent
 *  dates — which matters, because consecutive days must not look related. */
function hash32(str) {
  let h = 0x811c9dc5
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h >>> 0
}

/** Today's token. Exported so staff tooling and tests can call it directly. */
export function tokenForDate(dateStr) {
  // Two independent hashes, so the colour does not march in step with the
  // creature. Salting the second one is what keeps them independent.
  const a = hash32(`utmap-creature:${dateStr}`)
  const b = hash32(`utmap-colour:${dateStr}`)
  return {
    date: dateStr,
    creature: CREATURES[a % CREATURES.length],
    colour: COLOURS[b % COLOURS.length],
  }
}

export default function CompletionTokenStep({
  onComplete, isSimMode = false, previewMode = false,
}) {
  const token = useMemo(() => tokenForDate(labDateString()), [])

  // Nothing is written here, so sim mode has nothing to fake; it just advances.
  if (isSimMode && !previewMode) onComplete?.({})

  const pretty = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Toronto', weekday: 'long', month: 'long', day: 'numeric',
  }).format(new Date())

  return (
    <div style={S.wrap}>
      <p style={S.eyebrow}>All done</p>
      <h1 style={S.title}>Show this screen to the researcher</h1>
      <p style={S.sub}>
        Thank you for taking part. Show the words below to pick something from
        the table.
      </p>

      <div style={S.card}>
        <p style={S.tokenLabel}>Today&rsquo;s word</p>
        <p style={S.token}>
          {token.colour} {token.creature}
        </p>
        <p style={S.date}>{pretty}</p>
      </div>

      <p style={S.foot}>
        If you have already closed this, just tell the researcher you finished
        and they will sort it out.
      </p>

      {!previewMode && (
        <button style={S.done} onClick={() => onComplete?.({})}>
          Done
        </button>
      )}
      {previewMode && (
        <p style={S.previewNote}>
          Preview. This is the token every participant sees today, and it is what
          staff should check against. It changes at midnight, Toronto time.
        </p>
      )}
    </div>
  )
}

const S = {
  wrap:    { maxWidth: 640, margin: '0 auto', padding: '0 16px 40px', fontFamily: "'DM Sans', system-ui, sans-serif", textAlign: 'center' },
  eyebrow: { fontFamily: "'Space Mono', monospace", fontSize: 12, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--tx2)', margin: '0 0 8px' },
  title:   { fontFamily: "'DM Serif Display', serif", fontSize: 28, fontWeight: 400, color: 'var(--tx)', margin: '0 0 8px' },
  sub:     { fontSize: 14, lineHeight: 1.6, color: 'var(--tx2)', margin: '0 0 24px' },
  card:    { background: 'var(--bgc)', border: '1px solid var(--bds)', borderRadius: 24, padding: '32px 24px', margin: '0 0 24px' },
  tokenLabel: { fontFamily: "'Space Mono', monospace", fontSize: 12, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--gy)', margin: '0 0 8px' },
  token:   { fontFamily: "'DM Serif Display', serif", fontSize: 36, lineHeight: 1.15, color: 'var(--pk)', margin: '0 0 16px' },
  date:    { fontSize: 14, color: 'var(--tx2)', margin: 0 },
  foot:    { fontSize: 12, lineHeight: 1.55, color: 'var(--tx2)', margin: '0 0 24px' },
  done:    { border: 'none', background: 'var(--tx)', color: 'var(--bgc)', borderRadius: 24, padding: '16px 32px', fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', width: '100%' },
  previewNote: { fontSize: 12, lineHeight: 1.55, color: 'var(--tx2)', background: 'var(--bg)', borderRadius: 12, padding: 16, margin: 0 },
}
